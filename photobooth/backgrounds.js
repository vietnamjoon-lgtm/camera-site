// 배경 바꾸기용 사진. 자유롭게 쓸 수 있는 실제 사진 (출처: backgrounds/CREDITS.md).
// 처음 고를 때 한 번만 불러온다. 화면 비율에 맞게 가운데를 잘라 쓰는 건 renderer.js.
// "흐림"은 사진이 아니라 셰이더에서 카메라 화면을 흐리게 한다.

export const BACKGROUNDS = [
  { id: "none", name: "없음" },
  { id: "blur", name: "흐림" },
  { id: "space", name: "우주", file: "space.jpg" },
  { id: "sea", name: "바다", file: "sea.jpg" },
  { id: "sunset", name: "노을", file: "sunset.jpg" },
  { id: "rainbow", name: "무지개", file: "rainbow.jpg" },
  { id: "blossom", name: "벚꽃", file: "blossom.jpg" },
];

const loading = new Map();
export function loadBackground(id) {
  if (!loading.has(id)) {
    const { file } = BACKGROUNDS.find((b) => b.id === id);
    const img = new Image();
    img.src = new URL(`./backgrounds/${file}`, import.meta.url).href;
    const ready = img.decode().then(() => img);
    ready.catch(() => loading.delete(id)); // 실패하면 다음에 다시 시도
    loading.set(id, ready);
  }
  return loading.get(id);
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
