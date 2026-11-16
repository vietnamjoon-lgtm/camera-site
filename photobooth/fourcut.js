// 네 컷: 찍은 네 장을 프레임 하나에 합쳐서 이미지(캔버스)로 만든다.
// 화면 모양과 상관없이 칸 크기를 똑같이 맞추려고, 사진마다 가운데를 기준으로 칸 비율에 맞게 잘라 넣는다.

export const LAYOUTS = [
  { id: "strip", name: "세로 한 줄", cols: 1, rows: 4, cellW: 600, cellH: 450 },
  { id: "grid", name: "네모", cols: 2, rows: 2, cellW: 600, cellH: 800 },
];

// ink: 프레임 위 글자색 (프레임 색에 따라 잘 보이는 색)
export const FRAME_COLORS = [
  { id: "white", name: "흰색", bg: "#ffffff", ink: "#1d1d1f" },
  { id: "black", name: "검정", bg: "#111111", ink: "#ffffff" },
  { id: "pink", name: "핑크", bg: "#ffb6cf", ink: "#5a1030" },
  { id: "sky", name: "하늘", bg: "#a8dcff", ink: "#0b3a5c" },
  { id: "yellow", name: "노랑", bg: "#ffe66d", ink: "#4a3b00" },
  { id: "purple", name: "보라", bg: "#c9b3ff", ink: "#2b145e" },
];

const PAD = 36; // 바깥 여백
const GAP = 20; // 칸 사이
const FOOTER = 150; // 아래 날짜 들어가는 곳
const FONT = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

// 사진을 칸 비율에 맞게 가운데 기준으로 잘라서 그린다
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function dateText(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

// images: 네 장 (ImageBitmap 등 drawImage에 넣을 수 있는 것), caption: 날짜 아래 글씨 (비우면 없음)
export function composeFourCut(images, layoutId, colorId, caption = "찰칵 부스", date = new Date()) {
  const L = LAYOUTS.find((l) => l.id === layoutId);
  const C = FRAME_COLORS.find((c) => c.id === colorId);
  const canvas = document.createElement("canvas");
  canvas.width = PAD * 2 + L.cols * L.cellW + (L.cols - 1) * GAP;
  canvas.height = PAD + L.rows * L.cellH + (L.rows - 1) * GAP + FOOTER;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  images.forEach((img, i) => {
    const col = i % L.cols;
    const row = Math.floor(i / L.cols);
    drawCover(ctx, img, PAD + col * (L.cellW + GAP), PAD + row * (L.cellH + GAP), L.cellW, L.cellH);
  });

  const footerTop = canvas.height - FOOTER;
  ctx.fillStyle = C.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 46px ${FONT}`;
  ctx.fillText(dateText(date), canvas.width / 2, footerTop + FOOTER * 0.42);
  ctx.globalAlpha = 0.75;
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText(caption.trim(), canvas.width / 2, footerTop + FOOTER * 0.74, canvas.width - PAD * 2);
  ctx.globalAlpha = 1;

  return canvas;
}
