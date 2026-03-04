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
