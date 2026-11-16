// WebGL로 카메라 화면에 효과를 씌워 그린다. 효과마다 셰이더 프로그램 하나 (effects.js).
// 한 캔버스 안에서 viewport를 나눠 그려서 격자 미리보기도 같은 코드로 그린다.

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
uniform vec2 uRes;
uniform vec2 uCover;
uniform float uTime;

vec4 cam(vec2 uv) {
  vec2 t = (vec2(1.0 - uv.x, uv.y) - 0.5) * uCover + 0.5;
  if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
  return texture2D(uTex, t);
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
    programs.set(fx.id, {
      p,
      uRes: gl.getUniformLocation(p, "uRes"),
      uCover: gl.getUniformLocation(p, "uCover"),
      uTime: gl.getUniformLocation(p, "uTime"),
    });
  }

  // 화면 전체를 덮는 삼각형 두 개
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.enable(gl.SCISSOR_TEST);

  const start = performance.now();

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
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
      return true;
    },

    clear() {
      gl.scissor(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1);
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
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}
