// 찰칵 부스: 카메라에 효과를 씌워 보여 주고, 셔터를 누르면 3·2·1 뒤에 찍어서 드라이브로 보낸다.
// 네 컷 모드는 셔터 한 번에 네 장을 연속으로 찍고, 결과 화면에서 모양·프레임 색을 골라 합본을 저장한다.
// 켜져 있는 동안은 카메라 원본도 계속 녹화해서 따로 보낸다 (사진은 iPad/사진, 영상은 iPad/영상 — apps-script.gs).
// 테스트용 주소: ?auto (바로 시작) &effect=<id> (처음 효과) &grid=<페이지> (격자 열기) &mode=four (네 컷)
import { EFFECTS, PAGE_SIZE } from "./effects.js";
import { createRenderer } from "./renderer.js";
import { LAYOUTS, FRAME_COLORS, composeFourCut } from "./fourcut.js";
import { recordContinuously, saveRecording, timestampName } from "../recording.js";

const $ = (id) => document.getElementById(id);
const video = $("video");
const canvas = $("view");
const params = new URLSearchParams(location.search);

const PAGES = Math.ceil(EFFECTS.length / PAGE_SIZE);
const GAP = 4; // 격자 칸 사이 간격 (CSS px)

let renderer = null;
let current = EFFECTS.some((fx) => fx.id === params.get("effect")) ? params.get("effect") : "original";
let gridPage = -1; // -1이면 격자 닫힘
let mode = params.get("mode") === "four" ? "four" : "single";
let busy = false; // 카운트다운·연속 촬영 중
let audio = null;

// ---------- 소리 (파일 없이 Web Audio로 만든다) ----------

function beep(freq, ms) {
  if (!audio) return;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.2, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + ms / 1000);
  o.connect(g).connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + ms / 1000);
}

