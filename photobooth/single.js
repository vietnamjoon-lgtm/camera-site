// 한 장 꾸미기. 폴라로이드(정사각형 사진 + 아래 넓은 여백에 날짜·글씨) 또는
// 필름 날짜(사진 그대로 + 옛날 필름 카메라처럼 오른쪽 아래 주황 날짜)
import { FRAME_COLORS, FONT, drawCover, dateText, fillFrame } from "./fourcut.js";

export const SINGLE_LAYOUTS = [
  { id: "polaroid", name: "폴라로이드" },
  { id: "film", name: "필름 날짜" },
];

const SIDE = 60; // 폴라로이드 옆·위 여백
const PHOTO = 1080; // 정사각형 사진 한 변
const BOTTOM = 280; // 아래 넓은 여백

function polaroid(image, colorId, caption, date) {
  const C = FRAME_COLORS.find((c) => c.id === colorId);
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO + SIDE * 2;
  canvas.height = SIDE + PHOTO + BOTTOM;
  const ctx = canvas.getContext("2d");
  fillFrame(ctx, C, canvas.width, canvas.height);
  drawCover(ctx, image, SIDE, SIDE, PHOTO, PHOTO);

  const top = SIDE + PHOTO;
  ctx.fillStyle = C.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 56px ${FONT}`;
  ctx.fillText(dateText(date), canvas.width / 2, top + BOTTOM * 0.4);
  ctx.globalAlpha = 0.75;
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText(caption.trim(), canvas.width / 2, top + BOTTOM * 0.68, canvas.width - SIDE * 2);
  ctx.globalAlpha = 1;
  return canvas;
}

function filmDate(image, date) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);

  const p = (n) => String(n).padStart(2, "0");
  const text = `'${p(date.getFullYear() % 100)} ${p(date.getMonth() + 1)} ${p(date.getDate())}`;
  const size = Math.round(Math.min(canvas.width, canvas.height) * 0.06);
  ctx.font = `700 ${size}px "DIN Alternate", "Courier New", monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  const x = canvas.width - size * 1.1;
  const y = canvas.height - size * 1.1;
  // 번진 빛을 먼저 깔고 그 위에 글자
  ctx.fillStyle = "#ff8a2a";
  ctx.shadowColor = "rgba(255, 110, 20, 0.9)";
  ctx.shadowBlur = size * 0.5;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffb15c";
  ctx.fillText(text, x, y);
  return canvas;
}

export function composeSingle(image, layoutId, colorId, caption = "찰칵 부스", date = new Date()) {
  return layoutId === "film" ? filmDate(image, date) : polaroid(image, colorId, caption, date);
}
