// 거울: 시작을 누르면 카메라로 내 모습을 보여 주고, 동시에 녹화해서 3분마다 드라이브로 보낸다 (recording.js)
// 끄는 버튼은 없다. 탭을 닫거나 다른 앱으로 가면 그때까지 찍은 부분이 올라간다.
import { recordContinuously } from "./recording.js";

const $ = (id) => document.getElementById(id);
const video = $("video");
const startButton = $("start");
const errorEl = $("error");

async function start() {
  startButton.disabled = true;
  startButton.textContent = "카메라 켜는 중…";
  errorEl.textContent = "";
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("이 브라우저는 카메라를 지원하지 않아요 (https 또는 localhost에서 열어 주세요)");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    recordContinuously(stream, { prefix: "mirror", segmentMs: 180_000 });

    $("start-screen").classList.add("hidden");
    $("bar").classList.remove("hidden");
  } catch (err) {
    console.error(err);
    errorEl.textContent =
      err.name === "NotAllowedError" ? "⚠️ 카메라 권한을 허용해 주세요" : `⚠️ ${err.message}`;
    startButton.disabled = false;
    startButton.textContent = "다시 시작";
  }
}

startButton.addEventListener("click", start);
