// Injected into the active tab via chrome.scripting.executeScript().
// Extracts structured metadata from the current page.
// Returns a compact excerpt suitable for LLM-based tag generation.

function extractPageContent() {
  const meta = (name) => {
    const el =
      document.querySelector(`meta[name="${name}"]`) ||
      document.querySelector(`meta[property="${name}"]`);
    return el ? el.getAttribute('content') || '' : '';
  };

  const title = document.title || '';
  const description = meta('description') || meta('og:description') || '';
  const keywords = meta('keywords');
  const ogType = meta('og:type');
  const ogSection = meta('article:section');
  const author = meta('author') || meta('article:author') || '';

  // Collect headings (h1-h3)
  const headings = [];
  document.querySelectorAll('h1, h2, h3').forEach((h) => {
    const text = h.textContent.trim();
    if (text && headings.length < 20) headings.push(text);
  });

  // Extract main text content (first ~1500 chars)
  // Prefer <article> or <main>, fall back to <body>
  const container =
    document.querySelector('article') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('main') ||
    document.body;

  let bodyText = '';
  if (container) {
    // Remove script/style/nav/header/footer noise
    const clone = container.cloneNode(true);
    clone.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .comments')
      .forEach((el) => el.remove());
    bodyText = clone.textContent
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500);
  }

  return {
    title,
    description,
    keywords,
    ogType,
    ogSection,
    author,
    headings,
    bodyText,
  };
}

// Return the result for executeScript
extractPageContent();
