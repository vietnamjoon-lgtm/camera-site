// 화면에 보여 줄 때만 쓰는 "진짜 인화지" 느낌: 종이 결, 살짝 누런 종이색, 위에서 비치는 광택,
// 가장자리가 조금 어두운 빛, 종이 끝 선. 저장되는 사진에는 넣지 않는다.

// 종이 결 (밝은 회색 점들). 한 번만 만들어 두고 늘려서 쓴다
let grainTile = null;
function grain() {
  if (grainTile) return grainTile;
  grainTile = document.createElement("canvas");
  grainTile.width = grainTile.height = 96;
  const ctx = grainTile.getContext("2d");
  const pixels = ctx.createImageData(96, 96);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i + 1] = d[i + 2] = 228 + Math.random() * 27;
    d[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return grainTile;
}

// src(캔버스나 그림)에 인화지 느낌을 입힌 새 캔버스를 돌려준다
export function printLook(src) {
  const w = src.width;
  const h = src.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(src, 0, 0);

  ctx.globalCompositeOperation = "multiply";
  // 새하얀 화면색 대신 살짝 따뜻한 종이색
  ctx.fillStyle = "#fbf8f1";
  ctx.fillRect(0, 0, w, h);
  // 종이 결: 화면에서 1~2px로 보이게 사진 크기에 맞춰 늘린다
  const k = Math.max(1.5, w / 360);
  ctx.globalAlpha = 0.35;
  ctx.save();
  ctx.scale(k, k);
  ctx.fillStyle = ctx.createPattern(grain(), "repeat");
  ctx.fillRect(0, 0, w / k, h / k);
  ctx.restore();
  ctx.globalAlpha = 1;
  // 가운데보다 가장자리가 조금 어둡다
  const r = Math.hypot(w, h) / 2;
  const edge = ctx.createRadialGradient(w / 2, h * 0.4, r * 0.45, w / 2, h * 0.4, r);
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.07)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);

  // 위쪽 조명이 비스듬히 비치는 광택 한 줄기
  ctx.globalCompositeOperation = "screen";
  const gloss = ctx.createLinearGradient(0, 0, w, h * 0.7);
  gloss.addColorStop(0.18, "rgba(255,255,255,0)");
  gloss.addColorStop(0.34, "rgba(255,255,255,0.16)");
  gloss.addColorStop(0.42, "rgba(255,255,255,0.05)");
  gloss.addColorStop(0.6, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, w, h);

  // 종이 끝 선 (가장자리가 배경에 묻히지 않게)
  ctx.globalCompositeOperation = "source-over";
  const line = Math.max(1, w / 500);
  ctx.strokeStyle = "rgba(0,0,0,0.14)";
  ctx.lineWidth = line;
  ctx.strokeRect(line / 2, line / 2, w - line, h - line);
  return canvas;
}
