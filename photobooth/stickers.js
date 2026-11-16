// 얼굴 스티커. 그림 파일 없이 캔버스로 직접 그린다.
// 점 번호는 MediaPipe 얼굴 그물(478점) 기준: 10 이마 위, 4 코끝, 13·14 입술 안쪽, 168 미간, 50·280 볼, 234·454 얼굴 양옆
// 각 스티커는 place(점)으로 그 점을 원점에 두고 얼굴 기울기만큼 돌린 좌표에서 그린다. 길이 1 = 얼굴 폭, 위쪽이 -y.

const TAU = Math.PI * 2;

function heart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.6, y - s * 0.05, x - s * 0.3, y - s * 0.6, x, y - s * 0.22);
  ctx.bezierCurveTo(x + s * 0.3, y - s * 0.6, x + s * 0.6, y - s * 0.05, x, y + s * 0.35);
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
}

function cat(ctx, place) {
  place(10, () => {
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#f4a259";
      ctx.beginPath();
      ctx.moveTo(s * 0.08, 0.02);
      ctx.lineTo(s * 0.33, -0.36);
      ctx.lineTo(s * 0.42, 0.06);
      ctx.fill();
      ctx.fillStyle = "#ffb3c7";
      ctx.beginPath();
      ctx.moveTo(s * 0.15, -0.01);
      ctx.lineTo(s * 0.32, -0.27);
      ctx.lineTo(s * 0.37, 0.02);
      ctx.fill();
    }
  });
  place(4, () => {
    ctx.fillStyle = "#ff7fa3";
    ctx.beginPath();
    ctx.moveTo(-0.055, -0.02);
    ctx.lineTo(0.055, -0.02);
    ctx.lineTo(0, 0.04);
    ctx.fill();
    ctx.strokeStyle = "#3a3a3a";
    ctx.lineWidth = 0.012;
    ctx.lineCap = "round";
    for (const s of [-1, 1]) {
      for (const dy of [-0.05, 0.01, 0.07]) {
        ctx.beginPath();
        ctx.moveTo(s * 0.12, 0.05);
        ctx.lineTo(s * 0.44, 0.05 + dy);
        ctx.stroke();
      }
    }
  });
}

function bunny(ctx, place) {
  place(10, () => {
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#ffffff";
      ellipse(ctx, s * 0.17, -0.4, 0.1, 0.34, s * 0.12);
      ctx.fillStyle = "#ffb3c7";
      ellipse(ctx, s * 0.17, -0.38, 0.05, 0.25, s * 0.12);
    }
  });
  place(4, () => {
    ctx.fillStyle = "#ff8fb1";
    ellipse(ctx, 0, 0, 0.05, 0.035);
  });
  // 앞니 두 개 (윗입술 아래)
  place(13, () => {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#d9d9d9";
    ctx.lineWidth = 0.006;
    for (const x of [-0.052, 0.002]) {
      ctx.beginPath();
      ctx.roundRect(x, -0.005, 0.05, 0.075, 0.012);
      ctx.fill();
      ctx.stroke();
    }
  });
}

function dog(ctx, place, face) {
  place(10, () => {
    ctx.fillStyle = "#8b5a2b";
    for (const s of [-1, 1]) ellipse(ctx, s * 0.5, 0.18, 0.13, 0.3, -s * 0.35);
  });
  place(4, () => {
    ctx.fillStyle = "#1d1d1f";
    ellipse(ctx, 0, 0, 0.085, 0.06);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ellipse(ctx, -0.025, -0.022, 0.025, 0.014);
  });
  // 입을 벌리면 혀가 나온다
  if (face.mouthOpen > 0.06) {
    place(14, () => {
      ctx.fillStyle = "#ff6b8a";
      ctx.beginPath();
      ctx.roundRect(-0.07, -0.01, 0.14, 0.2, [0, 0, 0.07, 0.07]);
      ctx.fill();
      ctx.strokeStyle = "#d94a6a";
      ctx.lineWidth = 0.01;
      ctx.beginPath();
      ctx.moveTo(0, 0.02);
      ctx.lineTo(0, 0.12);
      ctx.stroke();
    });
  }
}

