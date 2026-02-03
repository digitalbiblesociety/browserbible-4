import { BaseWindow, registerWindowComponent } from './BaseWindow.js';
import { Reference } from '../bible/BibleReference.js';
import { i18n } from '../lib/i18n.js';
import { JesusFilmMediaApi } from '../media/ArclightApi.js';

const DEFAULT_LANGUAGE = 'eng';
const RESIZE_DEBOUNCE_MS = 100;
const TARGET_ROW_HEIGHT = 80;
const TARGET_GUTTER_WIDTH = 4;

export class MediaWindowComponent extends BaseWindow {
  constructor() {
    super();

    this.state = {
      ...this.state,
      currentSectionId: '',
      currentLanguage: DEFAULT_LANGUAGE,
      filters: {
        art: true,
        video: true,
        maps: true
      },
      galleryItems: [],
      currentGalleryIndex: -1
    };

    this.mediaLibraries = null;
    this.contentToProcess = null;

    this._resizeTimeout = null;
    this._resizeHandler = null;
  }

  async render() {
    this.innerHTML = `
      <div class="window-header">
        <div class="media-filters">
          <button class="media-filter-btn active" data-filter="art" title="Art &amp; Images">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </button>
          <button class="media-filter-btn active" data-filter="video" title="Videos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
          <button class="media-filter-btn active" data-filter="maps" title="Maps">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
              <line x1="8" y1="2" x2="8" y2="18"></line>
              <line x1="16" y1="6" x2="16" y2="22"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="window-main">
        <div class="media-gallery">
          <div class="media-gallery-viewer">
            <div class="media-gallery-content"></div>
          </div>
          <div class="media-gallery-controls">
            <button class="media-gallery-prev" title="Previous">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <div class="media-gallery-info">
              <span class="media-gallery-title"></span>
              <span class="media-gallery-counter"></span>
            </div>
            <button class="media-gallery-next" title="Next">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
        <div class="media-thumbs-container">
          <div class="media-video"></div>
          <div class="media-content"></div>
        </div>
      </div>
    `;
  }

  cacheRefs() {
    super.cacheRefs();

    this.refs.header = this.$('.window-header');
    this.refs.main = this.$('.window-main');
    this.refs.gallery = this.$('.media-gallery');
    this.refs.galleryContent = this.$('.media-gallery-content');
    this.refs.galleryTitle = this.$('.media-gallery-title');
    this.refs.galleryCounter = this.$('.media-gallery-counter');
    this.refs.galleryPrev = this.$('.media-gallery-prev');
    this.refs.galleryNext = this.$('.media-gallery-next');
    this.refs.thumbsContainer = this.$('.media-thumbs-container');
  }

  attachEventListeners() {
    this.$$('.media-filter-btn').forEach(btn => {
      this.addListener(btn, 'click', () => {
        const filterType = btn.getAttribute('data-filter');
        this.state.filters[filterType] = !this.state.filters[filterType];
        btn.classList.toggle('active', this.state.filters[filterType]);

        // Force re-render
        this.state.currentSectionId = '';
        this.processContent();
      });
    });

    // Gallery control handlers
    this.addListener(this.refs.galleryPrev, 'click', () => this.navigateGallery(-1));
    this.addListener(this.refs.galleryNext, 'click', () => this.navigateGallery(1));

    this.addListener(this.refs.main, 'keydown', (e) => {
      if (!this.refs.gallery.classList.contains('active')) return;
      if (e.key === 'ArrowLeft') this.navigateGallery(-1);
      else if (e.key === 'ArrowRight') this.navigateGallery(1);
      else if (e.key === 'Escape') this.refs.gallery.classList.remove('active');
    });

    this.addListener(this.refs.galleryContent, 'click', (e) => {
      if (e.target.tagName === 'IMG') {
        this.refs.gallery.classList.remove('active');
      }
    });

    this._resizeHandler = () => {
      if (this._resizeTimeout !== null) {
        clearTimeout(this._resizeTimeout);
      }
      this._resizeTimeout = setTimeout(() => {
        requestAnimationFrame(() => this.startResize());
      }, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener('resize', this._resizeHandler, { passive: true });

    this.on('message', (e) => this.handleMessage(e));
  }

  async init() {
    i18n.translatePage(this.refs.header);

    const MediaLibrary = window.MediaLibrary;

    if (MediaLibrary) {
      MediaLibrary.getMediaLibraries((data) => {
        this.mediaLibraries = data;
        // Request current content once media libraries are loaded
        this.requestCurrentContent();
      });
    }
  }

  cleanup() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this._resizeTimeout) {
      clearTimeout(this._resizeTimeout);
    }

    super.cleanup();
  }

