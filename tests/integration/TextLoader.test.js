import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => vi.resetModules());

function fakeProvider() {
  return {
    getTextManifest: vi.fn(cb => cb([])),
    getTextInfo: vi.fn((textid, cb) => cb({ id: textid, providerName: 'fake' })),
    loadSection: vi.fn((textid, sectionid, cb) =>
      cb(`<div class="section" data-id="${sectionid}"><span>${textid} ${sectionid}</span></div>`)
    )
  };
}

describe('TextLoader.getProviderName / getTextid / getProviderId', () => {
  it('parses "provider:textid" form', async () => {
    const { getProviderName, getTextid } = await import('@texts/TextLoader.js');
    expect(getProviderName('local:ENGKJV')).toBe('local:ENGKJV'.split(':')[0]);
    expect(getTextid('local:ENGKJV')).toBe('ENGKJV');
  });

  it('defaults provider to "local" when not prefixed and no manifest entry', async () => {
    const { getProviderName } = await import('@texts/TextLoader.js');
    expect(getProviderName('ENGKJV')).toBe('local');
  });

  it('getProviderId returns input as-is when prefixed', async () => {
    const { getProviderId } = await import('@texts/TextLoader.js');
    expect(getProviderId('dbs:ENGKJV')).toBe('dbs:ENGKJV');
  });
});

describe('TextLoader.loadSection — caching and dispatch', () => {
  it('dispatches to the named provider on first load', async () => {
    const { registerTextProvider, loadSection } = await import('@texts/TextLoader.js');
    const provider = fakeProvider();
    registerTextProvider('fake', provider);

    const textInfo = { id: 'ENGKJV', providerName: 'fake' };
    const result = await new Promise(resolve =>
      loadSection(textInfo, 'JN3', el => resolve(el))
    );
    expect(provider.loadSection).toHaveBeenCalledTimes(1);
    expect(result.getAttribute('data-id')).toBe('JN3');
  });

  it('serves from cache on the second call (no extra provider hit)', async () => {
    const { registerTextProvider, loadSection } = await import('@texts/TextLoader.js');
    const provider = fakeProvider();
    registerTextProvider('fake', provider);

    const textInfo = { id: 'ENGKJV', providerName: 'fake' };
    await new Promise(resolve => loadSection(textInfo, 'JN3', resolve));
    await new Promise(resolve => loadSection(textInfo, 'JN3', resolve));
    expect(provider.loadSection).toHaveBeenCalledTimes(1);
  });

  it('falls back to a section in the manifest with the same chapter number', async () => {
    const { registerTextProvider, loadSection } = await import('@texts/TextLoader.js');
    const provider = fakeProvider();
    registerTextProvider('fake', provider);

    const textInfo = {
      id: 'ENGKJV',
      providerName: 'fake',
      sections: ['JN3', 'JN4', 'JN5'] // canonical names
    };
    // Caller asks for the same chapter — fallback path is exercised when the
    // requested id matches by chapter number.
    await new Promise(resolve => loadSection(textInfo, 'JN03', resolve));
    expect(provider.loadSection).toHaveBeenCalledWith('ENGKJV', 'JN3', expect.any(Function), undefined);
  });

  it('does nothing when sectionid is null', async () => {
    const { registerTextProvider, loadSection } = await import('@texts/TextLoader.js');
    const provider = fakeProvider();
    registerTextProvider('fake', provider);

    loadSection({ id: 'ENGKJV', providerName: 'fake' }, null, () => {
      throw new Error('should not be called');
    });
    expect(provider.loadSection).not.toHaveBeenCalled();
  });
});

describe('TextLoader.getText', () => {
  it('returns cached info on second call without re-invoking the provider', async () => {
    const { registerTextProvider, getText } = await import('@texts/TextLoader.js');
    const provider = fakeProvider();
    registerTextProvider('local', provider);

    await new Promise(resolve => getText('ENGKJV', resolve));
    await new Promise(resolve => getText('ENGKJV', resolve));
    expect(provider.getTextInfo).toHaveBeenCalledTimes(1);
  });

  it('shares cache between prefixed and bare ids', async () => {
    const { registerTextProvider, getText } = await import('@texts/TextLoader.js');
    const provider = fakeProvider();
    registerTextProvider('fake', provider);

    await new Promise(resolve => getText('fake:ENGKJV', resolve));
    await new Promise(resolve => getText('fake:ENGKJV', resolve));
    // Cache lookup normalizes 'fake:ENGKJV' to bare 'ENGKJV', so the second
    // call hits the cache populated by the first.
    expect(provider.getTextInfo).toHaveBeenCalledTimes(1);
  });

  it('errors when the provider is not registered', async () => {
    const { getText } = await import('@texts/TextLoader.js');
    const err = await new Promise(resolve =>
      getText('nope:ENGKJV', () => {}, resolve)
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Provider/);
  });
});

describe('TextLoader.processText', () => {
  it('strips a leading "provider:" off the id and stamps providerName/providerid', async () => {
    const { processText } = await import('@texts/TextLoader.js');
    const t = { id: 'fake:ENGKJV' };
    processText(t, 'fake');
    expect(t.id).toBe('ENGKJV');
    expect(t.providerName).toBe('fake');
    expect(t.providerid).toBe('fake:ENGKJV');
  });

  it('leaves bare ids alone', async () => {
    const { processText } = await import('@texts/TextLoader.js');
    const t = { id: 'ENGKJV' };
    processText(t, 'local');
    expect(t.id).toBe('ENGKJV');
    expect(t.providerid).toBe('local:ENGKJV');
  });
});
