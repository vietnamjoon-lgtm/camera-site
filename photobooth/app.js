// 찰칵 부스: 카메라에 효과를 씌워 보여 주고, 셔터를 누르면 3·2·1 뒤에 찍어서 드라이브로 보낸다.
// 한 장은 찍은 뒤 결과 화면에서 폴라로이드·필름 날짜로 꾸며 한 번 더 저장할 수 있다.
// 네 컷 모드는 셔터 한 번에 네 장을 연속으로 찍고, 결과 화면에서 모양·프레임 색·글씨를 골라 합본을 저장한다.
// 움짤 모드는 2초를 찍어 부메랑 GIF로. 얼굴 스티커와 배경 바꾸기는 어느 모드에서나 함께 찍힌다.
// 켜져 있는 동안은 카메라 원본도 계속 녹화해서 따로 보낸다 (사진은 iPad/사진, 영상은 iPad/영상 — apps-script.gs).
// 손으로 찍기를 켜 두면 카메라에 손바닥을 잠깐 보여 주는 것만으로 셔터가 눌린다.
// 테스트용 주소: ?auto (바로 시작) &effect=<id> (처음 효과) &grid=<페이지> (격자 열기) &mode=four|boomerang
//               &sticker=<id> &bg=<id> (처음 스티커·배경) &hand (손으로 찍기 켜기)
import { EFFECTS, PAGE_SIZE } from "./effects.js";
import { createRenderer } from "./renderer.js";
import { LAYOUTS, FRAME_COLORS, composeFourCut } from "./fourcut.js";
import { SINGLE_LAYOUTS, composeSingle } from "./single.js";
import { STICKERS, drawSticker } from "./stickers.js";
import { BACKGROUNDS, loadBackground, loadPhoto } from "./backgrounds.js";
import { recordFrames, encodeBoomerang } from "./boomerang.js";
import { createFaceTracker, createSegmenter, createGestureRecognizer } from "./vision.js";
import { makeSampleStrip, makeSamplePolaroid, makeSampleGifFrames, GIF_FRAME_MS } from "./sample-strip.js";
import { printLook } from "./print-look.js";
import { recordContinuously, saveRecording, timestampName } from "../recording.js";

const $ = (id) => document.getElementById(id);
const video = $("video");
const canvas = $("view");
const overlay = $("overlay");
const overlayCtx = overlay.getContext("2d");
const params = new URLSearchParams(location.search);

const PAGES = Math.ceil(EFFECTS.length / PAGE_SIZE);
const GAP_COLOR = [0x12 / 255, 0x0d / 255, 0x10 / 255]; // 격자 칸 사이 틈 = 배경색 (style.css --bg)
const GAP = 4; // 격자 칸 사이 간격 (CSS px)

let renderer = null;
let current = EFFECTS.some((fx) => fx.id === params.get("effect")) ? params.get("effect") : "original";
let gridPage = -1; // -1이면 격자 닫힘
let mode = ["four", "boomerang"].includes(params.get("mode")) ? params.get("mode") : "single";
let busy = false; // 카운트다운·연속 촬영 중
let audio = null;

let sticker = "none";
let background = "none";
let bgPhoto = null; // 기기에서 고른 배경 사진 (저장 안 함)
let picker = null; // 열린 고르는 줄: "sticker" | "bg" | null
let faces = []; // 마지막으로 찾은 얼굴들
let lastTrack = 0;
// 얼굴 찾기·배경 나누기는 처음 쓸 때 한 번만 불러온다 (vision.js)
let faceTracker = null;
let segmenter = null;
let palmReader = null;
let handOn = false;

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
  $("tools").classList.toggle("hidden", !show);
  overlay.classList.toggle("hidden", !show);
  if (!show) setPicker(null);
}

function setMode(m) {
  mode = m;
  for (const b of $("mode").children) b.classList.toggle("on", b.dataset.mode === m);
}

function setBusy(on) {
  busy = on;
  $("shutter").disabled = on;
  $("effects").disabled = on;
  $("sticker-btn").disabled = on;
  $("bg-btn").disabled = on;
  $("hand-btn").disabled = on;
  for (const b of $("mode").children) b.disabled = on;
  if (on) setPicker(null);
}

// ---------- 스티커 · 배경 고르기 ----------

