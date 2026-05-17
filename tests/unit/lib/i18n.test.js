import { describe, it, expect, beforeEach, vi } from 'vitest';

// Reset module state between tests because i18n keeps top-level state.
beforeEach(async () => {
  vi.resetModules();
  document.cookie = 'i18next=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

describe('i18n.init + t', () => {
  it('translates a key from the configured resStore', async () => {
    const { init, t } = await import('@lib/i18n.js');
    await init({
      lng: 'en',
      fallbackLng: 'en',
      resStore: {
        en: { translation: { hello: 'Hello' } }
      }
    });
    expect(t('hello')).toBe('Hello');
  });

  it('returns the key when missing', async () => {
    const { init, t } = await import('@lib/i18n.js');
    await init({ lng: 'en', fallbackLng: 'en', resStore: { en: { translation: {} } } });
    expect(t('not.there')).toBe('not.there');
  });

  it('falls back to fallback language when current is missing the key', async () => {
    const { init, t } = await import('@lib/i18n.js');
    await init({
      lng: 'es',
      fallbackLng: 'en',
      resStore: {
        en: { translation: { hello: 'Hello' } },
        es: { translation: {} }
      }
    });
    expect(t('hello')).toBe('Hello');
  });

  it('supports nested keys via dot notation', async () => {
    const { init, t } = await import('@lib/i18n.js');
    await init({
      lng: 'en',
      fallbackLng: 'en',
      resStore: { en: { translation: { menu: { file: 'File' } } } }
    });
    expect(t('menu.file')).toBe('File');
  });

  it('interpolates {name} placeholders from an options object', async () => {
    const { init, t } = await import('@lib/i18n.js');
    await init({
      lng: 'en',
      fallbackLng: 'en',
      resStore: { en: { translation: { greet: 'Hello, {name}!' } } }
    });
    expect(t('greet', { name: 'World' })).toBe('Hello, World!');
  });

  it('interpolates {0}/{1} placeholders from a positional array', async () => {
    const { init, t } = await import('@lib/i18n.js');
    await init({
      lng: 'en',
      fallbackLng: 'en',
      resStore: { en: { translation: { sum: '{0} + {1}' } } }
    });
    expect(t('sum', ['1', '2'])).toBe('1 + 2');
  });

  it('replaces __count__ when count option provided', async () => {
    const { init, t } = await import('@lib/i18n.js');
    await init({
      lng: 'en',
      fallbackLng: 'en',
      resStore: { en: { translation: { items: '__count__ items' } } }
    });
    expect(t('items', { count: 5 })).toBe('5 items');
  });
});

describe('i18n.lng / setLng', () => {
  it('lng returns the current language', async () => {
    const { init, lng } = await import('@lib/i18n.js');
    await init({ lng: 'en', fallbackLng: 'en', resStore: { en: { translation: {} } } });
    expect(lng()).toBe('en');
  });

  it('setLng switches when target language is loaded', async () => {
    const { init, setLng, lng } = await import('@lib/i18n.js');
    await init({
      lng: 'en',
      fallbackLng: 'en',
      resStore: {
        en: { translation: { hi: 'Hello' } },
        es: { translation: { hi: 'Hola' } }
      }
    });
    const ok = await setLng('es');
    expect(ok).toBe(true);
    expect(lng()).toBe('es');
  });
});

describe('i18n.translateElement', () => {
  it('sets innerHTML from the key', async () => {
    const { init, translateElement } = await import('@lib/i18n.js');
    await init({
      lng: 'en',
      fallbackLng: 'en',
      resStore: { en: { translation: { btn: 'Click me' } } }
    });
    const el = document.createElement('button');
    el.setAttribute('data-i18n', 'btn');
    translateElement(el);
    expect(el.innerHTML).toBe('Click me');
  });

  it('targets a specific attribute via [attr]key syntax', async () => {
    const { init, translateElement } = await import('@lib/i18n.js');
    await init({
      lng: 'en',
      fallbackLng: 'en',
      resStore: { en: { translation: { tip: 'Helpful' } } }
    });
    const el = document.createElement('button');
    el.setAttribute('data-i18n', '[title]tip');
    translateElement(el);
    expect(el.getAttribute('title')).toBe('Helpful');
    expect(el.innerHTML).toBe('');
  });
});

describe('i18n.preload / isLoaded / getResource', () => {
  it('preload resolves true when fetch returns ok JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translation: { hi: 'Hi' } })
    }));
    const { init, preload, isLoaded, getResource } = await import('@lib/i18n.js');
    await init({ lng: 'en', fallbackLng: 'en', resStore: { en: { translation: {} } } });
    const ok = await preload('fr');
    expect(ok).toBe(true);
    expect(isLoaded('fr')).toBe(true);
    expect(getResource('fr')).toEqual({ translation: { hi: 'Hi' } });
    vi.unstubAllGlobals();
  });

  it('preload resolves false when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { init, preload, isLoaded } = await import('@lib/i18n.js');
    await init({ lng: 'en', fallbackLng: 'en', resStore: { en: { translation: {} } } });
    const ok = await preload('xx');
    expect(ok).toBe(false);
    expect(isLoaded('xx')).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('document direction', () => {
  it('sets dir=rtl on Arabic and ltr on English', async () => {
    const { init } = await import('@lib/i18n.js');
    await init({
      lng: 'ar',
      fallbackLng: 'en',
      resStore: { en: { translation: {} }, ar: { translation: {} } }
    });
    expect(document.documentElement.dir).toBe('rtl');

    vi.resetModules();
    const { init: init2 } = await import('@lib/i18n.js');
    await init2({ lng: 'en', fallbackLng: 'en', resStore: { en: { translation: {} } } });
    expect(document.documentElement.dir).toBe('ltr');
  });
});
