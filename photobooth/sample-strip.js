// 입장 화면에 걸어 두는 견본 (한 장: 폴라로이드, 네 컷: 네 컷, 움짤: 움직이는 사진).
// 배경 바꾸기에 쓰는 실제 풍경 사진을 이 앱의 네 컷·폴라로이드 틀에 넣어서 만든다.
// 틀은 모드 테마와 같은 금속 박 (한 장 골드, 네 컷 실버, 움짤 로즈골드).
import { loadBackground } from "./backgrounds.js";
import { FRAME_COLORS, composeFourCut, drawCover, fillFrame } from "./fourcut.js";
import { composeSingle } from "./single.js";

// w×h 칸에 사진을 가운데 기준으로 채운다. zoom만큼 더 당겨 보고, panX(-1~1)만큼 옆으로 옮긴다
function crop(img, w, h, zoom = 1, panX = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (zoom === 1 && panX === 0) {
    drawCover(ctx, img, 0, 0, w, h);
    return canvas;
  }
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih) * zoom;
  const sw = w / scale;
  const sh = h / scale;
  const sx = (iw - sw) / 2 + panX * ((iw - sw) / 2);
  ctx.drawImage(img, sx, (ih - sh) / 2, sw, sh, 0, 0, w, h);
  return canvas;
}

export async function makeSampleStrip() {
  const photos = await Promise.all(["sea", "sunset", "space", "rainbow"].map(loadBackground));
  return composeFourCut(photos.map((p) => crop(p, 600, 450)), "strip", "silver", "찰칵 부스");
}

export async function makeSamplePolaroid() {
  return composeSingle(crop(await loadBackground("blossom"), 1080, 1080), "polaroid", "gold", "찰칵 부스");
}

// 움짤 견본: 노을 사진을 천천히 당겨 보며 옆으로 흘러가는 20장 (앱 움짤처럼 0.1초 간격, 부메랑으로 돌린다).
// 테두리는 얇게만 둬서 폴라로이드와 구별한다
export const GIF_FRAME_MS = 100;
const ROSE = FRAME_COLORS.find((c) => c.id === "rose");
export async function makeSampleGifFrames() {
  const img = await loadBackground("sunset");
  const count = 20;
  const border = 20;
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const photo = crop(img, 450, 600, 1 + 0.12 * t, -0.25 + 0.5 * t);
    const card = document.createElement("canvas");
    card.width = photo.width + border * 2;
    card.height = photo.height + border * 2;
    const ctx = card.getContext("2d");
    fillFrame(ctx, ROSE, card.width, card.height);
    ctx.drawImage(photo, border, border);
    return card;
  });
}
