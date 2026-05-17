import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function makeFetchStub(responses) {
  return vi.fn(async (url) => {
    for (const [pattern, response] of responses) {
      if (url.includes(pattern)) return response;
    }
    return { ok: false, status: 404 };
  });
}
const json = (data) => ({ ok: true, json: async () => data });
const html = (text) => ({ ok: true, text: async () => text });

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe('CommentaryProvider.getTextManifest', () => {
  it('returns textInfoData when commentaries.json is present', async () => {
    const data = { textInfoData: [{ id: 'ENGWES', name: "Wesley's Notes", type: 'commentary' }] };
    vi.stubGlobal('fetch', makeFetchStub([['commentaries.json', json(data)]]));
    const { CommentaryProvider } = await import('@texts/CommentaryProvider.js');
    const result = await new Promise(resolve => CommentaryProvider.getTextManifest(resolve));
    expect(result).toEqual(data.textInfoData);
  });

  it('passes null on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { CommentaryProvider } = await import('@texts/CommentaryProvider.js');
    const result = await new Promise(resolve => CommentaryProvider.getTextManifest(resolve));
    expect(result).toBeNull();
  });
});

describe('CommentaryProvider.loadSection', () => {
  const info = { id: 'ENGWES', name: "Wesley's Notes", lang: 'eng' };
  const sectionHtml = `<html><head></head><body>
    <div class="section"><p>Commentary on John 3</p></div>
  </body></html>`;

  it('attaches data-textid to the loaded section', async () => {
    vi.stubGlobal('fetch', makeFetchStub([
      ['info.json', json(info)],
      ['JN3.html', html(sectionHtml)]
    ]));
    const { CommentaryProvider } = await import('@texts/CommentaryProvider.js');
    const result = await new Promise(resolve =>
      CommentaryProvider.loadSection('ENGWES', 'JN3', resolve)
    );
    const wrap = document.createElement('div');
    wrap.innerHTML = result;
    const section = wrap.querySelector('.section');
    expect(section.getAttribute('data-textid')).toBe('ENGWES');
    expect(section.textContent).toContain('Commentary on John 3');
  });

  it('invokes errorCallback when the section is missing', async () => {
    vi.stubGlobal('fetch', makeFetchStub([
      ['info.json', json(info)],
      ['JN3.html', { ok: false, status: 404 }]
    ]));
    const { CommentaryProvider } = await import('@texts/CommentaryProvider.js');
    const result = await new Promise(resolve =>
      CommentaryProvider.loadSection('ENGWES', 'JN3', () => {}, (textid, sectionid) =>
        resolve({ textid, sectionid })
      )
    );
    expect(result).toEqual({ textid: 'ENGWES', sectionid: 'JN3' });
  });
});
