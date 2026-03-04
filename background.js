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

function parseVTT(vttText) {
  const cues = [];
  const blocks = vttText.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const timeLineIdx = lines.findIndex(l => l.includes('-->'));
    if (timeLineIdx === -1) continue;
    const timeMatch = lines[timeLineIdx].match(
      /(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})/
    );
    if (!timeMatch) continue;
    const toSec = (h, m, s, ms) =>
      (parseInt(h || 0) * 3600) + (parseInt(m) * 60) + parseInt(s) + parseInt(ms) / 1000;
    const start = toSec(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
    const end   = toSec(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
    const text  = lines.slice(timeLineIdx + 1).join(' ')
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

function mergeCues(cues) {
  if (!cues.length) return cues;
  const merged = [{ ...cues[0] }];
  for (let i = 1; i < cues.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = cues[i];
    const gap = curr.start - prev.end;
    const incomplete = /[,;]\s*$/.test(prev.text) || !/[.!?'"]\s*$/.test(prev.text);
    if (gap <= 0.3 && incomplete) {
      prev.text = prev.text.trim() + ' ' + curr.text.trim();
      prev.end = curr.end;
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

async function translateCues(cues) {
  const BATCH = 10;
  for (let i = 0; i < cues.length; i += BATCH) {
    await Promise.all(cues.slice(i, i + BATCH).map(async c => {
      c.translated = await translateText(c.text);
    }));
  }
  return cues;
}

async function translateVTT(url) {
  const res = await fetch(url);
  const text = await res.text();
  return translateCues(mergeCues(parseVTT(text)));
}

async function translateYouTube(timedtextUrl) {
  const url = timedtextUrl.replace(/&fmt=[^&]*/g, '') + '&fmt=json3';
  const res = await fetch(url);
  const json = await res.json();
  return translateCues(mergeCues(parseYouTubeJSON3(json)));
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
});

