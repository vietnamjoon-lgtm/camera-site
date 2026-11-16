/**
 * 카메라 사이트(거울·포토부스·iPad-1 카메라 앱)가 보낸 사진과 영상을 구글 드라이브에 저장하는 Apps Script 웹앱.
 * 사진은 iPad/사진, 영상은 iPad/영상 폴더에 넣는다 (폴더가 없으면 처음 올릴 때 만든다).
 *
 * 고친 뒤 적용하는 법:
 *  1) script.google.com 에서 이 프로젝트를 열고 코드 전체를 이 파일로 바꾼 뒤 저장
 *  2) 배포 > 배포 관리 > 연필(수정) > 버전: 새 버전 > 배포
 *     (새 배포가 아니라 기존 배포를 수정해야 웹앱 URL이 그대로라 사이트 코드를 안 고쳐도 된다)
 */

const FOLDER_ID = "1Sp9sujSuk-OvTVYA7TSYMbJ-zhB6Gg1o"; // iPad 폴더

// iPad 폴더 안의 하위 폴더. 사진과 영상이 동시에 처음 올라와도 폴더가 두 개 생기지 않게 잠근다.
function subfolder(name) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const parent = DriveApp.getFolderById(FOLDER_ID);
    const found = parent.getFoldersByName(name);
    return found.hasNext() ? found.next() : parent.createFolder(name);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const bytes = Utilities.base64Decode(body.data);
    const mimeType = body.mimeType || "video/webm";
    const blob = Utilities.newBlob(bytes, mimeType, body.filename);
    const folder = subfolder(mimeType.startsWith("image/") ? "사진" : "영상");
    const file = folder.createFile(blob);
    return ContentService.createTextOutput(
      JSON.stringify({ ok: true, id: file.getId(), name: file.getName(), folder: folder.getName() })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// 브라우저에서 URL을 그냥 열었을 때 살아있는지 확인용
function doGet() {
  return ContentService.createTextOutput("Camera uploader is running (사진·영상 폴더 나눔).");
}
