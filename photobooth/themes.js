// 사진관 테마. 모드(한 장 · 네 컷 · 움짤)를 누를 때마다 이 중 하나가 랜덤으로 걸린다.
// 바탕 · 글씨 · 조명 · 금속(셔터 · 버튼) · 제목 글꼴, 그리고 포토카드 금속 박 테두리가 다 같이 바뀐다.
// 색 이름은 style.css의 변수와 같다. metal은 금속 면에 비스듬히 지나가는 빛 네 개 (포토카드 테두리도 이 색)

export const THEMES = [
  {
    id: "gold", name: "골드",
    bg: "#1b130c", surface: "#2b2016", surfaceHi: "#3a2c1f", ink: "#f4e9d4",
    metal: ["#fbeecb", "#c9a15a", "#ebd39b", "#ad8642"], silver: "#d9b46c", tint: "#f4e4bf",
    glow: "rgba(240, 186, 100, 0.24)", frameInk: "#4a3510",
    display: '"Gowun Batang", "Apple SD Gothic Neo", serif', weight: 700, track: "0.04em",
  },
  {
    id: "silver", name: "실버",
    bg: "#120d10", surface: "#1e171b", surfaceHi: "#2a2125", ink: "#ecebf0",
    metal: ["#eef0f4", "#b9bec8", "#d9dce2", "#a9aeb8"], silver: "#c8ccd4", tint: "#ecebf0",
    glow: "rgba(214, 220, 232, 0.12)", frameInk: "#26282e",
    display: '"Black Han Sans", "Apple SD Gothic Neo", sans-serif', weight: 400, track: "0.02em",
  },
  {
    id: "rose", name: "로즈골드",
    bg: "#170f22", surface: "#261a36", surfaceHi: "#33244a", ink: "#f8e9f1",
    metal: ["#fbe2dd", "#c98884", "#eec3bc", "#ad6e6b"], silver: "#dda39c", tint: "#f6d8d3",
    glow: "rgba(255, 120, 175, 0.26)", frameInk: "#5a2a2a",
    display: '"Jua", "Apple SD Gothic Neo", sans-serif', weight: 400, track: "0.02em",
  },
  {
    id: "mint", name: "민트",
    bg: "#0b1a1a", surface: "#132828", surfaceHi: "#1c3636", ink: "#e6f7f2",
    metal: ["#e3fbf3", "#7fc9b5", "#c4efe2", "#5fae9a"], silver: "#8fdcc6", tint: "#d3f5ea",
    glow: "rgba(110, 230, 200, 0.22)", frameInk: "#123f35",
    display: '"Do Hyeon", "Apple SD Gothic Neo", sans-serif', weight: 400, track: "0.03em",
  },
  {
    id: "cherry", name: "체리",
    bg: "#1d0a0d", surface: "#2f1418", surfaceHi: "#3f1d22", ink: "#fbe9e6",
    metal: ["#ffd9d6", "#d9534f", "#f3a6a0", "#b23a37"], silver: "#f08a84", tint: "#fbd5d1",
    glow: "rgba(255, 90, 90, 0.22)", frameInk: "#4d0f12",
    display: '"Gaegu", "Apple SD Gothic Neo", sans-serif', weight: 700, track: "0.02em",
  },
  {
    id: "navy", name: "딥블루",
    bg: "#0a0f1f", surface: "#141b31", surfaceHi: "#1d2642", ink: "#e7edff",
    metal: ["#e3ebff", "#7d93d6", "#c3d0f5", "#5d73b8"], silver: "#9db1ee", tint: "#d8e2ff",
    glow: "rgba(110, 150, 255, 0.24)", frameInk: "#14204a",
    display: '"Song Myung", "Apple SD Gothic Neo", serif', weight: 400, track: "0.04em",
  },
  {
    id: "forest", name: "숲",
    bg: "#0e150d", surface: "#1a2418", surfaceHi: "#243222", ink: "#eef3e3",
    metal: ["#eef3d0", "#9fb06a", "#d9e3ae", "#7d8f4c"], silver: "#bccb8c", tint: "#e5edc6",
    glow: "rgba(190, 220, 120, 0.2)", frameInk: "#2a3514",
    display: '"Gowun Dodum", "Apple SD Gothic Neo", sans-serif', weight: 400, track: "0.03em",
  },
];

// 지금 걸린 것과 다른 테마 하나를 고른다
export function randomTheme(current) {
  const others = THEMES.filter((t) => t !== current);
  return others[Math.floor(Math.random() * others.length)];
}

export function applyTheme(t) {
  const set = (name, value) => document.documentElement.style.setProperty(name, value);
  set("--bg", t.bg);
  set("--surface", t.surface);
  set("--surface-hi", t.surfaceHi);
  set("--ink", t.ink);
  t.metal.forEach((c, i) => set(`--m${i + 1}`, c));
  set("--silver", t.silver);
  set("--tint", t.tint);
  set("--glow", t.glow);
  set("--display", t.display);
  set("--display-weight", t.weight);
  set("--display-track", t.track);
  document.querySelector('meta[name="theme-color"]').content = t.bg; // 폰 위쪽 상태 표시줄 색
}