  handleMessage(e) {
    const { data } = e;
    let content = null;

    if (data.messagetype === 'nav' && data.type === 'bible' && data.locationInfo) {
      content = document.querySelector(`.section[data-id="${data.locationInfo.sectionid}"]`);
    } else if (data.messagetype === 'textload' && data.sectionid && data.content) {
      const temp = document.createElement('div');
      temp.innerHTML = data.content;
      content = temp.querySelector('.section') || temp;
      content.setAttribute('data-id', data.sectionid);
      if (data.abbr) content.setAttribute('lang', data.abbr);
    }

    if (content) {
      this.contentToProcess = content;
      this.processContent();
    }
  }

  requestCurrentContent() {
    // Request current content from BibleWindow (similar to MapWindow pattern)
    this.trigger('globalmessage', {
      type: 'globalmessage',
      target: this,
      data: {
        messagetype: 'maprequest',
        requesttype: 'currentcontent'
      }
    });
  }

  async showGalleryItem(index) {
    if (index < 0 || index >= this.state.galleryItems.length) return;
    this.state.currentGalleryIndex = index;
    const item = this.state.galleryItems[index];
    const oldVideo = this.refs.galleryContent.querySelector('video');
    if (oldVideo) oldVideo.pause();

    const mediaEl = await this.createMediaElement(item);
    this.clearGalleryContent();
    if (mediaEl) {
      this.refs.galleryContent.appendChild(mediaEl);
    }

    this.updateGalleryUI(item, index);
  }

  clearGalleryContent() {
    this.refs.galleryContent.innerHTML = '';
  }

  createVideoElement(src, options = {}) {
    const video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.autoplay = options.autoplay ?? true;
    if (options.poster) video.poster = options.poster;
    return video;
  }

