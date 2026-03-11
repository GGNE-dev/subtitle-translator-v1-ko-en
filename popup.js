// popup.js
const toggle = document.getElementById('toggleEnabled');

// 현재 설정 불러오기
chrome.storage.local.get(['enabled'], (result) => {
  toggle.checked = result.enabled !== false; // 기본값 true
});

// 토글 변경 시 저장
toggle.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: toggle.checked });
});

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// 파일명에 못 쓰는 특수문자 제거
function sanitizeFilename(title) {
  return title
    .replace(/[\\/:*?"<>|]/g, '')  // Windows 금지 문자
    .replace(/\s+/g, '_')          // 공백 → 언더스코어
    .trim()
    .slice(0, 80);                 // 너무 길면 자르기
}

function handleExport(format) {
  const lang = document.querySelector('input[name="exportLang"]:checked').value;

  // 현재 활성 탭 제목 가져오기
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const rawTitle = tabs[0]?.title || 'subtitle';
    const baseName = sanitizeFilename(rawTitle);

    // 중복 방지: storage에서 사용된 이름 목록 확인
    chrome.storage.local.get(['usedFilenames'], (r) => {
      const used = r.usedFilenames || {};
      const key = `${baseName}_${lang}.${format}`;
      const count = used[key] || 0;

      const suffix = lang === 'en' ? '_영어자막' : '_영한자막';
      const filename = count === 0
        ? `${baseName}${suffix}.${format}`
        : `${baseName}${suffix}_(${count}).${format}`;

      used[key] = count + 1;
      chrome.storage.local.set({ usedFilenames: used });

      // lang 값을 같이 전달
      chrome.runtime.sendMessage({ type: 'exportCues', format, lang }, (res) => {
        if (!res?.content) {
          document.getElementById('exportMsg').style.display = 'block';
          return;
        }
        document.getElementById('exportMsg').style.display = 'none';
        downloadFile(res.content, filename);
      });
    });
  });
}

document.getElementById('exportMd').addEventListener('click', () => handleExport('md'));
document.getElementById('exportTxt').addEventListener('click', () => handleExport('txt'));