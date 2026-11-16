// 배경 바꾸기용 그림. 파일 없이 캔버스로 그린다 (정사각형 → 화면 비율에 맞게 가운데를 잘라 씀).
// "흐림"은 그림이 아니라 셰이더에서 카메라 화면을 흐리게 한다 (renderer.js).

const S = 1024;

// 별 위치가 매번 같도록 고정된 난수
function random(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

function linear(ctx, stops, y0 = 0, y1 = S) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([at, color]) => g.addColorStop(at, color));
  return g;
}

function circle(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function space(ctx) {
  ctx.fillStyle = linear(ctx, [[0, "#0b0630"], [1, "#1d0b4a"]]);
  ctx.fillRect(0, 0, S, S);
  for (const [x, y, r, c] of [[0.3, 0.35, 0.45, "rgba(180,80,255,0.35)"], [0.75, 0.7, 0.4, "rgba(60,160,255,0.25)"]]) {
    const g = ctx.createRadialGradient(x * S, y * S, 0, x * S, y * S, r * S);
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  const rand = random(7);
  for (let i = 0; i < 320; i++) circle(ctx, rand() * S, rand() * S, 0.5 + rand() * 1.8, `rgba(255,255,255,${0.4 + rand() * 0.6})`);
  // 고리 행성
  const pg = ctx.createLinearGradient(700, 160, 900, 360);
  pg.addColorStop(0, "#ffc46b");
  pg.addColorStop(1, "#e0663a");
  circle(ctx, 800, 260, 100, pg);
  ctx.strokeStyle = "rgba(255,220,170,0.8)";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.ellipse(800, 260, 170, 40, -0.4, 0, Math.PI * 2);
  ctx.stroke();
}

function sea(ctx) {
  ctx.fillStyle = linear(ctx, [[0, "#6fc2ff"], [0.55, "#d7f0ff"]], 0, 0.56 * S);
  ctx.fillRect(0, 0, S, 0.56 * S);
  circle(ctx, 0.5 * S, 0.42 * S, 70, "#fff6c8");
  ctx.fillStyle = linear(ctx, [[0, "#2a9be0"], [1, "#0b5f9e"]], 0.55 * S, 0.86 * S);
  ctx.fillRect(0, 0.55 * S, S, 0.33 * S);
  const rand = random(3);
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (let i = 0; i < 40; i++) {
    const x = rand() * S;
    const y = (0.58 + rand() * 0.26) * S;
    const w = 20 + rand() * 50;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - 8, x + w, y);
    ctx.stroke();
  }
  ctx.fillStyle = "#f2d7a0";
  ctx.beginPath();
  ctx.moveTo(0, 0.88 * S);
  ctx.bezierCurveTo(0.3 * S, 0.84 * S, 0.6 * S, 0.9 * S, S, 0.85 * S);
  ctx.lineTo(S, S);
  ctx.lineTo(0, S);
  ctx.fill();
}

function sunset(ctx) {
  ctx.fillStyle = linear(ctx, [[0, "#2d1b4e"], [0.45, "#c0396b"], [0.7, "#ff8a4c"], [0.85, "#ffd17a"]]);
  ctx.fillRect(0, 0, S, S);
  circle(ctx, 0.5 * S, 0.74 * S, 130, "#ffe5a0");
  for (const [y, color] of [[0.76, "#3d1f4f"], [0.84, "#2a1638"]]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, y * S);
    for (let x = 0; x <= S; x += 64) ctx.lineTo(x, y * S - Math.sin(x / 140 + y * 9) * 40);
    ctx.lineTo(S, S);
    ctx.lineTo(0, S);
    ctx.fill();
  }
}

function rainbow(ctx) {
  ctx.fillStyle = linear(ctx, [[0, "#9fd8ff"], [1, "#eaf7ff"]]);
  ctx.fillRect(0, 0, S, S);
  const colors = ["#ff5a5a", "#ff9f43", "#ffd93d", "#6bd66b", "#4fa8ff", "#5b6cff", "#a66bff"];
  ctx.lineWidth = 36;
  colors.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.arc(0.5 * S, 1.02 * S, 0.62 * S - i * 36, Math.PI, 0);
    ctx.stroke();
  });
  const cloud = (x, y, k) => {
    for (const [dx, dy, r] of [[0, 0, 60], [60, -25, 70], [125, 0, 60], [60, 20, 60]]) circle(ctx, x + dx * k, y + dy * k, r * k, "#ffffff");
  };
  cloud(0.05 * S, 0.95 * S, 1.2);
  cloud(0.78 * S, 0.95 * S, 1.2);
  cloud(0.12 * S, 0.18 * S, 0.7);
}

function pink(ctx) {
  ctx.fillStyle = linear(ctx, [[0, "#ffe0ec"], [1, "#ffc2d6"]]);
  ctx.fillRect(0, 0, S, S);
}

export const BACKGROUNDS = [
  { id: "none", name: "없음" },
  { id: "blur", name: "흐림" },
  { id: "space", name: "우주", paint: space },
  { id: "sea", name: "바다", paint: sea },
  { id: "sunset", name: "노을", paint: sunset },
  { id: "rainbow", name: "무지개", paint: rainbow },
  { id: "pink", name: "분홍", paint: pink },
];

const painted = new Map();
export function paintBackground(id) {
  if (!painted.has(id)) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = S;
    BACKGROUNDS.find((b) => b.id === id).paint(canvas.getContext("2d"));
    painted.set(id, canvas);
  }
  return painted.get(id);
}

// 기기에서 고른 사진을 배경으로 (너무 크면 줄인다)
export async function loadPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * k);
    canvas.height = Math.round(img.naturalHeight * k);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
