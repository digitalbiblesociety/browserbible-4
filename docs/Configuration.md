# Getting Started

BrowserBible is configured through a central config object in `browserbible/js/core/config.js`. Every property has a sensible default. Override only what you need by calling `updateConfig()` or by registering a custom preset.

## Configuration API

```js
import config, { getConfig, updateConfig, registerCustomConfig } from '@core/config.js';

// Read a value
const version = getConfig().newBibleWindowVersion;

// Override values at runtime
updateConfig({ enableFeedback: true, feedbackUrl: 'https://example.com/feedback' });

// Register a named preset (applied via ?custom=NAME in the URL)
registerCustomConfig('myorg', { customCssUrl: 'myorg.css', enableRestore: true });
```

## URL Parameters

| Parameter | Example | Effect |
|-----------|---------|--------|
| `?dev=true` | | Use `content/texts_dev` instead of `content/texts` |
| `?custom=NAME` | `?custom=dbs` | Apply a registered custom config preset |
| `?w1=bible&t1=ENGWEB&v1=JN1_1` | | Open window 1 as a Bible with text and verse |
| `?eng2p=highlight` | | Set English 2nd-person-plural mode |
| `?eng2pshow=true` | | Show the Eng2p dialog on startup |

Window parameters (`w`, `t`, `v`, `s`) can be numbered 1 through 4 for up to four windows.

---

## Configuration Reference

### General

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `settingsPrefix` | string | `'20140307'` | Namespace for localStorage keys. Change this to reset all saved user settings. |
| `enableOnlineSources` | boolean | `true` | Allow fetching content from remote servers. Set `false` for fully offline deployments. |
| `customCssUrl` | string | `''` | URL of an additional stylesheet loaded at startup. |

### Startup Windows

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `windows` | array | See below | Initial window layout when no saved state exists. |

Default value:

```js
[
  { type: 'bible', data: { textid: 'ENGWEB', fragmentid: 'JN1_1' } },
  { type: 'bible', data: { textid: 'ENGASV', fragmentid: 'JN1_1' } }
]
```

Each entry needs a `type` (window type short-code) and a `data` object with at least `textid` and `fragmentid`.

### Content Paths

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `baseContentUrl` | string | `'https://inscript.bible.cloud/'` | Base URL prepended to all content requests. |
| `textsPath` | string | `'content/texts'` | Relative path to Bible text files. Automatically switches to `'content/texts_dev'` when `?dev=true`. |
| `textsIndexPath` | string | `'texts.json'` | Filename of the texts index within `textsPath`. |
| `aboutPagePath` | string | `'about.html'` | Path to the about page. |
| `baseContentApiPath` | string | `''` | Base path for API content endpoints. |
| `baseContentApiKey` | string | `''` | API key sent with content requests. |
| `serverSearchPath` | string | `'http://localhost:8089/api/bible-search/'` | Server-side search endpoint. |
| `topTexts` | array | `[]` | Text IDs to pin at the top of the text chooser. |

### New Window Defaults

These control the default text and verse when the user opens a new window.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `newBibleWindowVersion` | string | `'ENGWEB'` | Default Bible text for new Bible windows. |
| `newWindowFragmentid` | string | `'JN1_1'` | Default verse (format: `BOOK_CHAPTER` or `BOOK_CHAPTER_VERSE`). |
| `newCommentaryWindowTextId` | string | `'commentary:ENGWES'` | Default commentary (format: `provider:ID`). |
| `newComparisonWindowSourceVersion` | string | `'ENGWEB'` | Source text for new comparison windows. |
| `newComparisonWindowTargetVersion` | string | `'ENGKJV'` | Target text for new comparison windows. |

### Language

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `pinnedLanguage` | string | `'English'` | Primary language shown at top of selectors. |
| `pinnedLanguages` | array | `['English', 'Spanish']` | Languages prioritized in the language list. |
| `defaultLanguage` | string | `''` | Force a UI language at startup. Empty string uses browser detection. |
| `enableLanguageSelector` | boolean | `true` | Show/hide the language selector in settings. |
| `languageSelectorFallbackLang` | string | `'en'` | Fallback locale code when a translation is missing. |

### DBS (Digital Bible Society)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `dbsEnabled` | boolean | `true` | Use DBS as a text source. |
| `dbsKey` | string | `''` | DBS API key. |
| `dbsBase` | string | `'https://api.dbp4.org/'` | DBS API base URL. |
| `dbsTextExclusions` | array | `[]` | Text IDs to hide from the DBS source. |
| `dbsSearchEnabled` | boolean | `false` | Enable server-side search through DBS. |
| `dbsAudioEnabled` | boolean | `true` | Enable DBS audio Bibles. |
| `dbsAudioUrl` | string | `'https://audio.dbs.org'` | DBS audio server URL. |

### FCBH (Faith Comes By Hearing)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `fcbhKey` | string | `''` | FCBH API key. |
| `fcbhTextExclusions` | array | `[]` | Text IDs to exclude from FCBH. |
| `fcbhLoadVersions` | boolean | `false` | Load Bible versions from FCBH. |
| `fcbhApiUrl` | string | `'https://dbt.io'` | FCBH API endpoint. |
| `jfmKey` | string | `''` | Jesus Film Movements API key. |

