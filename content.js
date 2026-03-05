// content.js (release v1.0)

(function () {
  'use strict';

  const log = (...args) => console.log('[자막번역]', ...args);
  const err = (...args) => console.error('[자막번역]', ...args);

  let enabled = true;
  let overlayEl = null;

  const SITE = (() => {
    if (location.hostname.includes('youtube.com')) return 'youtube';
    if (location.hostname.includes('udemy.com')) return 'udemy';
    return null;
  })();

  if (!SITE) return;

  function isRuntimeValid() {
    try { return !!(chrome?.runtime?.id); } catch (e) { return false; }
  }

  // ── 단축키: Alt + Shift + O (content script에서 직접 처리) ──
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && e.code === 'KeyO') {
      if (!isRuntimeValid()) return;
      chrome.storage.local.get(['enabled'], (r) => {
        chrome.storage.local.set({ enabled: r.enabled === false ? true : false });
      });
    }
  });

  if (isRuntimeValid()) {
    chrome.runtime.sendMessage({ type: 'getSettings' }, (res) => {
      if (chrome.runtime.lastError) return;
      enabled = res?.enabled !== false;
      if (enabled) init();
    });
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.enabled) {
        enabled = changes.enabled.newValue;
        if (!enabled) {
          // 오버레이만 숨김 (번역된 cues 유지)
          if (overlayEl) overlayEl.style.display = 'none';
        } else {
          // 오버레이 다시 표시
          if (overlayEl) overlayEl.style.display = '';
          else init();
        }
      }
    });
  }

  // ── 오버레이 ─────────────────────────────────────────────
  function createOverlay() {
    if (overlayEl) return;
    overlayEl = document.createElement('div');
    overlayEl.id = 'bilingual-subtitle-overlay';
    overlayEl.style.cssText = `
      position: fixed; bottom: 10%; left: 50%; transform: translateX(-50%);
      z-index: 2147483647; text-align: center; pointer-events: none;
      width: 85vw; max-width: 960px;
    `;
    overlayEl.innerHTML = `
      <div id="bs-en" style="color:#fff;font-size:16px;font-weight:500;
        font-family:'Noto Sans KR','Apple SD Gothic Neo',sans-serif;
        text-shadow:0 0 6px #000,1px 1px 3px #000;
        line-height:1.5;margin-bottom:4px;padding:4px 14px;
        background:rgba(0,0,0,0.6);border-radius:6px;display:none;
        word-break:break-word;white-space:normal;"></div>
      <div id="bs-ko" style="color:#ffe066;font-size:18px;font-weight:700;
        font-family:'Noto Sans KR','Apple SD Gothic Neo',sans-serif;
        text-shadow:0 0 6px #000,1px 1px 3px #000;
        line-height:1.5;padding:4px 14px;
        background:rgba(0,0,0,0.65);border-radius:6px;display:none;
        word-break:break-word;white-space:normal;"></div>
    `;
    document.body.appendChild(overlayEl);
  }

  function handleFullscreenChange() {
    if (!overlayEl) createOverlay();
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) fsEl.appendChild(overlayEl);
    else document.body.appendChild(overlayEl);
  }
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

  function showSubtitle(en, ko) {
    if (!overlayEl) createOverlay();
    const enEl = overlayEl.querySelector('#bs-en');
    const koEl = overlayEl.querySelector('#bs-ko');
    if (en !== undefined) {
      enEl.textContent = en || '';
      enEl.style.display = en ? 'block' : 'none';
    }
    if (ko !== undefined) {
      koEl.textContent = ko || '';
      koEl.style.display = ko ? 'block' : 'none';
    }
  }

  function hideSubtitle() { showSubtitle('', ''); }

  // ── 공통: 싱크 루프 (requestAnimationFrame 기반) ──────────
  function createSyncLoop(getCues) {
    let rafId = null;
    let lastCueIdx = -1;
    let video = null;
    let videoListeners = [];

    function tick() {
      rafId = requestAnimationFrame(tick);
      if (!enabled || !video) return;

      const cues = getCues();
      if (!cues.length) return;

      const t = video.currentTime;
      const idx = cues.findIndex(c => t >= c.start - 0.5 && t <= c.end + 0.5);

      if (idx === -1) {
        if (lastCueIdx !== -1) { hideSubtitle(); lastCueIdx = -1; }
        return;
      }
      if (idx === lastCueIdx) return;
      lastCueIdx = idx;
      showSubtitle(cues[idx].text, cues[idx].translated || '');
    }

    function onSeek() {
      // seek 시 강제로 현재 위치 다시 계산
      lastCueIdx = -1;
    }

    function start() {
      // video 요소 찾기 (없으면 잠시 후 재시도)
      video = document.querySelector('video');
      if (!video) { setTimeout(start, 500); return; }

      // seek/pause/play 이벤트로 즉시 반응
      const events = ['seeked', 'play', 'pause'];
      events.forEach(ev => {
        const fn = onSeek;
        video.addEventListener(ev, fn);
        videoListeners.push([ev, fn]);
      });

      if (rafId) cancelAnimationFrame(rafId);
      tick();
    }

    function reset() {
      lastCueIdx = -1;
      hideSubtitle();
    }

    function stop() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (video) {
        videoListeners.forEach(([ev, fn]) => video.removeEventListener(ev, fn));
        videoListeners = [];
      }
    }

    return { start, reset, stop };
  }

  // ── 공통: URL 폴링 ────────────────────────────────────────
  function pollUrl(msgType, onFound) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (!isRuntimeValid()) { clearInterval(timer); return; }
      chrome.runtime.sendMessage({ type: msgType }, (res) => {
        if (chrome.runtime.lastError) return;
        if (res?.url) {
          clearInterval(timer);
          onFound(res.url);
        } else if (attempts >= 30) {
          err(`30초 내 URL 못 찾음 (${msgType})`);
          clearInterval(timer);
        }
      });
    }, 1000);
    return timer;
  }

  // ── 공통: 번역 요청 ───────────────────────────────────────
  function requestTranslation(msgType, url, onSuccess) {
    showSubtitle('자막 번역 중...', '잠시만 기다려주세요 ☕');
    chrome.runtime.sendMessage({ type: msgType, url }, (res) => {
      if (chrome.runtime.lastError) {
        err('번역 실패:', chrome.runtime.lastError.message);
        hideSubtitle(); return;
      }
      if (!res?.cues?.length) {
        err('파싱 결과 없음');
        hideSubtitle(); return;
      }
      log('✅ 번역 완료. 자막 수:', res.cues.length);
      hideSubtitle();
      onSuccess(res.cues);
    });
  }

  // ════════════════════════════════════════════════════════
  // YouTube
  // ════════════════════════════════════════════════════════
  function initYouTube() {
    let cues = [];
    let loadedUrl = '';
    let pollTimer = null;
    const sync = createSyncLoop(() => cues);
    sync.start();

    function load(url) {
      if (url === loadedUrl) return;
      loadedUrl = url;
      cues = [];
      sync.reset();
      requestTranslation('translateYouTube', url, (result) => { cues = result; });
    }


    // const video = document.querySelector('video');
    // if (video && video.muted) {
    //   video.addEventListener('volumechange', () => {
    //     if (!video.muted) pollTimer = pollUrl('getTimedtextUrl', load);
    //   }, { once: true });
    // } else {
    //   pollTimer = pollUrl('getTimedtextUrl', load);
    // }

    pollTimer = pollUrl('getTimedtextUrl', load);

    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        cues = []; loadedUrl = ''; sync.reset();
        if (pollTimer) clearInterval(pollTimer);
        setTimeout(() => { pollTimer = pollUrl('getTimedtextUrl', load); }, 1500);
      }
    }).observe(document.body, { childList: true, subtree: false });
  }

  // ════════════════════════════════════════════════════════
  // Udemy
  // ════════════════════════════════════════════════════════
  function initUdemy() {
    let cues = [];
    let loadedUrl = '';
    let pollTimer = null;
    const sync = createSyncLoop(() => cues);
    sync.start();

    function load(url) {
      if (url === loadedUrl) return;
      loadedUrl = url;
      cues = [];
      sync.reset();
      requestTranslation('translateVTT', url, (result) => { cues = result; });
    }

    pollTimer = pollUrl('getVTTUrl', load);

    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        cues = []; loadedUrl = ''; sync.reset();
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = pollUrl('getVTTUrl', load);
      }
    }).observe(document.body, { childList: true, subtree: false });
  }

  function init() {
    createOverlay();
    if (SITE === 'youtube') initYouTube();
    if (SITE === 'udemy') initUdemy();
  }

  function cleanup() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  }

})();