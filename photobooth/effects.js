// 포토부스 효과 목록. 효과 하나 = GLSL 몇 줄.
// 각 효과의 code는 `vec4 effect(vec2 uv)` 함수 본문이다. uv는 화면 좌표(0~1, 왼쪽 아래가 0).
// renderer.js가 아래 도구를 넣어 준다:
//   cam(uv)        카메라 색 (거울 반전·화면 꽉 채우기 적용됨, 화면 밖은 검정)
//   toQ(uv)/fromQ  화면 중심 기준 좌표로 바꾸기 (짧은 변 = 1이라 원이 찌그러지지 않음)
//   luma(c)        밝기
//   edge(uv)       윤곽선 세기 (0~1)
//   uTime          초, uRes 화면 크기(px)

export const EFFECTS = [
  // ---------- 1페이지 ----------
  { id: "original", name: "원본", code: `return cam(uv);` },
  {
    id: "bulge",
    name: "볼록 렌즈",
    code: `
      vec2 q = toQ(uv);
      float r = length(q) / 0.5;
      if (r < 1.0) q *= 1.0 - 0.6 * (1.0 - r) * (1.0 - r);
      return cam(fromQ(q));`,
  },
  {
    id: "pinch",
    name: "오목 렌즈",
    code: `
      vec2 q = toQ(uv);
      float r = length(q) / 0.5;
      if (r < 1.0) q *= 1.0 + 0.8 * (1.0 - r) * (1.0 - r);
      return cam(fromQ(q));`,
  },
  {
    id: "twirl",
    name: "소용돌이",
    code: `
      vec2 q = toQ(uv);
      float r = length(q) / 0.55;
      if (r < 1.0) {
        float a = 3.0 * (1.0 - r) * (1.0 - r);
        q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
      }
      return cam(fromQ(q));`,
  },
  {
    id: "mirror-x",
    name: "좌우 거울",
    code: `return cam(vec2(uv.x > 0.5 ? 1.0 - uv.x : uv.x, uv.y));`,
  },
  {
    id: "mirror-y",
    name: "상하 거울",
    code: `return cam(vec2(uv.x, uv.y < 0.5 ? 1.0 - uv.y : uv.y));`,
  },
  {
    id: "stretch-x",
    name: "가로 늘리기",
    code: `return cam(vec2(0.5 + (uv.x - 0.5) * 0.5, uv.y));`,
  },
  {
    id: "stretch-y",
    name: "세로 늘리기",
    code: `return cam(vec2(uv.x, 0.5 + (uv.y - 0.5) * 0.5));`,
  },
  {
    id: "wave",
    name: "물결",
    code: `return cam(uv + vec2(0.025 * sin(uv.y * 22.0 + uTime * 3.0), 0.0));`,
  },

  // ---------- 2페이지 ----------
  {
    id: "fisheye",
    name: "어안 렌즈",
    code: `
      vec2 q = toQ(uv);
      float r = length(q);
      if (r > 0.0) q *= tan(r * 1.4) / (r * 1.4);
      return cam(fromQ(q));`,
  },
  {
    id: "mono",
    name: "흑백",
    code: `
      float l = luma(cam(uv).rgb);
      l = clamp((l - 0.5) * 1.2 + 0.5, 0.0, 1.0);
      return vec4(vec3(l), 1.0);`,
  },
  {
    id: "sepia",
    name: "세피아",
    code: `
      vec3 c = cam(uv).rgb;
      return vec4(
        dot(c, vec3(0.393, 0.769, 0.189)),
        dot(c, vec3(0.349, 0.686, 0.168)),
        dot(c, vec3(0.272, 0.534, 0.131)), 1.0);`,
  },
  {
    id: "comic",
    name: "만화",
    code: `
      vec3 c = floor(cam(uv).rgb * 4.0 + 0.5) / 4.0;
      return vec4(c * (1.0 - smoothstep(0.15, 0.35, edge(uv))), 1.0);`,
  },
  {
    id: "thermal",
    name: "열화상",
    code: `
      float l = luma(cam(uv).rgb);
      vec3 c = l < 0.25 ? mix(vec3(0.0, 0.0, 0.3), vec3(0.5, 0.0, 0.7), l / 0.25)
             : l < 0.5  ? mix(vec3(0.5, 0.0, 0.7), vec3(0.95, 0.1, 0.1), (l - 0.25) / 0.25)
             : l < 0.75 ? mix(vec3(0.95, 0.1, 0.1), vec3(1.0, 0.85, 0.0), (l - 0.5) / 0.25)
             :            mix(vec3(1.0, 0.85, 0.0), vec3(1.0), (l - 0.75) / 0.25);
      return vec4(c, 1.0);`,
  },
  {
    id: "pixel",
    name: "픽셀",
    code: `
      vec2 cells = vec2(uRes.x / uRes.y, 1.0) * 40.0;
      vec2 p = (floor(uv * cells) + 0.5) / cells;
      return vec4(floor(cam(p).rgb * 6.0 + 0.5) / 6.0, 1.0);`,
  },
  {
    id: "pop",
    name: "팝아트",
    code: `
      vec2 tile = floor(uv * 2.0);
      float l = floor(luma(cam(fract(uv * 2.0)).rgb) * 3.0 + 0.5) / 3.0;
      vec3 ink = tile.x == 0.0
        ? (tile.y == 0.0 ? vec3(1.0, 0.2, 0.55) : vec3(0.1, 0.8, 1.0))
        : (tile.y == 0.0 ? vec3(1.0, 0.85, 0.1) : vec3(0.45, 1.0, 0.3));
      return vec4(mix(ink * 0.25, ink, l), 1.0);`,
  },
  {
    id: "neon",
    name: "네온 윤곽선",
    code: `
      float e = smoothstep(0.1, 0.4, edge(uv));
      vec3 hue = 0.5 + 0.5 * cos(6.2832 * (uv.x + uv.y * 0.5 + uTime * 0.2 + vec3(0.0, 0.33, 0.67)));
      return vec4(hue * e * 1.4, 1.0);`,
  },
  {
    id: "invert",
    name: "색 반전",
    code: `return vec4(1.0 - cam(uv).rgb, 1.0);`,
  },
];

export const PAGE_SIZE = 9;
