/**
 * BCP-47 language tag helpers.
 *
 * The text catalog identifies languages with ISO 639-3 (3-letter) codes,
 * optionally suffixed with a script and/or region (e.g. "eng", "eng-Latn-US").
 * BCP-47 (RFC 5646) requires the *shortest* available ISO 639 code for the
 * primary subtag, so a language that has a 2-letter ISO 639-1 code MUST use it
 * ("en", not "eng"). Codes such as "eng"/"spa" are therefore invalid as an HTML
 * `lang` value and fail accessibility checks (axe `valid-lang`), while 639-3
 * codes that have no 639-1 equivalent (e.g. "grc", "cmn", "agr") are valid and
 * are left untouched.
 *
 * `data-lang3` keeps the raw 3-letter code for internal logic; only the HTML
 * `lang` attribute is normalized via toBcp47Lang().
 */

/** ISO 639-3 (and a few common alias) → ISO 639-1 primary subtag. */
const ISO_639_3_TO_1 = {
  aar: 'aa', abk: 'ab', ave: 'ae', afr: 'af', aka: 'ak', amh: 'am', arg: 'an',
  ara: 'ar', asm: 'as', ava: 'av', aym: 'ay', aze: 'az',
  bak: 'ba', bel: 'be', bul: 'bg', bis: 'bi', bam: 'bm', ben: 'bn', bod: 'bo',
  bre: 'br', bos: 'bs',
  cat: 'ca', che: 'ce', cha: 'ch', cos: 'co', cre: 'cr', ces: 'cs', chu: 'cu',
  chv: 'cv', cym: 'cy',
  dan: 'da', deu: 'de', div: 'dv', dzo: 'dz',
  ewe: 'ee', ell: 'el', eng: 'en', epo: 'eo', spa: 'es', est: 'et', eus: 'eu',
  fas: 'fa', ful: 'ff', fin: 'fi', fij: 'fj', fao: 'fo', fra: 'fr', fry: 'fy',
  gle: 'ga', gla: 'gd', glg: 'gl', grn: 'gn', guj: 'gu', glv: 'gv',
  hau: 'ha', heb: 'he', hin: 'hi', hmo: 'ho', hrv: 'hr', hat: 'ht', hun: 'hu',
  hye: 'hy', her: 'hz',
  ina: 'ia', ind: 'id', ile: 'ie', ibo: 'ig', iii: 'ii', ipk: 'ik', ido: 'io',
  isl: 'is', ita: 'it', iku: 'iu',
  jpn: 'ja', jav: 'jv',
  kat: 'ka', kon: 'kg', kik: 'ki', kua: 'kj', kaz: 'kk', kal: 'kl', khm: 'km',
  kan: 'kn', kor: 'ko', kau: 'kr', kas: 'ks', kur: 'ku', kom: 'kv', cor: 'kw',
  kir: 'ky',
  lat: 'la', ltz: 'lb', lug: 'lg', lim: 'li', lin: 'ln', lao: 'lo', lit: 'lt',
  lub: 'lu', lav: 'lv',
  mlg: 'mg', mah: 'mh', mri: 'mi', mkd: 'mk', mal: 'ml', mon: 'mn', mar: 'mr',
  msa: 'ms', mlt: 'mt', mya: 'my',
  nau: 'na', nob: 'nb', nde: 'nd', nep: 'ne', ndo: 'ng', nld: 'nl', nno: 'nn',
  nor: 'no', nbl: 'nr', nav: 'nv', nya: 'ny',
  oci: 'oc', oji: 'oj', orm: 'om', ori: 'or', oss: 'os',
  pan: 'pa', pli: 'pi', pol: 'pl', pus: 'ps', por: 'pt',
  que: 'qu',
  roh: 'rm', run: 'rn', ron: 'ro', rus: 'ru', kin: 'rw',
  san: 'sa', srd: 'sc', snd: 'sd', sme: 'se', sag: 'sg', sin: 'si', slk: 'sk',
  slv: 'sl', smo: 'sm', sna: 'sn', som: 'so', sqi: 'sq', srp: 'sr', ssw: 'ss',
  sot: 'st', sun: 'su', swe: 'sv', swa: 'sw',
  tam: 'ta', tel: 'te', tgk: 'tg', tha: 'th', tir: 'ti', tuk: 'tk', tgl: 'tl',
  tsn: 'tn', ton: 'to', tur: 'tr', tso: 'ts', tat: 'tt', twi: 'tw', tah: 'ty',
  uig: 'ug', ukr: 'uk', urd: 'ur', uzb: 'uz',
  ven: 've', vie: 'vi', vol: 'vo',
  wln: 'wa', wol: 'wo',
  xho: 'xh',
  yid: 'yi', yor: 'yo',
  zha: 'za', zho: 'zh', zul: 'zu',
  // Common individual-language codes that resolve to a macrolanguage 639-1.
  cmn: 'zh', arb: 'ar', pes: 'fa', zsm: 'ms', swh: 'sw', npi: 'ne', ory: 'or'
};

/**
 * Normalize a catalog language value to a valid BCP-47 `lang` attribute value.
 * Replaces a 3-letter primary subtag with its ISO 639-1 equivalent when one
 * exists; any script/region suffix and unknown codes are preserved.
 *
 * @param {string} lang - e.g. "eng", "eng-Latn-US", "grc", "he"
 * @returns {string} e.g. "en", "en-Latn-US", "grc", "he"
 */
export function toBcp47Lang(lang) {
  if (!lang) return lang;
  const parts = String(lang).split('-');
  const primary = parts[0].toLowerCase();
  parts[0] = ISO_639_3_TO_1[primary] ?? primary;
  return parts.join('-');
}

export { ISO_639_3_TO_1 };
