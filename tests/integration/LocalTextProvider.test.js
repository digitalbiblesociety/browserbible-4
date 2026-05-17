import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const TEXT_ID = 'ENGKJV';
const SECTION_ID = 'JN3';

function makeFetchStub(responses) {
  return vi.fn(async (url) => {
    for (const [pattern, response] of responses) {
      if (url.includes(pattern)) {
        return response;
      }
    }
    return { ok: false, status: 404, statusText: 'Not Found' };
  });
}

function jsonResponse(data) {
  return { ok: true, json: async () => data };
}

function htmlResponse(text) {
  return { ok: true, text: async () => text };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LocalTextProvider.getTextManifest', () => {
  it('resolves with textInfoData from the manifest URL', async () => {
    const manifest = {
      textInfoData: [{ id: TEXT_ID, name: 'KJV', lang: 'eng' }]
    };
    vi.stubGlobal('fetch', makeFetchStub([
      ['texts.json', jsonResponse(manifest)]
    ]));
    const { LocalTextProvider } = await import('@texts/LocalTextProvider.js');
    const data = await new Promise(resolve => LocalTextProvider.getTextManifest(resolve));
    expect(data).toEqual(manifest.textInfoData);
  });

  it('passes null to callback when manifest fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, statusText: 'X' })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { LocalTextProvider } = await import('@texts/LocalTextProvider.js');
    const data = await new Promise(resolve => LocalTextProvider.getTextManifest(resolve));
    expect(data).toBeNull();
  });
});

describe('LocalTextProvider.getTextInfo', () => {
  it('fetches info.json and caches subsequent calls', async () => {
    const info = { id: TEXT_ID, name: 'KJV', lang: 'eng' };
    const fetchStub = makeFetchStub([
      ['info.json', jsonResponse(info)]
    ]);
    vi.stubGlobal('fetch', fetchStub);
    const { LocalTextProvider } = await import('@texts/LocalTextProvider.js');

    const first = await new Promise(resolve => LocalTextProvider.getTextInfo(TEXT_ID, resolve));
    const second = await new Promise(resolve => LocalTextProvider.getTextInfo(TEXT_ID, resolve));

    expect(first).toEqual(info);
    expect(second).toEqual(info);
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it('invokes errorCallback when info fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { LocalTextProvider } = await import('@texts/LocalTextProvider.js');
    const error = await new Promise(resolve =>
      LocalTextProvider.getTextInfo('missing', () => {}, resolve)
    );
    expect(error).toBeInstanceOf(Error);
  });
});

describe('LocalTextProvider.loadSection', () => {
  const info = { id: TEXT_ID, name: 'KJV', lang: 'eng' };
  const sectionHtml = `
    <html><head><title>JN3</title></head>
    <body>
      <div class="section">
        <span class="c">3</span>
        <span class="s">Heading</span>
        <span class="v" data-id="JN3_1">In the beginning <span class="v-num">1</span></span>
      </div>
      <div class="footnotes">
        <div class="footnote"><a href=".JN3_1"></a><span class="text">A note</span></div>
      </div>
    </body></html>`;

  it('fetches, parses the section, and applies content transforms', async () => {
    vi.stubGlobal('fetch', makeFetchStub([
      ['info.json', jsonResponse(info)],
      [`${TEXT_ID}/${SECTION_ID}.html`, htmlResponse(sectionHtml)]
    ]));
    const { LocalTextProvider } = await import('@texts/LocalTextProvider.js');

    const html = await new Promise(resolve =>
      LocalTextProvider.loadSection(TEXT_ID, SECTION_ID, resolve)
    );

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const section = wrapper.querySelector('.section');

    expect(section).not.toBeNull();
    expect(section.getAttribute('data-textid')).toBe(TEXT_ID);
    expect(section.getAttribute('data-lang3')).toBe('eng');

    // Heading should have moved before the chapter marker.
    const children = Array.from(section.children);
    const cIdx = children.findIndex(c => c.classList.contains('c'));
    const sIdx = children.findIndex(c => c.classList.contains('s'));
    expect(sIdx).toBeLessThan(cIdx);

    // Verse number should have moved before the verse element.
    const vNum = section.querySelector('.v-num');
    expect(vNum.nextElementSibling?.classList.contains('v')).toBe(true);
  });

  it('invokes errorCallback when section fetch fails', async () => {
    vi.stubGlobal('fetch', makeFetchStub([
      ['info.json', jsonResponse(info)],
      [`${SECTION_ID}.html`, { ok: false, status: 404 }]
    ]));
    const { LocalTextProvider } = await import('@texts/LocalTextProvider.js');

    const result = await new Promise(resolve =>
      LocalTextProvider.loadSection(TEXT_ID, SECTION_ID, () => {}, (textid, sectionid) =>
        resolve({ textid, sectionid })
      )
    );
    expect(result).toEqual({ textid: TEXT_ID, sectionid: SECTION_ID });
  });
});
