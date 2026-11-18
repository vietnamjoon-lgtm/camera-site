// 얼굴 찾기(스티커용), 사람/배경 나누기(배경용), 손 모양 알아보기(손으로 찍기용).
// 구글 MediaPipe를 쓰고, 처음 켤 때만 내려받는다.
const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35";
const MODELS = "https://storage.googleapis.com/mediapipe-models";

let filesetPromise = null;
function fileset() {
  filesetPromise ??= import(`${MP}/vision_bundle.mjs`).then(async (mp) => ({
    mp,
    files: await mp.FilesetResolver.forVisionTasks(`${MP}/wasm`),
  }));
  return filesetPromise;
}

// 그래픽 칩(GPU)으로 먼저 해 보고, 안 되는 기기면 CPU로
async function create(Task, files, options) {
  try {
    return await Task.createFromOptions(files, { ...options, baseOptions: { ...options.baseOptions, delegate: "GPU" } });
  } catch {
    return Task.createFromOptions(files, { ...options, baseOptions: { ...options.baseOptions, delegate: "CPU" } });
  }
}

export async function createFaceTracker() {
  const { mp, files } = await fileset();
  const landmarker = await create(mp.FaceLandmarker, files, {
    baseOptions: { modelAssetPath: `${MODELS}/face_landmarker/face_landmarker/float16/1/face_landmarker.task` },
    runningMode: "VIDEO",
    numFaces: 4,
  });
  return {
    // 얼굴마다 점 478개 (0~1, 카메라 원본 기준 — 좌우 반전 전)
    detect(video, time) {
      return landmarker.detectForVideo(video, time).faceLandmarks;
    },
  };
}

export async function createGestureRecognizer() {
  const { mp, files } = await fileset();
  const recognizer = await create(mp.GestureRecognizer, files, {
    baseOptions: { modelAssetPath: `${MODELS}/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task` },
    runningMode: "VIDEO",
    numHands: 2,
  });
  return {
    // 화면 속 누군가 손바닥을 펴서 보이고 있는지 (브이·엄지척은 아님)
    openPalm(video, time) {
      return recognizer
        .recognizeForVideo(video, time)
        .gestures.some((g) => g[0]?.categoryName === "Open_Palm" && g[0].score > 0.6);
    },
  };
}

export async function createSegmenter() {
  const { mp, files } = await fileset();
  const segmenter = await create(mp.ImageSegmenter, files, {
    baseOptions: { modelAssetPath: `${MODELS}/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite` },
    runningMode: "VIDEO",
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });

  // 작게 줄인 카메라 화면을 넣어서 빠르게 돌린다
  const input = document.createElement("canvas");
  const inputCtx = input.getContext("2d");
  const out = document.createElement("canvas");
  const outCtx = out.getContext("2d");
  let pixels = null;

  return {
    // 사람인 곳은 하얗게, 배경은 까맣게 칠한 그림 (카메라 원본과 같은 방향)
    mask(video, time) {
      input.width = 256;
      input.height = Math.round((256 * video.videoHeight) / video.videoWidth) || 144;
      inputCtx.drawImage(video, 0, 0, input.width, input.height);
      const result = segmenter.segmentForVideo(input, time);
      const m = result.confidenceMasks?.[0];
      if (m) {
        if (out.width !== m.width || out.height !== m.height || !pixels) {
          out.width = m.width;
          out.height = m.height;
          pixels = outCtx.createImageData(m.width, m.height);
        }
        const f = m.getAsFloat32Array();
        const d = pixels.data;
        for (let i = 0; i < f.length; i++) {
          d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = f[i] * 255;
          d[i * 4 + 3] = 255;
        }
        outCtx.putImageData(pixels, 0, 0);
      }
      result.close?.();
      return out;
    },
  };
}
