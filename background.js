// background.js (release v1.0)

const translationCache = new Map();

async function translateText(text) {
  if (!text?.trim()) return '';
  if (translationCache.has(text)) return translationCache.get(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  const data = await res.json();
  const translated = data[0].filter(i => i?.[0]).map(i => i[0]).join('');
  if (translationCache.size > 1000) translationCache.delete(translationCache.keys().next().value);
  translationCache.set(text, translated);
  return translated;
}

// 자막 파싱 함수
function parseVTT(vttText) {
  const cues = [];
  const lines = vttText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('-->')) continue;

    const timeMatch = line.match(
      /(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})/
    );
    if (!timeMatch) continue;

    const toSec = (h, m, s, ms) =>
      (parseInt(h || 0) * 3600) + (parseInt(m) * 60) + parseInt(s) + parseInt(ms) / 1000;
    const start = toSec(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
    const end   = toSec(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);

    // 텍스트: 다음 줄부터 다음 --> 또는 빈 줄 전까지
    const textLines = [];
    let j = i + 1;
    while (j < lines.length && !lines[j].includes('-->')) {
      const t = lines[j].trim();
      // 숫자만 있는 줄(cue 번호)은 건너뜀
      if (t && !/^\d+$/.test(t)) textLines.push(t);
      j++;
    }

    const text = textLines.join(' ')
      .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
}

function parseYouTubeJSON3(json) {
  const cues = [];
  for (const ev of (json.events || [])) {
    if (!ev.segs) continue;
    const text = ev.segs.map(s => s.utf8 || '').join('').replace(/\n/g, ' ').trim();
    if (!text || text === ' ') continue;
    const start = ev.tStartMs / 1000;
    const end = (ev.tStartMs + (ev.dDurationMs || 2000)) / 1000;
    cues.push({ start, end, text });
  }
  return cues;
}

const MAX_DISPLAY_CHARS = 200; // 화면 표시용 길이 제한 (번역에는 영향 없음)

// 마침표(.)로만 문장 끝 판단
const isSentenceEnd = (text) => /[.]["']?\s*$/.test(text.trim());

function mergeCues(cues) {
  if (!cues.length) return cues;
  const merged = [{ ...cues[0] }];
  for (let i = 1; i < cues.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = cues[i];
    // 오직 마침표로만 분리 — 글자 수 제한 없음
    if (isSentenceEnd(prev.text)) {
      merged.push({ ...curr });
    } else {
      prev.text = prev.text.trim() + ' ' + curr.text.trim();
      prev.end = curr.end;
    }
  }
  return merged;
}

// 번역 후 화면 표시용으로만 긴 cue 분리 (번역 품질에 영향 없음)
function splitLongCues(cues) {
  const result = [];
  for (const cue of cues) {
    if (cue.text.length <= MAX_DISPLAY_CHARS) {
      result.push(cue);
      continue;
    }
    const parts = cue.text.match(/[^.]+[.]?\s*/g) || [cue.text];
    const koText = cue.translated || '';
    const koParts = koText ? (koText.match(/[^.]+[.]?\s*/g) || null) : null;
    const duration = cue.end - cue.start;
    const totalLen = parts.reduce((s, t) => s + t.length, 0);
    let time = cue.start;
    parts.forEach((part, i) => {
      const segDuration = Math.max(0.8, duration * (part.length / totalLen));
      result.push({
        start: time,
        end: time + segDuration,
        text: part.trim(),
        translated: koParts ? (koParts[i] || '').trim() : koText
      });
      time += segDuration;
    });
  }
  return result;
}

async function translateCues(cues) {
  const BATCH = 10;
  for (let i = 0; i < cues.length; i += BATCH) {
    const batch = cues.slice(i, i + BATCH);
    // 순차 처리로 로그 순서 보장 + 번역 캐시 활용
    for (const c of batch) {
      c.translated = await translateText(c.text);
    }
  }
  return cues;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

async function translateVTT(url) {
  const res = await fetch(url);
  const text = await res.text();

  // 순서: 병합 → 번역(완전한 문장으로) → 분리(표시용)
  const merged = mergeCues(parseVTT(text));
  const translated = await translateCues(merged);

  // 번역 내용 저장 
  const result = splitLongCues(translated);
  chrome.storage.local.set({ lastCues: result });

  return result;
}

async function translateYouTube(timedtextUrl) {
  const url = timedtextUrl.replace(/&fmt=[^&]*/g, '') + '&fmt=json3';
  const res = await fetch(url);
  const json = await res.json();
  // 순서: 병합 → 번역(완전한 문장으로) → 분리(표시용)
  const merged = mergeCues(parseYouTubeJSON3(json));
  const translated = await translateCues(merged);

    // 번역 내용 저장 
  const result = splitLongCues(translated);
  chrome.storage.local.set({ lastCues: result });

  return result;
}

const vttByTab = new Map();
const timedtextByTab = new Map();

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url;
    if (url.includes('udemycdn.com') && url.includes('.vtt') && url.includes('en_')) {
      vttByTab.set(details.tabId, url);
    }
    if (url.includes('youtube.com/api/timedtext') && url.includes('lang=en')) {
      timedtextByTab.set(details.tabId, url);
    }
  },
  { urls: [
    'https://vtt-c.udemycdn.com/*',
    'https://*.udemycdn.com/*',
    'https://www.youtube.com/api/timedtext*'
  ]}
);

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {

  if (req.type === 'translate') {
    translateText(req.text)
      .then(t => sendResponse({ translated: t }))
      .catch(() => sendResponse({ translated: '' }));
    return true;
  }

  if (req.type === 'translateVTT') {
    translateVTT(req.url)
      .then(cues => sendResponse({ cues }))
      .catch(e => { console.error('[bg] VTT 번역 실패', e); sendResponse({ cues: null }); });
    return true;
  }

  if (req.type === 'translateYouTube') {
    translateYouTube(req.url)
      .then(cues => sendResponse({ cues }))
      .catch(e => { console.error('[bg] YouTube 번역 실패', e); sendResponse({ cues: null }); });
    return true;
  }

  if (req.type === 'getVTTUrl') {
    sendResponse({ url: vttByTab.get(sender.tab?.id) || null });
    return true;
  }

  if (req.type === 'getTimedtextUrl') {
    sendResponse({ url: timedtextByTab.get(sender.tab?.id) || null });
    return true;
  }

  if (req.type === 'getSettings') {
    chrome.storage.local.get(['enabled'], r => sendResponse({ enabled: r.enabled !== false }));
    return true;
  }

  if (req.type === 'exportCues') {
    chrome.storage.local.get(['lastCues'], (r) => {
      const cues = r.lastCues;
      if (!cues?.length) { sendResponse({ content: null }); return; }
      if (req.format === 'md') {
        const lines = ['# 영한 자막\n', '| 시간 | 영어 | 한국어 |', '|------|------|--------|'];
        for (const c of cues) {
          lines.push(`| ${formatTime(c.start)} | ${c.text} | ${c.translated || ''} |`);
        }
        sendResponse({ content: lines.join('\n') });
      } else {
        const lines = [];
        for (const c of cues) {
          lines.push(`[${formatTime(c.start)} ~ ${formatTime(c.end)}]`);
          lines.push(`EN: ${c.text}`);
          lines.push(`KO: ${c.translated || ''}`);
          lines.push('');
        }
        sendResponse({ content: lines.join('\n') });
      }
    });
    
    return true;
  }
});