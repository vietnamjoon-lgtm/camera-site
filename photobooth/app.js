// 찰칵 부스: 카메라에 효과를 씌워 보여 주고, 셔터를 누르면 3·2·1 뒤에 찍어서 드라이브로 보낸다.
// 켜져 있는 동안은 카메라 원본도 계속 녹화해서 따로 보낸다 (사진은 iPad/사진, 영상은 iPad/영상 — apps-script.gs).
// 테스트용 주소: ?auto (바로 시작) &effect=<id> (처음 효과) &grid=<페이지> (격자 열기)
import { EFFECTS, PAGE_SIZE } from "./effects.js";
import { createRenderer } from "./renderer.js";
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
let busy = false; // 카운트다운 중
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
  $("bar").classList.add("hidden");
  $("label").classList.add("hidden");
  $("grid-bar").classList.remove("hidden");
  $("grid").classList.remove("hidden");
  layoutGrid();
}

function closeGrid() {
  gridPage = -1;
  $("grid").classList.add("hidden");
  $("grid-bar").classList.add("hidden");
  $("bar").classList.remove("hidden");
}

let labelTimer = 0;
function showLabel() {
  const label = $("label");
  label.textContent = EFFECTS.find((fx) => fx.id === current).name;
  label.classList.remove("hidden");
  clearTimeout(labelTimer);
  labelTimer = setTimeout(() => label.classList.add("hidden"), 1500);
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

async function upload(blob, filename) {
  const badge = $("thumb-badge");
  badge.textContent = "⬆️";
  const ok = await saveRecording(blob, filename, () => {}, { download: false });
  badge.textContent = ok ? "✅" : "⚠️";
  // 실패했으면 썸네일을 눌러서 다시 보낸다
  $("thumb").onclick = ok ? null : () => upload(blob, filename);
}

async function shoot() {
  if (busy || gridPage >= 0) return;
  busy = true;
  $("shutter").disabled = true;
  const countdown = $("countdown");
  countdown.classList.remove("hidden");
  for (const n of [3, 2, 1]) {
    countdown.textContent = n;
    beep(880, 120);
    await sleep(1000);
  }
  countdown.classList.add("hidden");

  // 지금 캔버스에 그려진 화면이 곧 사진 (preserveDrawingBuffer)
  renderer.upload();
  renderer.draw(current, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
  shutterSound();
  const flash = $("flash");
  flash.classList.remove("on");
  void flash.offsetWidth; // 애니메이션을 처음부터 다시
  flash.classList.add("on");

  busy = false;
  $("shutter").disabled = false;
  if (!blob) return;

  const img = $("thumb-img");
  if (img.src) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(blob);
  $("thumb").classList.add("has-photo");
  upload(blob, `photobooth_${timestampName()}.jpg`);
}

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

    renderer ??=createRenderer(canvas, video, EFFECTS);
    $("start-screen").classList.add("hidden");
    $("bar").classList.remove("hidden");
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
