// 부메랑 움짤: 2초 동안 화면을 0.1초마다 찍어서, 앞으로 갔다 뒤로 오는 GIF로 만든다.
const GIFENC = "https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// grab(): 지금 화면이 그려진 캔버스. 긴 쪽을 maxSide로 줄여서 모은다
export async function recordFrames(grab, { count = 20, interval = 100, maxSide = 480 } = {}) {
  const frames = [];
  let ctx = null;
  const t0 = performance.now();
  for (let i = 0; i < count; i++) {
    const src = grab();
    if (!ctx) {
      const k = maxSide / Math.max(src.width, src.height);
      const small = document.createElement("canvas");
      small.width = Math.round(src.width * k);
      small.height = Math.round(src.height * k);
      ctx = small.getContext("2d", { willReadFrequently: true });
    }
    const { width, height } = ctx.canvas;
    ctx.drawImage(src, 0, 0, width, height);
    frames.push(ctx.getImageData(0, 0, width, height));
    await sleep(t0 + (i + 1) * interval - performance.now()); // 찍는 데 걸린 시간만큼 덜 기다린다
  }
  return frames;
}

export async function encodeBoomerang(frames, delay = 100) {
  const { GIFEncoder, quantize, applyPalette } = await import(GIFENC);
  const encoded = [];
  for (const f of frames) {
    const palette = quantize(f.data, 256);
    encoded.push({ palette, index: applyPalette(f.data, palette) });
    await sleep(0); // 화면이 멈춰 보이지 않게 한 장마다 쉬어 간다
  }
  const { width, height } = frames[0];
  const gif = GIFEncoder();
  // 1 2 … 20 19 … 2 → 다시 1부터 (끝 장면이 두 번 나오지 않게)
  for (const e of [...encoded, ...encoded.slice(1, -1).reverse()]) {
    gif.writeFrame(e.index, width, height, { palette: e.palette, delay });
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}