### Arclight

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `arclightApiKey` | string | `'52b06248a3c6e8.12980089'` | Arclight API key for maps and media. |
| `arclightApiUrl` | string | `'https://api.arclight.org/v2'` | Arclight API base URL. |

### Window Types

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enableAudioWindow` | boolean | `true` | Enable the audio Bible window type. |
| `audioWindowDefaultBibleVersion` | string | `'ENGESV'` | Default text for audio windows. |
| `audioWindowDefaultBibleFragmentid` | string | `'JN1_1'` | Default verse for audio windows. |
| `enableDeafBibleWindow` | boolean | `true` | Enable the deaf Bible window type. |
| `deafBibleWindowDefaultBibleVersion` | string | `'deaf_ASESLV'` | Default text for deaf Bible windows. |
| `deafBibleWindowDefaultBibleFragmentid` | string | `'JN1_1'` | Default verse for deaf Bible windows. |
| `windowTypesOrder` | array | `[]` | Custom ordering for the Add Window menu. Empty uses registration order. |

### Menu & UI

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enableNavigationButtons` | boolean | `true` | Show back/forward navigation. |
| `enableUrlCopier` | boolean | `true` | Show the shareable-URL button. |
| `enableRestore` | boolean | `false` | Show a reset-to-defaults button. |
| `enableFeedback` | boolean | `false` | Show the feedback form button. |
| `feedbackUrl` | string | `''` | Endpoint for feedback submissions. |

### Theme & Typography

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enableThemeSelector` | boolean | `true` | Show the theme picker in settings. |
| `enableFontSizeSelector` | boolean | `true` | Show the font-size slider. |
| `fontSizeMin` | number | `14` | Minimum font size (px). |
| `fontSizeMax` | number | `28` | Maximum font size (px). |
| `fontSizeDefault` | number | `18` | Default font size (px). |
| `enableFontFamilySelector` | boolean | `true` | Show the font-family picker. |
| `fontFamilyStacks` | object | See below | Available font families and their CSS stacks. |

Default font stacks:

| Display Name | CSS Stack |
|-------------|-----------|
| Cambria | `Cambria, Georgia, serif` |
| Georgia | `Georgia, serif` |
| Palatino | `"Palatino Linotype", "Book Antiqua", Palatino, serif` |
| Times | `"Times New Roman", Times, serif` |
| Arial | `Arial, Helvetica, sans-serif` |
| Comic Sans | `"Comic Sans MS", cursive, sans-serif` |
| Impact | `Impact, Charcoal, sans-serif` |
| Lucida | `"Lucida Sans Unicode", "Lucida Grande", sans-serif` |
| Tahoma | `Tahoma, Geneva, sans-serif` |
| Trebuchet | `"Trebuchet MS", Helvetica, sans-serif` |
| Verdana | `Verdana, Geneva, sans-serif` |
| Courier | `"Courier New", Courier, monospace` |
| Lucida Console | `"Lucida Console", Monaco, monospace` |
| EzraSIL | `EzraSIL, "Times New Roman", serif` |

### Display Toggles

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enableSettingToggles` | boolean | `true` | Show the display-toggle switches. |
| `settingToggleNames` | array | `['Chapters', 'Verses', 'Titles', 'Notes', 'Words of Christ', 'Media', 'Justify']` | Toggle labels. |
| `settingToggleDefaults` | array | `[true, true, true, true, true, true, false]` | Default on/off state for each toggle (index matches `settingToggleNames`). |

### Plugins

All plugin settings are booleans that enable or disable the feature. Defaults are `true` unless noted.

| Property | Default | Description |
|----------|---------|-------------|
| `enableCrossReferencePopupPlugin` | `true` | Popup showing cross-references on verse hover. |
| `enableNotesPopupPlugin` | `true` | Popup showing user notes on verse hover. |
| `enableLemmaPopupPlugin` | `true` | Popup with Greek/Hebrew lemma information. |
| `enableLemmaInfoPlugin` | `true` | Lemma detail panel. |
| `enableLemmaMatchPlugin` | `true` | Highlight matching lemmas across windows. |
| `enableVerseMatchPlugin` | `true` | Highlight corresponding verses across windows. |
| `enableVisualFilters` | `true` | Visual filter effects on text. |
| `enableHighlighterPlugin` | `true` | User text-highlighting tool. |
| `enableMediaLibraryPlugin` | `true` | Media library integration. |

### English 2nd-Person Plural (Eng2p)

Shows English readers where "you" is plural in the original languages.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enableEng2pPlugin` | boolean | `true` | Enable the Eng2p feature. |
| `eng2pEnableAll` | boolean | `true` | Show all dialect options. When `false`, only core options appear. |
| `eng2pDefaultSetting` | string | `'none'` | Default mode: `'none'`, `'highlight'`, or a dialect name. |
| `eng2pEnableYe` | boolean | `true` | Include "Ye" (Old English) option. |
| `eng2pEnableThee` | boolean | `true` | Include "Thee" variant. |
| `eng2pEnableEth` | boolean | `true` | Include "Eth" variant. |
| `eng2pEnableSt` | boolean | `true` | Include "St" variant. |

---

## User Settings Storage

User preferences (font size, theme, toggle states, window layout) are persisted in `localStorage`. Keys are namespaced with the `settingsPrefix` value. Changing `settingsPrefix` effectively resets all saved settings for every user.