function shutterSound() {
  if (!audio) return;
  const len = audio.sampleRate * 0.12;
  const buf = audio.createBuffer(1, len, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = audio.createBufferSource();
  src.buffer = buf;
  src.connect(audio.destination);
  src.start();
}

// ---------- 카메라 화면 버튼들 ----------

function showCameraUI(show) {
  $("bar").classList.toggle("hidden", !show);
  $("mode").classList.toggle("hidden", !show);
}

function setMode(m) {
  mode = m;
  for (const b of $("mode").children) b.classList.toggle("on", b.dataset.mode === m);
}

function setBusy(on) {
  busy = on;
  $("shutter").disabled = on;
  $("effects").disabled = on;
  for (const b of $("mode").children) b.disabled = on;
}

// ---------- 격자 ----------

// 격자 칸 위치 (CSS px). 아래 막대 위쪽 공간을 3×3으로 나눈다.
function cellRects() {
  const top = 0;
  const bottom = $("grid-bar").getBoundingClientRect().top;
  const w = (canvas.clientWidth - GAP * 2) / 3;
  const h = (bottom - top - GAP * 2) / 3;
  return Array.from({ length: PAGE_SIZE }, (_, i) => ({
    left: (i % 3) * (w + GAP),
    top: top + Math.floor(i / 3) * (h + GAP),
    width: w,
    height: h,
  }));
}

function pageEffects() {
  return EFFECTS.slice(gridPage * PAGE_SIZE, (gridPage + 1) * PAGE_SIZE);
}

function layoutGrid() {
  const rects = cellRects();
  const grid = $("grid");
  grid.replaceChildren(
    ...pageEffects().map((fx, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = fx.name;
      b.classList.toggle("current", fx.id === current);
      Object.assign(b.style, {
        left: `${rects[i].left}px`,
        top: `${rects[i].top}px`,
        width: `${rects[i].width}px`,
        height: `${rects[i].height}px`,
      });
      b.addEventListener("click", () => pick(fx.id));
      return b;
    })
  );
  $("page").textContent = `${gridPage + 1} / ${PAGES}`;
}

function openGrid(page) {
  gridPage = (page + PAGES) % PAGES;
  showCameraUI(false);
  $("label").classList.add("hidden");
  $("grid-bar").classList.remove("hidden");
  $("grid").classList.remove("hidden");
  layoutGrid();
}

function closeGrid() {
  gridPage = -1;
  $("grid").classList.add("hidden");
  $("grid-bar").classList.add("hidden");
  showCameraUI(true);
}

let labelTimer = 0;
function showLabel(text = EFFECTS.find((fx) => fx.id === current).name, ms = 1500) {
  const label = $("label");
  label.textContent = text;
  label.classList.remove("hidden");
  clearTimeout(labelTimer);
  if (ms) labelTimer = setTimeout(() => label.classList.add("hidden"), ms);
}

function pick(id) {
  current = id;
  closeGrid();
  showLabel();
}

// ---------- 그리기 ----------

function frame() {
  requestAnimationFrame(frame);
  const dpr = renderer.resize();
  if (!renderer.upload()) return;
  renderer.clear();
  if (gridPage < 0) {
    renderer.draw(current, 0, 0, canvas.width, canvas.height);
    return;
  }
  // CSS px 칸을 WebGL 좌표(아래쪽 기준, 실제 픽셀)로 바꿔서 그린다
  const rects = cellRects();
  pageEffects().forEach((fx, i) => {
    const r = rects[i];
    const x = Math.round(r.left * dpr);
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    const y = canvas.height - Math.round(r.top * dpr) - h;
    renderer.draw(fx.id, x, y, w, h);
  });
}

// ---------- 찍기 ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toJpeg = (c) => new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));

async function upload(blob, filename) {
  const badge = $("thumb-badge");
  badge.textContent = "⬆️";
  const ok = await saveRecording(blob, filename, () => {}, { download: false });
  badge.textContent = ok ? "✅" : "⚠️";
  // 실패했으면 썸네일을 눌러서 다시 보낸다
  $("thumb").onclick = ok ? null : () => upload(blob, filename);
}

function showThumb(blob) {
  const img = $("thumb-img");
  if (img.src) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(blob);
  $("thumb").classList.add("has-photo");
}

async function countdown() {
  const el = $("countdown");
  el.classList.remove("hidden");
  for (const n of [3, 2, 1]) {
    el.textContent = n;
    beep(880, 120);
    await sleep(1000);
  }
  el.classList.add("hidden");
}

// 지금 화면을 찍는다. 캔버스에 그린 그대로가 사진 (preserveDrawingBuffer)
async function capture() {
  renderer.upload();
  renderer.draw(current, 0, 0, canvas.width, canvas.height);
  const [blob, bitmap] = await Promise.all([toJpeg(canvas), createImageBitmap(canvas)]);
  shutterSound();
  const flash = $("flash");
  flash.classList.remove("on");
  void flash.offsetWidth; // 애니메이션을 처음부터 다시
  flash.classList.add("on");
  return { blob, bitmap };
}

async function shootSingle() {
  await countdown();
  const { blob } = await capture();
  if (!blob) return;
  showThumb(blob);
  upload(blob, `photobooth_${timestampName()}.jpg`);
}

// 네 장 연속: 낱장은 찍자마자 올리고 (중간에 꺼져도 남게), 다 찍으면 결과 화면
async function shootFour() {
  const stamp = timestampName();
  const shots = [];
  for (let i = 1; i <= 4; i++) {
    showLabel(`${i} / 4`, 0);
    await countdown();
    const { blob, bitmap } = await capture();
    if (!blob) continue;
    shots.push(bitmap);
    showThumb(blob);
    upload(blob, `fourcut_${stamp}_${i}.jpg`);
    if (i < 4) await sleep(700);
  }
  $("label").classList.add("hidden");
  if (shots.length === 4) openResult(shots, stamp);
}

async function shoot() {
  if (busy || gridPage >= 0 || !$("result").classList.contains("hidden")) return;
  setBusy(true);
  try {
    await (mode === "four" ? shootFour() : shootSingle());
  } finally {
    setBusy(false);
  }
}

// ---------- 네 컷 결과 화면 ----------

const result = { shots: [], stamp: "", layout: "strip", color: "white", canvas: null };

function renderResult() {
  result.canvas = composeFourCut(result.shots, result.layout, result.color);
  $("result-img").src = result.canvas.toDataURL("image/jpeg", 0.9);
  for (const b of $("layouts").children) b.classList.toggle("on", b.dataset.id === result.layout);
  for (const b of $("colors").children) b.classList.toggle("on", b.dataset.id === result.color);
}

function openResult(shots, stamp) {
  Object.assign(result, { shots, stamp });
  $("save").disabled = false;
  $("save").textContent = "저장";
  showCameraUI(false);
  $("result").classList.remove("hidden");
  renderResult();
}

function closeResult() {
  result.shots.forEach((b) => b.close?.());
  result.shots = [];
  $("result").classList.add("hidden");
  showCameraUI(true);
}

async function saveResult() {
  $("save").disabled = true;
  $("save").textContent = "저장 중…";
  const blob = await toJpeg(result.canvas);
  showThumb(blob);
  upload(blob, `fourcut_${result.stamp}.jpg`);
  closeResult();
}

$("layouts").replaceChildren(
  ...LAYOUTS.map((l) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.id = l.id;
    b.textContent = l.name;
    b.addEventListener("click", () => {
      result.layout = l.id;
      renderResult();
    });
    return b;
  })
);

