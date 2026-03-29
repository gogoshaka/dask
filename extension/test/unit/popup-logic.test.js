import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Pure functions extracted from popup.js for testing
// ---------------------------------------------------------------------------

// popup.js uses DOM-based escapeHtml — replicate the logic portably for Node
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const KEBAB_CASE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function buildSourceObject({ url, title, topic, summary, priority, tags, username }) {
  return {
    url,
    title,
    author: '',
    date: '',
    priority: priority || 'P0',
    summary: summary || '',
    tags: [...(tags || [])],
    addedAt: new Date().toISOString(),
    addedBy: username || 'unknown',
  };
}

function extractTopicsFromIndex(index) {
  const topics = index.topics || index;
  const list = Array.isArray(topics) ? topics : Object.keys(topics);
  return list.map((t) => (typeof t === 'string' ? t : t.id));
}

function addTagNoDuplicate(tags, newTag) {
  const val = newTag.trim();
  if (val && !tags.includes(val)) tags.push(val);
  return tags;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('escapeHtml', () => {
  it('escapes angle brackets', () => {
    assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
  });

  it('escapes ampersands', () => {
    assert.equal(escapeHtml('a & b'), 'a &amp; b');
  });

  it('escapes double quotes', () => {
    assert.equal(escapeHtml('"hello"'), '&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    assert.equal(escapeHtml("it's"), "it&#039;s");
  });

  it('handles mixed characters', () => {
    assert.equal(
      escapeHtml('<img src="x" onerror=\'alert(1)\'>'),
      '&lt;img src=&quot;x&quot; onerror=&#039;alert(1)&#039;&gt;'
    );
  });

  it('returns empty string unchanged', () => {
    assert.equal(escapeHtml(''), '');
  });

  it('passes through safe text unchanged', () => {
    assert.equal(escapeHtml('Hello World'), 'Hello World');
  });
});

describe('kebab-case validation', () => {
  it('accepts single word', () => {
    assert.equal(KEBAB_CASE_RE.test('python'), true);
  });

  it('accepts multi-segment kebab-case', () => {
    assert.equal(KEBAB_CASE_RE.test('my-new-topic'), true);
  });

  it('accepts alphanumeric segments', () => {
    assert.equal(KEBAB_CASE_RE.test('react18-hooks'), true);
  });

  it('rejects uppercase letters', () => {
    assert.equal(KEBAB_CASE_RE.test('MyTopic'), false);
  });

  it('rejects leading hyphen', () => {
    assert.equal(KEBAB_CASE_RE.test('-topic'), false);
  });

  it('rejects trailing hyphen', () => {
    assert.equal(KEBAB_CASE_RE.test('topic-'), false);
  });

  it('rejects consecutive hyphens', () => {
    assert.equal(KEBAB_CASE_RE.test('my--topic'), false);
  });

  it('rejects spaces', () => {
    assert.equal(KEBAB_CASE_RE.test('my topic'), false);
  });

  it('rejects underscores', () => {
    assert.equal(KEBAB_CASE_RE.test('my_topic'), false);
  });

  it('rejects empty string', () => {
    assert.equal(KEBAB_CASE_RE.test(''), false);
  });
});

describe('source object construction', () => {
  it('produces correct JSON shape with all fields', () => {
    const src = buildSourceObject({
      url: 'https://example.com',
      title: 'Example',
      summary: 'A summary',
      priority: 'P1',
      tags: ['js', 'web'],
      username: 'octocat',
    });

    assert.equal(src.url, 'https://example.com');
    assert.equal(src.title, 'Example');
    assert.equal(src.author, '');
    assert.equal(src.date, '');
    assert.equal(src.priority, 'P1');
    assert.equal(src.summary, 'A summary');
    assert.deepEqual(src.tags, ['js', 'web']);
    assert.equal(src.addedBy, 'octocat');
    // addedAt should be a valid ISO string
    assert.ok(!isNaN(Date.parse(src.addedAt)));
  });

  it('uses defaults for missing optional fields', () => {
    const src = buildSourceObject({ url: 'https://x.com', title: 'X' });
    assert.equal(src.priority, 'P0');
    assert.equal(src.summary, '');
    assert.deepEqual(src.tags, []);
    assert.equal(src.addedBy, 'unknown');
  });

  it('does not share tags array reference with input', () => {
    const inputTags = ['a', 'b'];
    const src = buildSourceObject({ url: 'u', title: 't', tags: inputTags });
    inputTags.push('c');
    assert.deepEqual(src.tags, ['a', 'b']);
  });
});

describe('topic loading from index', () => {
  it('extracts topics from { topics: [...] } format', () => {
    const index = { topics: [{ id: 'python' }, { id: 'rust' }] };
    assert.deepEqual(extractTopicsFromIndex(index), ['python', 'rust']);
  });

  it('extracts topics from flat string array', () => {
    const index = ['alpha', 'beta', 'gamma'];
    assert.deepEqual(extractTopicsFromIndex(index), ['alpha', 'beta', 'gamma']);
  });

  it('extracts topics from object keys format', () => {
    const index = { topics: { python: {}, rust: {} } };
    assert.deepEqual(extractTopicsFromIndex(index), ['python', 'rust']);
  });

  it('handles empty topics array', () => {
    const index = { topics: [] };
    assert.deepEqual(extractTopicsFromIndex(index), []);
  });
});

describe('tag deduplication', () => {
  it('adds a new tag', () => {
    const tags = ['a', 'b'];
    addTagNoDuplicate(tags, 'c');
    assert.deepEqual(tags, ['a', 'b', 'c']);
  });

  it('does not add duplicate tag', () => {
    const tags = ['a', 'b'];
    addTagNoDuplicate(tags, 'a');
    assert.deepEqual(tags, ['a', 'b']);
  });

  it('trims whitespace before checking', () => {
    const tags = ['a'];
    addTagNoDuplicate(tags, '  a  ');
    assert.deepEqual(tags, ['a']);
  });

  it('ignores empty input', () => {
    const tags = ['a'];
    addTagNoDuplicate(tags, '   ');
    assert.deepEqual(tags, ['a']);
  });
});

describe('base64 encode/decode round-trip', () => {
  // Replicate the pattern used in popup.js: btoa(unescape(encodeURIComponent(str)))
  function encode(obj) {
    return Buffer.from(JSON.stringify(obj, null, 2), 'utf-8').toString('base64');
  }

  function decode(b64) {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  }

  it('round-trips a simple object', () => {
    const original = { id: 'test', sources: [{ url: 'https://example.com' }] };
    const encoded = encode(original);
    const decoded = decode(encoded);
    assert.deepEqual(decoded, original);
  });

  it('round-trips objects with unicode characters', () => {
    const original = { title: 'Héllo Wörld 🎉', tags: ['café'] };
    const encoded = encode(original);
    const decoded = decode(encoded);
    assert.deepEqual(decoded, original);
  });

  it('round-trips empty object', () => {
    const original = {};
    assert.deepEqual(decode(encode(original)), original);
  });
});