  createImageElement(src, alt) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    return img;
  }

  async createMediaElement(item) {
    if (item.type === 'image') {
      return this.createImageElement(item.url, item.title || item.reference);
    }

    if (item.type === 'video') {
      return this.createVideoElement(item.url);
    }

    if (item.type === 'jfm') {
      return this.createJfmVideoElement(item);
    }

    return null;
  }

  async createJfmVideoElement(item) {
    // Show loading indicator
    this.refs.galleryContent.innerHTML = '<div class="media-gallery-loading">Loading video...</div>';

    let videoData = null;
    try {
      videoData = await JesusFilmMediaApi.getVideoData(this.state.currentLanguage, item.chapterNumber);
    } catch { /* empty */ }

    if (videoData) {
      if (videoData.title) item.title = videoData.title;
      return this.createVideoElement(videoData.url, {
        poster: videoData.poster || videoData.thumbnail || ''
      });
    }

    return this.createVideoElement(item.url);
  }

  buildItemTitle(item) {
    let title = item.title || item.reference;
    if (item.artist) {
      title += ` - ${item.artist}`;
      if (item.date) {
        title += ` (${item.date})`;
      }
    }
    return title;
  }

  updateGalleryUI(item, index) {
    this.refs.galleryTitle.textContent = this.buildItemTitle(item);
    this.refs.galleryCounter.textContent = `${index + 1} / ${this.state.galleryItems.length}`;

    this.refs.galleryPrev.disabled = index === 0;
    this.refs.galleryNext.disabled = index === this.state.galleryItems.length - 1;

    this.refs.gallery.classList.add('active');

    this.refs.thumbsContainer.querySelectorAll('.media-library-thumbs a').forEach((a, i) => {
      a.classList.toggle('selected', i === index);
    });
  }

  navigateGallery(delta) {
    const newIndex = this.state.currentGalleryIndex + delta;
    if (newIndex >= 0 && newIndex < this.state.galleryItems.length) {
      this.showGalleryItem(newIndex);
    }
  }

  processContent() {
    if (!this.mediaLibraries || !this.contentToProcess) return;

    const contentEl = this.contentToProcess;
    const sectionid = contentEl.getAttribute('data-id');

    if (this.state.currentSectionId === sectionid) return;

    this.state.currentSectionId = sectionid;
    this.state.currentLanguage = this.extractContentLanguage(contentEl);

    const bibleReference = new Reference(sectionid);
    bibleReference.language = contentEl.getAttribute('lang');

    this.resetGalleryState();
    this.clearCheckedMediaMarkers();

    const thumbsGallery = this.createThumbsContainer(bibleReference);
    const html = this.renderVerses(contentEl);

    thumbsGallery.innerHTML = html;
    this.attachThumbClickHandlers(thumbsGallery);
    this.setupImageLoadTracking(thumbsGallery);
  }

  extractContentLanguage(el) {
    return el.getAttribute('data-lang3') ||
           el.getAttribute('lang3') ||
           el.getAttribute('lang') ||
           DEFAULT_LANGUAGE;
  }

  resetGalleryState() {
    this.state.galleryItems = [];
    this.state.currentGalleryIndex = -1;
    this.refs.gallery.classList.remove('active');
    this.clearGalleryContent();
    this.refs.thumbsContainer.innerHTML = '';
    this.refs.main.scrollTop = 0;
  }

  clearCheckedMediaMarkers() {
    // Scope to content element instead of entire document
    const scope = this.contentToProcess || document;
    const markers = scope.querySelectorAll('.checked-media');
    for (let i = 0; i < markers.length; i++) {
      markers[i].classList.remove('checked-media');
    }
  }

  createThumbsContainer(bibleReference) {
    const node = this.createElement(`<div class="media-library-verses">
      <h2>${bibleReference.toString()}</h2>
      <div class="media-library-thumbs"></div>
    </div>`);
    this.refs.thumbsContainer.appendChild(node);
    return node.querySelector('.media-library-thumbs');
  }

  renderVerses(contentEl) {
    const htmlParts = [];
    const verses = contentEl.querySelectorAll('.verse, .v');

    for (let i = 0; i < verses.length; i++) {
      let verse = verses[i];
      const verseid = verse.getAttribute('data-id');
      if (!verseid) continue;

      const chapter = verse.closest('.chapter');
      if (chapter) {
        verse = chapter.querySelector(`.${verseid}`) ?? verse;
      }

      if (verse.classList.contains('checked-media')) continue;

      const reference = new Reference(verseid);
      this.renderVerseInto(verseid, reference, htmlParts);
      verse.classList.add('checked-media');
    }

    return htmlParts.join('');
  }

  attachThumbClickHandlers(gallery) {
    // Event delegation - single listener instead of one per thumbnail
    gallery.addEventListener('click', (e) => {
      const anchor = e.target.closest('a');
      if (!anchor) return;
      e.preventDefault();
      const index = parseInt(anchor.dataset.index, 10);
      if (!isNaN(index)) {
        this.showGalleryItem(index);
      }
    });
  }

  setupImageLoadTracking(gallery) {
    const images = gallery.querySelectorAll('img');

    if (images.length === 0) {
      gallery.innerHTML = '<div class="media-no-content">No media for this chapter</div>';
      gallery.classList.add('resized');
      return;
    }

    let loadedCount = 0;
    const totalImages = images.length;
    let resizeScheduled = false;

    const scheduleResize = () => {
      if (resizeScheduled) return;
      resizeScheduled = true;
      requestAnimationFrame(() => {
        this.resizeImages(gallery);
        resizeScheduled = false;
        if (loadedCount === totalImages) {
          gallery.classList.add('resized');
        }
      });
    };

    const onImageReady = () => {
      loadedCount++;
      // Resize progressively as images load, batched via rAF
      scheduleResize();
    };

    images.forEach((img) => {
      if (img.complete) {
        img.classList.add('loaded');
        onImageReady();
      } else {
        img.addEventListener('load', () => {
          img.classList.add('loaded');
          onImageReady();
        }, { once: true });
        img.addEventListener('error', onImageReady, { once: true });
      }
    });
  }

  getFilterCategory(mediaLibrary) {
    if (mediaLibrary.type === 'jfm' || mediaLibrary.type === 'video') {
      return 'video';
    }
    if (mediaLibrary.folder === 'maps' || mediaLibrary.iconClassName === 'map-icon') {
      return 'maps';
    }
    return 'art';
  }

  renderVerseInto(verseid, reference, htmlParts) {
    const libraries = this.mediaLibraries;
    const filters = this.state.filters;
    const galleryItems = this.state.galleryItems;

    for (let i = 0; i < libraries.length; i++) {
      const mediaLibrary = libraries[i];
      const category = this.getFilterCategory(mediaLibrary);
      if (!filters[category]) continue;

      const mediaForVerse = mediaLibrary.data?.[verseid];
      if (!mediaForVerse) continue;

      for (let j = 0; j < mediaForVerse.length; j++) {
        const mediaInfo = mediaForVerse[j];
        if (mediaInfo.filename?.includes('-color')) continue;

        const { fullUrl, thumbUrl } = this.buildMediaUrls(mediaLibrary, mediaInfo);
        const galleryItem = this.createGalleryItem(mediaLibrary, mediaInfo, fullUrl, thumbUrl, reference, category);
        galleryItems.push(galleryItem);

        htmlParts.push(this.renderThumbLink(galleryItem, mediaLibrary, mediaInfo, reference));
      }
    }
  }

  buildMediaUrls(mediaLibrary, mediaInfo) {
    if (mediaLibrary.baseUrl) {
      const largeSuffix = mediaLibrary.largeSuffix || `.${mediaInfo.exts}`;
      const thumbSuffix = mediaLibrary.thumbSuffix || '-thumb.jpg';
      return {
        fullUrl: `${mediaLibrary.baseUrl}${mediaInfo.filename}${largeSuffix}`,
        thumbUrl: `${mediaLibrary.baseUrl}${mediaInfo.filename}${thumbSuffix}`
      };
    }

    const baseUrl = `${this.config.baseContentUrl}content/media/${mediaLibrary.folder}/`;
    const ext = Array.isArray(mediaInfo.exts) ? mediaInfo.exts[0] : mediaInfo.exts;
    return {
      fullUrl: `${baseUrl}${mediaInfo.filename}.${ext}`,
      thumbUrl: `${baseUrl}${mediaInfo.filename}-thumb.jpg`
    };
  }

  createGalleryItem(mediaLibrary, mediaInfo, fullUrl, thumbUrl, reference, category) {
    return {
      url: fullUrl,
      thumbUrl,
      type: mediaLibrary.type,
      title: mediaInfo.name || mediaInfo.title || '',
      artist: mediaInfo.artist || '',
      date: mediaInfo.date || '',
      reference: reference.toString(),
      category,
      chapterNumber: mediaLibrary.type === 'jfm' ? mediaInfo.filename : null
    };
  }

  renderThumbLink(galleryItem, mediaLibrary, mediaInfo, reference) {
    const titleAttr = galleryItem.title ? `title="${this.escapeHtml(galleryItem.title)}"` : '';
    const playIndicator = mediaLibrary.type !== 'image' ? '<b><i></i></b>' : '';

    return `<a href="${galleryItem.url}" class="mediatype-${mediaLibrary.type} mediacategory-${galleryItem.category}" ${titleAttr} data-filename="${mediaInfo.filename}" data-index="${this.state.galleryItems.length - 1}">
      <img src="${galleryItem.thumbUrl}" />
      ${playIndicator}
      <span>${reference.toString()}</span>
    </a>`;
  }

  startResize() {
    this.resizeImages(this.refs.thumbsContainer.querySelector('.media-library-thumbs'));
  }

  resizeImages(gallery) {
    if (!gallery) return;
    const images = gallery.querySelectorAll('img');
    if (!images.length) return;

    const containerWidth = gallery.offsetWidth;
    let row = [], rowWidth = 0;

    const flushRow = (fit) => {
      if (!row.length) return;
      const scale = fit && row.length > 1 ? containerWidth / rowWidth : 1;
      for (let i = 0; i < row.length; i++) {
        const { anchor, img, sw } = row[i];
        this.applyThumbStyles(anchor, img,
          Math.round(sw * scale),
          Math.round(TARGET_ROW_HEIGHT * scale),
          fit && i === row.length - 1);
      }
      row = [];
      rowWidth = 0;
    };

    for (const img of images) {
      const anchor = img.closest('a');
      if (!anchor) continue;

      let { originalWidth: ow, originalHeight: oh } = img.dataset;
      if (!ow) {
        ow = img.offsetWidth || img.naturalWidth || TARGET_ROW_HEIGHT;
        oh = img.offsetHeight || img.naturalHeight || TARGET_ROW_HEIGHT;
        img.dataset.originalWidth = ow;
        img.dataset.originalHeight = oh;
      }

      const sw = Math.floor(TARGET_ROW_HEIGHT * ow / (oh || TARGET_ROW_HEIGHT));
      if (rowWidth + sw > containerWidth && row.length) flushRow(true);
      row.push({ anchor, img, sw });
      rowWidth += sw + TARGET_GUTTER_WIDTH;
    }
    flushRow(false);
  }

  applyThumbStyles(anchor, img, width, height, isLastInRow) {
    const widthPx = `${width}px`;
    const heightPx = `${height}px`;

    anchor.style.cssText = `width:${widthPx};height:${heightPx};margin-right:${isLastInRow ? '0' : TARGET_GUTTER_WIDTH + 'px'};margin-bottom:${TARGET_GUTTER_WIDTH}px`;
    img.style.cssText = `width:${widthPx};height:${heightPx}`;
  }
  
  size(width, height) {
    const headerHeight = this.refs.header.offsetHeight;
    this.refs.main.style.height = `${height - headerHeight}px`;
    this.refs.main.style.width = `${width}px`;

    this.startResize();
  }

  getData() {
    return {
      params: {
        'win': 'media'
      }
    };
  }
}

registerWindowComponent('media-window', MediaWindowComponent, {
  windowType: 'media',
  displayName: 'Media',
  paramKeys: {}
});

export { MediaWindowComponent as MediaWindow };
