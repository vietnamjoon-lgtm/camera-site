// 입장 화면에 걸어 두는 견본 (한 장: 폴라로이드, 네 컷: 네 컷, 움짤: 움직이는 부메랑 사진).
// 이 앱이 실제로 만드는 것(배경 + 스티커 + 네 컷·폴라로이드)으로 그린다.
// 사람 대신 까만 실루엣을 세우고, 스티커는 실루엣 얼굴 위치에 맞춘 가짜 얼굴 점으로 붙인다.
import { paintBackground } from "./backgrounds.js";
import { drawSticker } from "./stickers.js";
import { composeFourCut, drawCover } from "./fourcut.js";
import { composeSingle } from "./single.js";

const W = 600;
const H = 450;

// 실루엣 얼굴의 점 (stickers.js가 쓰는 번호만). 263이 화면 왼쪽 눈
const FACE = {
  10: [300, 158], 168: [300, 228], 4: [300, 266], 13: [300, 296], 14: [300, 299],
  50: [248, 282], 280: [352, 282], 263: [258, 230], 33: [342, 230], 234: [216, 250], 454: [384, 250],
};
const landmarks = [];
for (const [i, [x, y]] of Object.entries(FACE)) landmarks[i] = { x, y };

const FRAMES = [
  { bg: "sea", sticker: "blush", tilt: -0.06 },
  { bg: "sunset", sticker: "cat", tilt: 0.1 },
  { bg: "pink", sticker: "bunny", tilt: -0.12 },
  { bg: "rainbow", sticker: "crown", tilt: 0.04 },
];

// w×h 사진 한 칸. 실루엣은 아래 가운데에 서고, bob만큼 위아래로 움직인다
function frame({ bg, sticker, tilt, bob = 0 }, w = W, h = H) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  drawCover(ctx, paintBackground(bg), 0, 0, w, h);
  ctx.translate((w - W) / 2, h - H + bob);

  // 실루엣과 스티커를 같이 기울인다 (어깨 가운데 기준)
  const cx = 300;
  const cy = 420;
  const rotate = (p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: cx + dx * Math.cos(tilt) - dy * Math.sin(tilt), y: cy + dx * Math.sin(tilt) + dy * Math.cos(tilt) };
  };
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = "#241a1f"; // 실루엣은 바탕과 어울리는 짙은 와인색
  ctx.beginPath();
  ctx.ellipse(300, 240, 84, 104, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(268, 320, 64, 50);
  ctx.beginPath();
  ctx.moveTo(90, H + 20);
  ctx.quadraticCurveTo(110, 360, 300, 352);
  ctx.quadraticCurveTo(490, 360, 510, H + 20);
  ctx.fill();
  ctx.restore();

  drawSticker(ctx, sticker, landmarks, rotate);
  return canvas;
}

export function makeSampleStrip() {
  return composeFourCut(FRAMES.map((f) => frame(f)), "strip", "white", "찰칵 부스");
}

export function makeSamplePolaroid() {
  return composeSingle(frame({ bg: "pink", sticker: "dog", tilt: 0.06 }), "polaroid", "white", "찰칵 부스");
}

// 움짤 견본: 고개를 왼쪽에서 오른쪽으로 까딱이는 20장 (앱 움짤처럼 0.1초 간격, 부메랑으로 돌린다).
// 테두리는 얇게만 둬서 폴라로이드와 구별한다
export const GIF_FRAME_MS = 100;
export function makeSampleGifFrames() {
  const count = 20;
  const border = 20;
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const photo = frame({ bg: "rainbow", sticker: "bunny", tilt: -0.14 + t * 0.28, bob: -14 * Math.sin(t * Math.PI) }, 450, 600);
    const card = document.createElement("canvas");
    card.width = photo.width + border * 2;
    card.height = photo.height + border * 2;
    const ctx = card.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, card.width, card.height);
    ctx.drawImage(photo, border, border);
    return card;
  });
}