function sunglasses(ctx, place) {
  place(168, () => {
    ctx.fillStyle = "rgba(15,15,20,0.92)";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 0.03;
    ctx.lineCap = "round";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(s * 0.21 - 0.17, -0.07, 0.34, 0.21, 0.08);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * 0.38, -0.04);
      ctx.lineTo(s * 0.5, -0.06);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-0.05, -0.03);
    ctx.quadraticCurveTo(0, -0.06, 0.05, -0.03);
    ctx.stroke();
    // 반짝
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 0.018;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 0.21 - 0.11, 0.0);
      ctx.lineTo(s * 0.21 - 0.05, -0.04);
      ctx.stroke();
    }
  });
}

function crown(ctx, place) {
  place(10, () => {
    const g = ctx.createLinearGradient(0, -0.42, 0, -0.06);
    g.addColorStop(0, "#ffe680");
    g.addColorStop(1, "#f0a500");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-0.3, -0.06);
    ctx.lineTo(-0.34, -0.34);
    ctx.lineTo(-0.17, -0.2);
    ctx.lineTo(0, -0.42);
    ctx.lineTo(0.17, -0.2);
    ctx.lineTo(0.34, -0.34);
    ctx.lineTo(0.3, -0.06);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e0303c";
    ellipse(ctx, 0, -0.13, 0.04, 0.04);
    ctx.fillStyle = "#3b7bff";
    for (const s of [-1, 1]) ellipse(ctx, s * 0.18, -0.11, 0.03, 0.03);
    ctx.fillStyle = "#fff6c8";
    for (const [x, y] of [[-0.34, -0.34], [0, -0.42], [0.34, -0.34]]) ellipse(ctx, x, y, 0.025, 0.025);
  });
}

function blush(ctx, place) {
  for (const p of [50, 280]) {
    place(p, () => {
      ctx.fillStyle = "rgba(255,120,150,0.35)";
      ellipse(ctx, 0, 0, 0.1, 0.06);
      ctx.fillStyle = "rgba(255,70,120,0.9)";
      heart(ctx, 0, 0, 0.11);
    });
  }
  place(10, () => {
    ctx.fillStyle = "rgba(255,90,140,0.9)";
    heart(ctx, -0.26, -0.22, 0.12);
    heart(ctx, 0, -0.34, 0.16);
    heart(ctx, 0.26, -0.22, 0.12);
  });
}

export const STICKERS = [
  { id: "none", name: "없음" },
  { id: "cat", name: "고양이", draw: cat },
  { id: "bunny", name: "토끼", draw: bunny },
  { id: "dog", name: "강아지", draw: dog },
  { id: "sunglasses", name: "선글라스", draw: sunglasses },
  { id: "crown", name: "왕관", draw: crown },
  { id: "blush", name: "하트 볼", draw: blush },
];

// landmarks: 얼굴 하나의 점들, toScreen: 점 → 화면 좌표 (좌우 반전·잘라내기 반영)
export function drawSticker(ctx, id, landmarks, toScreen) {
  const sticker = STICKERS.find((s) => s.id === id);
  if (!sticker?.draw) return;
  const at = (i) => toScreen(landmarks[i]);
  const l = at(234);
  const r = at(454);
  const size = Math.hypot(r.x - l.x, r.y - l.y);
  // 화면에서는 좌우가 바뀌어서 263(왼쪽 눈)이 화면 왼쪽
  const a = at(263);
  const b = at(33);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const lipTop = at(13);
  const lipBottom = at(14);
  const face = { size, angle, mouthOpen: Math.hypot(lipBottom.x - lipTop.x, lipBottom.y - lipTop.y) / size };

  const place = (i, fn) => {
    const p = at(i);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.scale(size, size);
    fn();
    ctx.restore();
  };
  sticker.draw(ctx, place, face);
}
