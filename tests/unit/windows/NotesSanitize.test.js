import { describe, it, expect } from 'vitest';
import { sanitizeHtml, stripHtml, escapeHtml } from '@windows/NotesWindow/sanitize.js';

describe('sanitizeHtml', () => {
  it('drops script/style/iframe elements together with their contents', () => {
    expect(sanitizeHtml('<p>hi</p><script>alert(1)</script>')).toBe('<p>hi</p>');
    expect(sanitizeHtml('<style>p{color:red}</style><p>hi</p>')).toBe('<p>hi</p>');
    expect(sanitizeHtml('<iframe src="https://evil.example"></iframe>ok')).toBe('ok');
  });

  it('drops img entirely (the classic onerror vector)', () => {
    expect(sanitizeHtml('<p>a<img src="x" onerror="alert(1)">b</p>')).toBe('<p>ab</p>');
  });

  it('strips event handler and style attributes from kept elements', () => {
    expect(sanitizeHtml('<p onclick="alert(1)" style="color:red" class="x">hi</p>')).toBe('<p>hi</p>');
    expect(sanitizeHtml('<b onmouseover="x()">bold</b>')).toBe('<b>bold</b>');
  });

  it('removes javascript: hrefs but keeps http(s) and mailto', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeHtml('<a href="https://example.com/">x</a>')).toBe('<a href="https://example.com/">x</a>');
    expect(sanitizeHtml('<a href="mailto:a@b.org">x</a>')).toBe('<a href="mailto:a@b.org">x</a>');
    expect(sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>')).toBe('<a>x</a>');
  });

  it('unwraps disallowed wrappers but preserves their text', () => {
    expect(sanitizeHtml('<span style="color:red">text</span>')).toBe('text');
    expect(sanitizeHtml('<font face="Arial">old</font>')).toBe('old');
    expect(sanitizeHtml('<table><tbody><tr><td>cell</td></tr></tbody></table>')).toBe('cell');
    expect(sanitizeHtml('<section><p>kept</p></section>')).toBe('<p>kept</p>');
  });

  it('keeps the editor allowlist intact', () => {
    const html = '<h2>Head</h2><p>Para <strong>b</strong> <em>i</em> <u>u</u></p><ul><li>one</li></ul><div>line<br></div><blockquote>q</blockquote>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('downgrades foreign heading levels instead of unwrapping', () => {
    expect(sanitizeHtml('<h1>Big</h1>')).toBe('<h2>Big</h2>');
    expect(sanitizeHtml('<h5>Small</h5>')).toBe('<h3>Small</h3>');
  });

  it('removes comments', () => {
    expect(sanitizeHtml('a<!-- secret -->b')).toBe('ab');
  });

  it('handles nested nastiness inside kept elements', () => {
    expect(sanitizeHtml('<ul><li><script>x()</script>item<span onclick="y()">s</span></li></ul>'))
      .toBe('<ul><li>items</li></ul>');
  });

  it('is idempotent', () => {
    const messy = '<h1 id="t">T</h1><span>s</span><p onclick="x">p<img src=x></p><a href="javascript:y">l</a>';
    const once = sanitizeHtml(messy);
    expect(sanitizeHtml(once)).toBe(once);
  });

  it('returns empty string for empty/non-string input', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
  });
});

describe('stripHtml', () => {
  it('turns block boundaries and <br> into newlines', () => {
    expect(stripHtml('<div>a</div><div>b</div>')).toBe('a\nb');
    expect(stripHtml('<p>one</p><p>two</p>')).toBe('one\ntwo');
    expect(stripHtml('line1<br>line2')).toBe('line1\nline2');
  });

  it('keeps inline formatting text inline', () => {
    expect(stripHtml('<p>Hello <b>World</b>!</p>')).toBe('Hello World!');
  });

  it('decodes entities', () => {
    expect(stripHtml('<p>a &amp; b &lt;c&gt;</p>')).toBe('a & b <c>');
  });

  it('handles empty input', () => {
    expect(stripHtml('')).toBe('');
    expect(stripHtml(null)).toBe('');
  });
});

describe('escapeHtml', () => {
  it('escapes markup-significant characters', () => {
    expect(escapeHtml('<script>"a" & \'b\'</script>'))
      .toBe('&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;');
  });

  it('handles null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