$("colors").replaceChildren(
  ...FRAME_COLORS.map((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.id = c.id;
    b.style.background = c.bg;
    b.setAttribute("aria-label", c.name);
    b.addEventListener("click", () => {
      result.color = c.id;
      renderResult();
    });
    return b;
  })
);

// ---------- 시작 ----------

async function start() {
  const startButton = $("start");
  startButton.disabled = true;
  startButton.textContent = "카메라 켜는 중…";
  $("error").textContent = "";
  try {
    // 아이폰은 버튼을 누른 순간에만 소리를 켤 수 있다
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx && !audio) audio = new Ctx();
    audio?.resume();

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("이 브라우저는 카메라를 지원하지 않아요 (https 또는 localhost에서 열어 주세요)");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    // 사진과 별개로, 시작한 순간부터 카메라 원본을 녹화해서 10초마다 드라이브로 (recording.js)
    recordContinuously(stream, { prefix: "photobooth", segmentMs: 10_000 });

    renderer ??= createRenderer(canvas, video, EFFECTS);
    $("start-screen").classList.add("hidden");
    showCameraUI(true);
    setMode(mode);
    requestAnimationFrame(frame);

    if (params.has("grid")) openGrid(Number(params.get("grid")) - 1 || 0);
    else showLabel();
  } catch (err) {
    console.error(err);
    $("error").textContent =
      err.name === "NotAllowedError" ? "⚠️ 카메라 권한을 허용해 주세요" : `⚠️ ${err.message}`;
    startButton.disabled = false;
    startButton.textContent = "다시 시작";
  }
}

$("start").addEventListener("click", start);
$("shutter").addEventListener("click", shoot);
$("effects").addEventListener("click", () => openGrid(Math.floor(EFFECTS.findIndex((fx) => fx.id === current) / PAGE_SIZE)));
$("prev").addEventListener("click", () => openGrid(gridPage - 1));
$("next").addEventListener("click", () => openGrid(gridPage + 1));
for (const b of $("mode").children) b.addEventListener("click", () => setMode(b.dataset.mode));
$("retake").addEventListener("click", closeResult);
$("save").addEventListener("click", saveResult);
window.addEventListener("resize", () => gridPage >= 0 && layoutGrid());

// 맥에서는 스페이스바로 찍고, Esc로 격자를 닫는다
window.addEventListener("keydown", (e) => {
  if (!renderer) return;
  if (e.code === "Space") {
    e.preventDefault();
    shoot();
  } else if (e.code === "Escape" && gridPage >= 0) closeGrid();
});

if (params.has("auto")) start();