function setPicker(kind) {
  picker = kind;
  $("sticker-btn").classList.toggle("on", kind === "sticker");
  $("bg-btn").classList.toggle("on", kind === "bg");
  const el = $("picker");
  el.classList.toggle("hidden", !kind);
  if (!kind) return;
  const items =
    kind === "sticker"
      ? STICKERS.map((s) => [s.id, s.name])
      : [...BACKGROUNDS.map((b) => [b.id, b.name]), ["photo", "＋ 내 사진"]];
  const selected = kind === "sticker" ? sticker : background;
  el.replaceChildren(
    ...items.map(([id, name]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name;
      b.classList.toggle("on", id === selected);
      b.addEventListener("click", () => {
        if (kind === "sticker") chooseSticker(id);
        else if (id === "photo") $("photo").click();
        else chooseBackground(id);
      });
      return b;
    })
  );
}

// 처음 쓸 때 모델을 내려받는 동안 "준비 중"을 띄운다. 실패하면 null
async function prepare(load, what) {
  showLabel(`${what} 준비 중…`, 0);
  try {
    const tool = await load();
    $("label").classList.add("hidden");
    return tool;
  } catch (err) {
    console.error(err);
    showLabel(`⚠️ ${what} 준비에 실패했어요 (인터넷 확인)`, 3000);
    return null;
  }
}

let faceTrackerLoad = null;
async function chooseSticker(id) {
  if (id !== "none" && !faceTracker) {
    faceTrackerLoad ??= prepare(createFaceTracker, "스티커");
    faceTracker = await faceTrackerLoad;
    faceTrackerLoad = null;
    if (!faceTracker) return;
  }
  sticker = id;
  faces = [];
  if (picker) setPicker(picker);
  showLabel(STICKERS.find((s) => s.id === id).name);
}

// ---------- 손으로 찍기 ----------

const HAND_KEY = "photobooth.hand";
const HOLD_MS = 600; // 손바닥을 이만큼 보여 주면 찍는다
let palmSince = 0; // 손바닥이 계속 보이기 시작한 시각
let lastPalm = 0; // 마지막으로 손바닥이 보인 시각
let palmArmed = true; // 한 번 찍으면 손을 내렸다가 다시 들어야 또 찍힌다
let lastHand = 0;

function setPalmProgress(p) {
  $("shutter").style.setProperty("--palm-p", p);
}

let palmReaderLoad = null;
async function setHand(on) {
  if (on && !palmReader) {
    palmReaderLoad ??= prepare(createGestureRecognizer, "손 인식");
    palmReader = await palmReaderLoad;
    palmReaderLoad = null;
    if (!palmReader) return;
  }
  handOn = on;
  palmSince = 0;
  setPalmProgress(0);
  $("hand-btn").classList.toggle("on", on);
  $("hand-btn").setAttribute("aria-pressed", on);
  try {
    localStorage.setItem(HAND_KEY, on ? "on" : "off");
  } catch {}
  showLabel(on ? "✋ 손바닥을 보여 주면 찍어요" : "손으로 찍기 끔", 2500);
}

// 1초에 10번 손을 본다. 한두 번 놓친 건 봐준다
function checkPalm(now) {
  if (now - lastHand < 100) return;
  lastHand = now;
  const palm = palmReader.openPalm(video, now);
  if (palm) lastPalm = now;
  const gone = now - lastPalm;
  if (gone > 250) palmSince = 0;
  if (gone > 500) palmArmed = true;
  const ready = palmArmed && !busy && gridPage < 0;
  if (!ready || palmSince === 0) setPalmProgress(0);
  if (!palm || !ready) return;
  palmSince ||= now;
  const p = Math.min(1, (now - palmSince) / HOLD_MS);
  setPalmProgress(p);
  if (p === 1) {
    palmArmed = false;
    palmSince = 0;
    setPalmProgress(0);
    shoot();
  }
}

let segmenterLoad = null;
async function chooseBackground(id) {
  if (id !== "none" && !segmenter) {
    segmenterLoad ??= prepare(createSegmenter, "배경");
    segmenter = await segmenterLoad;
    segmenterLoad = null;
    if (!segmenter) return;
  }
  let image = null;
  if (id === "photo") image = bgPhoto;
  else if (id !== "none" && id !== "blur") {
    try {
      image = await loadBackground(id);
    } catch (err) {
      console.error(err);
      showLabel("⚠️ 배경 사진을 못 불러왔어요 (인터넷 확인)", 3000);
      return;
    }
  }
  background = id;
  if (id === "none") renderer.setBackground("off");
  else if (id === "blur") renderer.setBackground("blur");
  else renderer.setBackground("image", image);
  lastTrack = 0; // 다음 그림부터 바로 마스크를 새로 만든다
  if (picker) setPicker(picker);
  showLabel(id === "photo" ? "내 사진" : BACKGROUNDS.find((b) => b.id === id).name);
}

