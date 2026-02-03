# Verse Detection Plugin

A multi-language Bible verse reference detection system that finds, parses, and optionally displays verse references in text with links and popups.

## Features

- **Multi-language support**: Detects verse references in 10 languages (English, Spanish, Portuguese, French, German, Russian, Arabic, Hindi, Chinese Simplified, Indonesian)
- **Flexible display modes**: Links, popups, or both
- **Auto-detection**: Automatically detects document language from HTML attributes
- **Standalone or integrated**: Works independently or with Browser Bible 4
- **Tree-shakeable**: Import only the languages you need
- **Popup with caching**: Fetches verse content with built-in caching
- **Social sharing**: Built-in buttons for Facebook, X/Twitter, Bluesky, and clipboard copy

## Building

From the `verse-detection` directory:

```bash
npm install
npm run build
```

This runs `tsc` and `vite` to compile TypeScript and bundle the output to `dist/`.

## Usage

### Option A: Basic Detection Only

For lightweight detection without popups:

```typescript
import { createVerseDetector } from './verse-detection/index.js';

const detector = createVerseDetector({ language: 'es' });
const verses = detector.detectVerses('Lee Juan 3:16 y Romanos 8:28');

// Returns array of ParsedVerseReference objects with:
// - canonicalBook: normalized book name
// - variation: original text as written
// - chapter, verse, endChapter, endVerse
// - detectedLanguage
// - startIndex, endIndex (position in text)
```

### Option B: Full System with Popups

```typescript
import { initVerseDetection } from './verse-detection/index.js';

const verseSystem = await initVerseDetection(app, {
  displayMode: 'both',
  popup: {
    showDelay: 300,
    maxWidth: 400,
    showLogo: true
  },
  language: {
    autoDetect: true,
    additional: 'all'
  }
});

// Process text and get HTML with links
const html = verseSystem.processText('Read John 3:16 and Rom 8:28');

// Process a DOM container element
verseSystem.processContainer(document.querySelector('.content'));
```

### Option C: Auto-Initialize Script (Standalone)

Include the auto-init script with data attributes:

```html
<script src="verse-detection-auto.js"
  data-app-url="https://inscript.org"
  data-mode="both"
  data-selector=".content"
  data-language="es"
  data-show-logo="true"
></script>
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `displayMode` | `'link'` \| `'popup'` \| `'both'` | `'both'` | How to display detected verses |
| `language.primary` | `string` | `'en'` | Primary language for detection |
| `language.autoDetect` | `boolean` | `true` | Auto-detect from HTML lang attribute |
| `language.additional` | `string[]` \| `'all'` | `[]` | Additional languages to load |
| `popup.showDelay` | `number` | `300` | Delay before showing popup (ms) |
| `popup.maxWidth` | `number` | `400` | Maximum popup width (px) |
| `popup.showLogo` | `boolean` | `true` | Show logo in popup |
| `link.baseUrl` | `string` | - | Base URL for verse links |
| `link.openInNewTab` | `boolean` | `false` | Open links in new tab |
| `styling.highlight` | `boolean` | `true` | Highlight verse references |
| `detection.excludeSelectors` | `string[]` | `[]` | CSS selectors to skip |

## API Reference

### Detection Methods

```typescript
// Find all verse references in text
detectVerses(text: string): ParsedVerseReference[]

// Check if text contains any verse references
containsVerses(text: string): boolean

// Normalize a reference to canonical form
normalizeReference(reference: string): string | null
```

### Transformation Methods

```typescript
// Replace verses with custom formatting
replaceVerses(text: string, formatter: Function): string

// Convert verses to HTML links
linkVerses(text: string, baseUrl?: string): string

// Process text with configured display mode
processText(text: string): string

// Process a DOM element (adds popups/links)
processContainer(element: HTMLElement): void
```

### Language Methods

```typescript
// Set active languages
setLanguage(languages: string | string[]): void

// Get currently active language codes
getCurrentLanguages(): string[]

// Get all supported language codes
getSupportedLanguages(): string[]
// Returns: ['en', 'es', 'pt', 'fr', 'de', 'ru', 'ar', 'hi', 'zh', 'id']

// Auto-detect language from document
detectDocumentLanguage(): string | null
```

### Utility Methods

```typescript
// Get all book name patterns
getBookPatterns(): BookPatterns

// Look up canonical book name from variation
getCanonicalBookName(variation: string): string | null

// Access the compiled regex pattern
getVerseRegex(): RegExp
```

## Supported Languages

| Code | Language |
|------|----------|
| `en` | English |
| `es` | Spanish |
| `pt` | Portuguese |
| `fr` | French |
| `de` | German |
| `ru` | Russian |
| `ar` | Arabic |
| `hi` | Hindi |
| `zh` | Chinese (Simplified) |
| `id` | Indonesian |

## File Structure

```
verse-detection/
├── VerseDetectionPlugin.ts   # Main plugin logic & API
├── VersePopup.ts             # Popup display & content fetching
├── config.ts                 # Configuration defaults & merging
├── bookNames.ts              # Book name data management
├── languages/
│   ├── index.ts              # Language module aggregator
│   ├── types.ts              # Shared types
│   ├── en.ts                 # English book names
│   ├── es.ts                 # Spanish book names
│   └── ...                   # Other language files
├── auto.ts                   # Auto-initialization script
├── index.ts                  # Main export file
├── vite.config.ts            # Build configuration
└── package.json              # Package metadata
```

## Build Output

- `dist/verse-detection.js` - Main bundle with popup support
- `dist/verse-detection-auto.js` - Standalone auto-init script
- `dist/languages/*.js` - Individual language modules (tree-shakeable)

## Examples

### Detecting verses in multiple languages

```typescript
const detector = createVerseDetector({
  language: {
    primary: 'en',
    additional: ['es', 'pt']
  }
});

// Detects English, Spanish, and Portuguese references
detector.detectVerses('Read John 3:16, Juan 3:16, and João 3:16');
```

### Custom link formatting

```typescript
const html = detector.replaceVerses(text, (match, parsed) => {
  return `<a href="/bible/${parsed.canonicalBook}/${parsed.chapter}/${parsed.verse}">${match}</a>`;
});
```

### Processing page content on load

```typescript
document.addEventListener('DOMContentLoaded', async () => {
  const verseSystem = await initVerseDetection(null, {
    displayMode: 'popup',
    contentSource: {
      type: 'remote',
      baseUrl: 'https://api.example.com/verses'
    }
  });

  verseSystem.processContainer(document.body);
});
```

## License

Part of Browser Bible 4.
