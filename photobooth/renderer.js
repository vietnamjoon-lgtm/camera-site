// WebGL로 카메라 화면에 효과를 씌워 그린다. 효과마다 셰이더 프로그램 하나 (effects.js).
// 한 캔버스 안에서 viewport를 나눠 그려서 격자 미리보기도 같은 코드로 그린다.
// 배경 바꾸기를 켜면 cam()이 사람 마스크로 카메라와 배경을 섞어 주므로, 효과는 섞인 화면에 씌워진다.

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// 모든 효과가 함께 쓰는 도구 (effects.js 맨 위 설명 참고)
const HEADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform sampler2D uMask;
uniform sampler2D uBg;
uniform float uBgMode; // 0 그대로, 1 배경 흐림, 2 배경 그림
uniform vec2 uBgCover;
uniform vec2 uRes;
uniform vec2 uCover;
uniform float uTime;

vec3 blurCam(vec2 t) {
  vec3 s = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    vec2 o = vec2(cos(float(i) * 0.5236), sin(float(i) * 0.5236));
    s += texture2D(uTex, t + o * 0.02).rgb + texture2D(uTex, t + o * 0.045).rgb;
  }
  return s / 24.0;
}

vec4 cam(vec2 uv) {
  vec2 t = (vec2(1.0 - uv.x, uv.y) - 0.5) * uCover + 0.5;
  if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
  vec4 c = texture2D(uTex, t);
  if (uBgMode < 0.5) return c;
  float person = smoothstep(0.35, 0.65, texture2D(uMask, t).r);
  vec3 bg = uBgMode < 1.5 ? blurCam(t) : texture2D(uBg, (uv - 0.5) * uBgCover + 0.5).rgb;
  return vec4(mix(bg, c.rgb, person), 1.0);
}

vec2 qScale() { return uRes / min(uRes.x, uRes.y); }
vec2 toQ(vec2 uv) { return (uv - 0.5) * qScale(); }
vec2 fromQ(vec2 q) { return q / qScale() + 0.5; }

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

float edge(vec2 uv) {
  vec2 d = 1.5 / uRes;
  float tl = luma(cam(uv + vec2(-d.x, d.y)).rgb), t = luma(cam(uv + vec2(0.0, d.y)).rgb);
  float tr = luma(cam(uv + d).rgb), l = luma(cam(uv - vec2(d.x, 0.0)).rgb);
  float r = luma(cam(uv + vec2(d.x, 0.0)).rgb), bl = luma(cam(uv - d).rgb);
  float b = luma(cam(uv - vec2(0.0, d.y)).rgb), br = luma(cam(uv + vec2(d.x, -d.y)).rgb);
  float gx = tr + 2.0 * r + br - tl - 2.0 * l - bl;
  float gy = tl + 2.0 * t + tr - bl - 2.0 * b - br;
  return clamp(length(vec2(gx, gy)), 0.0, 1.0);
}
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export function createRenderer(canvas, video, effects) {
  // preserveDrawingBuffer: 셔터를 누른 순간 그린 화면을 그대로 사진으로 꺼내기 위해
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, antialias: false });
  if (!gl) throw new Error("이 기기는 WebGL을 지원하지 않아요");

  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const programs = new Map();
  for (const fx of effects) {
    const fs = compile(gl, gl.FRAGMENT_SHADER, `${HEADER}\nvec4 effect(vec2 uv) {${fx.code}\n}\nvoid main() { gl_FragColor = effect(vUv); }`);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`${fx.id}: ${gl.getProgramInfoLog(p)}`);
    const u = (name) => gl.getUniformLocation(p, name);
    gl.useProgram(p);
    gl.uniform1i(u("uTex"), 0);
    gl.uniform1i(u("uMask"), 1);
    gl.uniform1i(u("uBg"), 2);
    programs.set(fx.id, {
      p,
      uRes: u("uRes"),
      uCover: u("uCover"),
      uTime: u("uTime"),
      uBgMode: u("uBgMode"),
      uBgCover: u("uBgCover"),
    });
  }

  // 화면 전체를 덮는 삼각형 두 개
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // 텍스처 칸 0: 카메라, 1: 사람 마스크, 2: 배경 그림. 처음엔 까만 1×1로 채워 둔다
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  for (let unit = 0; unit < 3; unit++) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  }
  gl.enable(gl.SCISSOR_TEST);

  const uploadTo = (unit, format, source) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, format, gl.UNSIGNED_BYTE, source);
  };

  const start = performance.now();
  let bgMode = 0;
  let bgAspect = 1;

  return {
    gl,

    // 캔버스 크기를 화면에 맞춘다 (선명도와 속도 사이에서 기기 배율은 2까지만)
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      return dpr;
    },

    // 카메라의 지금 프레임을 텍스처로 올린다. 프레임마다 한 번.
    upload() {
      if (video.readyState < 2) return false;
      uploadTo(0, gl.RGB, video);
      return true;
    },

    // 사람 마스크 (vision.js가 만든 그림, 카메라 원본과 같은 방향)
    setMask(source) {
      uploadTo(1, gl.RGBA, source);
    },

    // mode: "off" | "blur" | "image" (image는 그 그림을 배경으로)
    setBackground(mode, image) {
      bgMode = { off: 0, blur: 1, image: 2 }[mode];
      if (mode === "image") {
        uploadTo(2, gl.RGB, image);
        bgAspect = (image.naturalWidth || image.width) / (image.naturalHeight || image.height);
      }
    },

    // 칸 사이 틈 색 (0~1)
    clear([r, g, b] = [0, 0, 0]) {
      gl.scissor(0, 0, canvas.width, canvas.height);
      gl.clearColor(r, g, b, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },

    // 효과 하나를 캔버스의 (x, y, w, h) 칸에 그린다. y는 아래쪽 기준 (WebGL 좌표)
    draw(id, x, y, w, h) {
      const prog = programs.get(id);
      const va = video.videoWidth / video.videoHeight || 1;
      const ca = w / h;
      gl.viewport(x, y, w, h);
      gl.scissor(x, y, w, h);
      gl.useProgram(prog.p);
      gl.uniform2f(prog.uRes, w, h);
      // 화면을 꽉 채우도록 카메라 화면의 남는 쪽을 잘라낸다
      gl.uniform2f(prog.uCover, ca > va ? 1 : ca / va, ca > va ? va / ca : 1);
      gl.uniform1f(prog.uTime, (performance.now() - start) / 1000);
      gl.uniform1f(prog.uBgMode, bgMode);
      gl.uniform2f(prog.uBgCover, ca > bgAspect ? 1 : ca / bgAspect, ca > bgAspect ? bgAspect / ca : 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}
