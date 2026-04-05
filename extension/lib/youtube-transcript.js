// Injected into a YouTube tab via chrome.scripting.executeScript().
// Extracts captions/transcript from the video's embedded player response.
// Returns the transcript as a plain text string, or null if unavailable.

(async function extractYouTubeTranscript() {
  // Try to read the player response from the page's JS variable via a page-level script.
  // This works for SPA navigations where the <script> tag has stale data.
  function getPlayerResponseFromPageWorld() {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      const id = '__dask_yt_' + Date.now();
      script.textContent = `
        document.dispatchEvent(new CustomEvent('${id}', {
          detail: JSON.stringify(
            window.ytInitialPlayerResponse ||
            (document.querySelector('#movie_player')?.getPlayerResponse?.()) ||
            null
          )
        }));
      `;
      const handler = (e) => {
        document.removeEventListener(id, handler);
        try { resolve(JSON.parse(e.detail)); } catch { resolve(null); }
      };
      document.addEventListener(id, handler);
      document.documentElement.appendChild(script);
      script.remove();
      // Timeout fallback
      setTimeout(() => { document.removeEventListener(id, handler); resolve(null); }, 500);
    });
  }

  // Fallback: parse ytInitialPlayerResponse from raw <script> tag text.
  function findPlayerResponseFromScriptTags() {
    for (const script of document.querySelectorAll('script')) {
      const text = script.textContent;
      if (!text || !text.includes('ytInitialPlayerResponse')) continue;

      const marker = 'ytInitialPlayerResponse';
      const idx = text.indexOf(marker);
      if (idx === -1) continue;

      const braceStart = text.indexOf('{', idx + marker.length);
      if (braceStart === -1) continue;

      let depth = 0;
      let inString = false;
      let escaped = false;
      let end = -1;

      for (let i = braceStart; i < text.length; i++) {
        const ch = text[i];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\' && inString) { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) { end = i + 1; break; }
        }
      }

      if (end === -1) continue;

      try {
        return JSON.parse(text.slice(braceStart, end));
      } catch {
        continue;
      }
    }
    return null;
  }

  // Try page world first (works for SPA navigations), then fall back to script tags
  const playerResponse = await getPlayerResponseFromPageWorld() || findPlayerResponseFromScriptTags();
  if (!playerResponse) return null;

  const captionTracks =
    playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captionTracks?.length) return null;

  // Pick best track: manual English > auto English > any manual > first available
  const track =
    captionTracks.find((t) => t.languageCode === 'en' && t.kind !== 'asr') ||
    captionTracks.find((t) => t.languageCode === 'en') ||
    captionTracks.find((t) => t.kind !== 'asr') ||
    captionTracks[0];

  if (!track?.baseUrl) return null;

  let xml;
  try {
    const res = await fetch(track.baseUrl);
    if (!res.ok) return null;
    xml = await res.text();
  } catch {
    return null;
  }

  // Parse the captions XML and concatenate all <text> elements
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const textNodes = doc.querySelectorAll('text');
  if (!textNodes.length) return null;

  const transcript = Array.from(textNodes)
    .map((node) => {
      const el = document.createElement('span');
      el.innerHTML = node.textContent;
      return el.textContent.trim();
    })
    .filter(Boolean)
    .join(' ');

  return transcript || null;
})();
