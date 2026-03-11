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

function handleExport(format) {
  chrome.runtime.sendMessage({ type: 'exportCues', format }, (res) => {
    if (!res?.content) {
      document.getElementById('exportMsg').style.display = 'block';
      return;
    }
    document.getElementById('exportMsg').style.display = 'none';
    downloadFile(res.content, format === 'md' ? 'subtitle.md' : 'subtitle.txt');
  });
}

document.getElementById('exportMd').addEventListener('click', () => handleExport('md'));
document.getElementById('exportTxt').addEventListener('click', () => handleExport('txt'));