// ---------- 격자 ----------

// 격자 칸 위치 (CSS px). 카메라 화면(받침 위쪽)을 3×3으로 나눈다.
function cellRects() {
  const w = (canvas.clientWidth - GAP * 2) / 3;
  const h = (canvas.clientHeight - GAP * 2) / 3;
  return Array.from({ length: PAGE_SIZE }, (_, i) => ({
    left: (i % 3) * (w + GAP),
    top: Math.floor(i / 3) * (h + GAP),
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
      const name = document.createElement("span");
      name.textContent = fx.name;
      b.append(name);
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

// 얼굴 찾기와 사람 마스크는 1초에 30번까지만 (카메라도 그 정도라서)
function track() {
  const now = performance.now();
  if (now - lastTrack < 30) return;
  lastTrack = now;
  try {
    if (segmenter && background !== "none") renderer.setMask(segmenter.mask(video, now));
    if (faceTracker && sticker !== "none" && gridPage < 0) faces = faceTracker.detect(video, now);
    // 효과 고르는 중이거나 결과 화면에서는 손을 안 본다
    if (palmReader && handOn && gridPage < 0 && $("result").classList.contains("hidden")) checkPalm(now);
  } catch (err) {
    console.error(err);
  }
}

// 카메라 원본의 점(0~1) → 화면 캔버스 좌표. 셰이더의 cam()과 같은 반전·잘라내기
function screenMapper() {
  const W = overlay.width;
  const H = overlay.height;
  const va = video.videoWidth / video.videoHeight || 1;
  const ca = W / H;
  const cx = ca > va ? 1 : ca / va;
  const cy = ca > va ? va / ca : 1;
  return (p) => ({ x: (0.5 - (p.x - 0.5) / cx) * W, y: (0.5 + (p.y - 0.5) / cy) * H });
}

function drawStickers() {
  if (overlay.width !== canvas.width || overlay.height !== canvas.height) {
    overlay.width = canvas.width;
    overlay.height = canvas.height;
  }
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  if (sticker === "none" || gridPage >= 0) return;
  const toScreen = screenMapper();
  for (const face of faces) drawSticker(overlayCtx, sticker, face, toScreen);
}

function frame() {
  requestAnimationFrame(frame);
  const dpr = renderer.resize();
  if (!renderer.upload()) return;
  track();
  drawStickers();
  renderer.clear(GAP_COLOR);
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
  badge.className = "up";
  badge.textContent = "";
  const ok = await saveRecording(blob, filename, () => {}, { download: false });
  badge.className = ok ? "ok" : "bad";
  badge.textContent = ok ? "" : "!";
  $("thumb").setAttribute("aria-label", ok ? "방금 찍은 사진 (저장됨)" : "저장 실패. 누르면 다시 보내요");
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

// 효과 화면(WebGL, preserveDrawingBuffer라 마지막 그림이 남아 있음) 위에 스티커를 합친 지금 모습
const shotCanvas = document.createElement("canvas");
function snapshot() {
  shotCanvas.width = canvas.width;
  shotCanvas.height = canvas.height;
  const ctx = shotCanvas.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  if (sticker !== "none") ctx.drawImage(overlay, 0, 0);
  return shotCanvas;
}

function flashScreen() {
  const flash = $("flash");
  flash.classList.remove("on");
  void flash.offsetWidth; // 애니메이션을 처음부터 다시
  flash.classList.add("on");
}

// 지금 화면을 찍는다. 화면에 보이는 그대로가 사진
async function capture() {
  renderer.upload();
  renderer.draw(current, 0, 0, canvas.width, canvas.height);
  const shot = snapshot();
  const [blob, bitmap] = await Promise.all([toJpeg(shot), createImageBitmap(shot)]);
  shutterSound();
  flashScreen();
  return { blob, bitmap };
}

// 원본은 찍자마자 올리고, 결과 화면에서 꾸민 것을 저장하면 하나 더 올린다
async function shootSingle() {
  await countdown();
  const { blob, bitmap } = await capture();
  if (!blob) return;
  const stamp = timestampName();
  showThumb(blob);
  upload(blob, `photobooth_${stamp}.jpg`);
  openResult("single", [bitmap], stamp);
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
  if (shots.length === 4) openResult("four", shots, stamp);
}

// 움짤: 2초 동안 찍어서 부메랑 GIF로
async function shootBoomerang() {
  await countdown();
  shutterSound();
  showLabel("● 움짤 찍는 중", 0);
  const frames = await recordFrames(snapshot);
  showLabel("움짤 만드는 중…", 0);
  try {
    const blob = await encodeBoomerang(frames);
    $("label").classList.add("hidden");
    showThumb(blob);
    upload(blob, `boomerang_${timestampName()}.gif`);
  } catch (err) {
    console.error(err);
    showLabel("⚠️ 움짤을 못 만들었어요", 3000);
  }
}

async function shoot() {
  if (busy || gridPage >= 0 || !$("result").classList.contains("hidden")) return;
  setBusy(true);
  try {
    await { single: shootSingle, four: shootFour, boomerang: shootBoomerang }[mode]();
  } finally {
    setBusy(false);
  }
}

// ---------- 결과 화면 (한 장 · 네 컷) ----------

// 한 장과 네 컷은 고를 수 있는 모양만 다르고 색·글씨·저장은 같이 쓴다
const RESULT_KINDS = {
  single: { layouts: SINGLE_LAYOUTS, compose: composeSingle, file: (r) => `photobooth_${r.stamp}_${r.layout}.jpg` },
  four: { layouts: LAYOUTS, compose: composeFourCut, file: (r) => `fourcut_${r.stamp}.jpg` },
};
const result = { kind: "four", shots: [], stamp: "", layout: "", color: "white", canvas: null };
const lastLayout = { single: "polaroid", four: "strip" }; // 모드마다 마지막으로 고른 모양

// 아래 글씨는 다음에 켰을 때도 기억한다
const CAPTION_KEY = "photobooth.caption";
function savedCaption() {
  try {
    return localStorage.getItem(CAPTION_KEY) ?? "찰칵 부스";
  } catch {
    return "찰칵 부스";
  }
}
$("caption").value = savedCaption();
$("caption").addEventListener("input", () => {
  try {
    localStorage.setItem(CAPTION_KEY, $("caption").value);
  } catch {}
  renderResult();
});

function renderResult() {
  const { compose } = RESULT_KINDS[result.kind];
  const images = result.kind === "single" ? result.shots[0] : result.shots;
  result.canvas = compose(images, result.layout, result.color, $("caption").value);
  // 화면에는 인화지 느낌을 입혀서 보여 주고, 저장은 깨끗한 원본으로
  $("result-img").src = printLook(result.canvas).toDataURL("image/jpeg", 0.9);
  for (const b of $("layouts").children) b.classList.toggle("on", b.dataset.id === result.layout);
  for (const b of $("colors").children) b.classList.toggle("on", b.dataset.id === result.color);
  // 필름 날짜는 테두리·글씨가 없다
  const plain = result.layout === "film";
  $("colors").classList.toggle("hidden", plain);
  $("caption").classList.toggle("hidden", plain);
}

function openResult(kind, shots, stamp) {
  Object.assign(result, { kind, shots, stamp, layout: lastLayout[kind] });
  $("layouts").replaceChildren(
    ...RESULT_KINDS[kind].layouts.map((l) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.id = l.id;
      b.textContent = l.name;
      b.addEventListener("click", () => {
        result.layout = lastLayout[kind] = l.id;
        renderResult();
      });
      return b;
    })
  );
  $("save").disabled = false;
  $("save").textContent = "저장";
  showCameraUI(false);
  $("result").classList.remove("hidden");
  renderResult();
  // 찍은 사진이 기계 구멍에서 끊어 끊어 뽑혀 나온다 (입장 화면과 같은 움직임)
  if (!calm) $("result-img").animate(FEED, { duration: 1500, fill: "backwards" });
}

function closeResult() {
  // 결과 화면을 닫자마자 들고 있던 손에 또 찍히지 않게, 손을 한 번 내려야 다시 찍힌다
  lastPalm = performance.now();
  palmArmed = false;
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
  upload(blob, RESULT_KINDS[result.kind].file(result));
  closeResult();
}

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

// ---------- 입장 화면 · 시작 ----------

const MODE_HINTS = {
  single: "3, 2, 1 하고 한 장 찍어요",
  four: "네 장을 이어서 찍고 프레임을 골라요",
  boomerang: "2초 찍어서 앞뒤로 도는 움짤을 만들어요",
};

function pickStartMode(m) {
  mode = m;
  for (const b of $("start-modes").children) b.classList.toggle("on", b.dataset.mode === m);
  $("start-hint").textContent = MODE_HINTS[m];
  showSheet($({ single: "sample-polaroid", four: "sample-strip", boomerang: "sample-gif" }[m]));
}

// 견본 사진은 기계 구멍에서 끊어 끊어 밀려 나오고, 모드를 바꾸면 쏙 들어간 뒤 다른 게 나온다
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FEED = [0, 0.22, 0.45, 0.67, 0.88, 1].map((k, i, all) => ({
  translate: `0 ${-100 + k * 100}%`,
  offset: i / (all.length - 1),
  easing: "steps(1, end)",
}));
let sheet = null; // 지금 걸려 있는 견본
let sheetTurn = 0; // 빠르게 여러 번 바꿔도 마지막 것만 나오게

async function showSheet(next) {
  if (next === sheet) return;
  const turn = ++sheetTurn;
  await samplesReady; // 견본 사진을 다 불러온 뒤에 뽑혀 나온다
  if (turn !== sheetTurn) return;
  const prev = sheet;
  sheet = next;
  if (prev && !calm) {
    await prev.animate([{ translate: "0 0" }, { translate: "0 -100%" }], { duration: 380, easing: "ease-in", fill: "forwards" }).finished.catch(() => {});
    if (turn !== sheetTurn) return;
  }
  prev?.classList.add("hidden");
  prev?.getAnimations().forEach((a) => a.cancel());
  next.getAnimations().forEach((a) => a.cancel()); // 바꾸다 만 들어가기 움직임이 남아 있으면 지운다
  next.parentElement.dataset.sheet = next.id;
  next.classList.remove("hidden");
  if (!calm) next.animate(FEED, { duration: 1500, fill: "backwards" });
}

// 견본은 실제 사진을 불러와서 만든다. 못 불러와도 입장 화면은 쓸 수 있게 그냥 넘어간다
const samplesReady = Promise.all([
  makeSampleStrip().then((c) => ($("sample-strip").src = printLook(c).toDataURL("image/jpeg", 0.9))),
  makeSamplePolaroid().then((c) => ($("sample-polaroid").src = printLook(c).toDataURL("image/jpeg", 0.9))),
  makeSampleGifFrames().then((frames) => playSampleGif(frames.map(printLook))),
]).catch((err) => console.error(err));

// 움짤 견본은 앞으로 → 뒤로 계속 돌린다 (카메라가 켜지면 멈춘다)
function playSampleGif(frames) {
  const order = [...frames, ...frames.slice(1, -1).reverse()];
  const el = $("sample-gif");
  el.width = frames[0].width;
  el.height = frames[0].height;
  const ctx = el.getContext("2d");
  const started = performance.now();
  let shown = -1;
  (function step(now) {
    if ($("start-screen").classList.contains("hidden")) return;
    const i = Math.floor(Math.max(0, now - started) / GIF_FRAME_MS) % order.length; // 첫 rAF 시각이 시작보다 살짝 이를 수 있다
    if (i !== shown && !(calm && shown >= 0)) {
      ctx.drawImage(order[i], 0, 0);
      shown = i;
    }
    requestAnimationFrame(step);
  })(started);
}
pickStartMode(mode);

// 견본은 기계에 매달린 종이. 커서(손가락)가 근처를 스치면 그 방향으로 바람을 맞은 것처럼
// 살랑 흔들리다가 천천히 제자리로 돌아온다. 가까이서 빠르게 지나갈수록 세게, 멀면 그대로
const clamp = (v, max) => Math.max(-max, Math.min(max, v));
const REACH = 280; // 이 거리(px) 안을 지나가야 바람이 닿는다

function swingStrip() {
  if (calm) return;
  const screen = $("start-screen");
  const sheets = [$("sample-strip"), $("sample-polaroid"), $("sample-gif")];
  let angle = 0; // 좌우로 흔들림 (deg)
  let speed = 0;
  let flutter = 0; // 종이가 살짝 비틀리는 것 (deg)
  let flutterSpeed = 0;
  let last = null;

  screen.addEventListener("pointermove", (e) => {
    if (last) {
      const r = sheet.getBoundingClientRect();
      const gapX = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
      const gapY = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      const near = Math.max(0, 1 - Math.hypot(gapX, gapY) / REACH);
      const push = (e.clientX - last.x) * near;
      // 위가 매달려 있으니 반대로 돌려야 아래쪽이 바람 부는 쪽으로 밀린다
      speed = clamp(speed - push * 0.004, 0.6);
      flutterSpeed = clamp(flutterSpeed + push * 0.01, 1.5);
    }
    last = { x: e.clientX };
  });
  screen.addEventListener("pointerleave", () => (last = null));

  (function step() {
    if (screen.classList.contains("hidden")) return; // 카메라가 켜지면 멈춘다
    speed = (speed - angle * 0.02) * 0.965;
    angle = clamp(angle + speed, 9);
    flutterSpeed = (flutterSpeed - flutter * 0.05) * 0.92;
    flutter = clamp(flutter + flutterSpeed, 20);
    for (const s of sheets) s.style.transform = `perspective(900px) rotateY(${flutter}deg) rotate(${angle}deg)`;
    requestAnimationFrame(step);
  })();
}
swingStrip();

// 셔터를 누르면 고른 모드로 카메라를 켠다
async function start() {
  const controls = [$("start"), ...$("start-modes").children];
  for (const c of controls) c.disabled = true;
  $("start-hint").textContent = "카메라 켜는 중…";
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
    flashScreen();
    showCameraUI(true);
    setMode(mode);
    requestAnimationFrame(frame);

    if (params.has("grid")) openGrid(Number(params.get("grid")) - 1 || 0);
    else showLabel();
    if (STICKERS.some((s) => s.id === params.get("sticker"))) chooseSticker(params.get("sticker"));
    if (BACKGROUNDS.some((b) => b.id === params.get("bg"))) chooseBackground(params.get("bg"));
    let handSaved = null;
    try {
      handSaved = localStorage.getItem(HAND_KEY);
    } catch {}
    if (params.has("hand") || handSaved === "on") setHand(true);
  } catch (err) {
    console.error(err);
    $("error").textContent =
      err.name === "NotAllowedError" ? "⚠️ 카메라 권한을 허용해 주세요" : `⚠️ ${err.message}`;
    for (const c of controls) c.disabled = false;
    $("start-hint").textContent = MODE_HINTS[mode];
  }
}

$("start").addEventListener("click", start);
for (const b of $("start-modes").children) b.addEventListener("click", () => pickStartMode(b.dataset.mode));
$("shutter").addEventListener("click", shoot);
$("effects").addEventListener("click", () => openGrid(Math.floor(EFFECTS.findIndex((fx) => fx.id === current) / PAGE_SIZE)));
$("prev").addEventListener("click", () => openGrid(gridPage - 1));
$("next").addEventListener("click", () => openGrid(gridPage + 1));
for (const b of $("mode").children) b.addEventListener("click", () => setMode(b.dataset.mode));
$("sticker-btn").addEventListener("click", () => setPicker(picker === "sticker" ? null : "sticker"));
$("bg-btn").addEventListener("click", () => setPicker(picker === "bg" ? null : "bg"));
$("hand-btn").addEventListener("click", () => setHand(!handOn));
$("photo").addEventListener("change", async () => {
  const file = $("photo").files[0];
  $("photo").value = "";
  if (!file) return;
  try {
    bgPhoto = await loadPhoto(file);
    chooseBackground("photo");
  } catch (err) {
    console.error(err);
    showLabel("⚠️ 그 사진은 못 열었어요", 3000);
  }
});
$("retake").addEventListener("click", closeResult);
$("save").addEventListener("click", saveResult);
window.addEventListener("resize", () => gridPage >= 0 && layoutGrid());

// 맥에서는 스페이스바로 찍고, Esc로 격자를 닫는다
window.addEventListener("keydown", (e) => {
  if (!renderer || e.target.tagName === "INPUT") return;
  if (e.code === "Space") {
    e.preventDefault();
    shoot();
  } else if (e.code === "Escape" && gridPage >= 0) closeGrid();
});

if (params.has("auto")) start();
