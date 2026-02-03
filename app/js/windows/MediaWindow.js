/**
 * MediaWindow - Web Component for media thumbnails (art, video, maps)
 */

import { BaseWindow, registerWindowComponent } from './BaseWindow.js';
import { Reference } from '../bible/BibleReference.js';
import { i18n } from '../lib/i18n.js';
import { JesusFilmMediaApi } from '../media/ArclightApi.js';

// Constants
const DEFAULT_LANGUAGE = 'eng';
const RESIZE_DEBOUNCE_MS = 100;
const TARGET_ROW_HEIGHT = 80;
const TARGET_GUTTER_WIDTH = 4;

/**
 * MediaWindow Web Component
 * Shows media thumbnails for Bible chapters (art, video, maps)
 */
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
    this.addListener(this.refs.galleryPrev, 'click', () => this.prevGalleryItem());
    this.addListener(this.refs.galleryNext, 'click', () => this.nextGalleryItem());

    this.addListener(this.refs.main, 'keydown', (e) => {
      if (!this.refs.gallery.classList.contains('active')) return;
      if (e.key === 'ArrowLeft') this.prevGalleryItem();
      else if (e.key === 'ArrowRight') this.nextGalleryItem();
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
        this.startResize();
      }, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener('resize', this._resizeHandler, false);

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

    // Handle nav messages (user navigation in BibleWindow)
    if (data.messagetype === 'nav' && data.type === 'bible' && data.locationInfo) {
      const content = document.querySelector(`.section[data-id="${data.locationInfo.sectionid}"]`);
      if (content) {
        this.contentToProcess = content;
        this.processContent();
      }
      return;
    }

    // Handle textload messages (response to content request)
    if (data.messagetype === 'textload' && data.sectionid && data.content) {
      this.handleTextLoadMessage(data);
    }
  }

  handleTextLoadMessage(data) {
    // Parse the content HTML to create a DOM element we can query
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = data.content;

    // Find the section element within the parsed content
    const section = tempContainer.querySelector('.section') || tempContainer;
    section.setAttribute('data-id', data.sectionid);

    // Copy language attributes if available
    if (data.abbr) {
      section.setAttribute('lang', data.abbr);
    }

    this.contentToProcess = section;
    this.processContent();
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

  nextGalleryItem() {
    if (this.state.currentGalleryIndex < this.state.galleryItems.length - 1) {
      this.showGalleryItem(this.state.currentGalleryIndex + 1);
    }
  }

  prevGalleryItem() {
    if (this.state.currentGalleryIndex > 0) {
      this.showGalleryItem(this.state.currentGalleryIndex - 1);
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
    document.querySelectorAll('.checked-media').forEach((el) => {
      el.classList.remove('checked-media');
    });
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
    let html = '';

    contentEl.querySelectorAll('.verse, .v').forEach((verse) => {
      const verseid = verse.getAttribute('data-id');
      const reference = new Reference(verseid);

      const chapter = verse.closest('.chapter');
      if (chapter) {
        verse = chapter.querySelector(`.${verseid}`) ?? verse;
      }

      if (verse.classList.contains('checked-media')) return;

      html += this.renderVerse(verseid, reference);
      verse.classList.add('checked-media');
    });

    return html;
  }

  attachThumbClickHandlers(gallery) {
    gallery.querySelectorAll('a').forEach((a, index) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        this.showGalleryItem(index);
      });
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

    const onImageReady = () => {
      loadedCount++;
      if (loadedCount === totalImages) {
        this.resizeImages(gallery);
        gallery.classList.add('resized');
      }
    };

    images.forEach((img) => {
      img.addEventListener('load', () => {
        img.classList.add('loaded');
        onImageReady();
      }, false);
      img.addEventListener('error', onImageReady, false);
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

  renderVerse(verseid, reference) {
    let html = '';

    for (const mediaLibrary of this.mediaLibraries) {
      const category = this.getFilterCategory(mediaLibrary);
      if (!this.state.filters[category]) continue;

      const mediaForVerse = mediaLibrary.data?.[verseid];
      if (!mediaForVerse) continue;

      for (const mediaInfo of mediaForVerse) {
        if (mediaInfo.filename?.includes('-color')) continue;

        const { fullUrl, thumbUrl } = this.buildMediaUrls(mediaLibrary, mediaInfo);
        const galleryItem = this.createGalleryItem(mediaLibrary, mediaInfo, fullUrl, thumbUrl, reference, category);
        this.state.galleryItems.push(galleryItem);

        html += this.renderThumbLink(galleryItem, mediaLibrary, mediaInfo, reference);
      }
    }

    return html;
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

  // ============================================================================
  // Resize Logic
  // ============================================================================

  startResize() {
    this.resizeImages(this.refs.thumbsContainer.querySelector('.media-library-thumbs'));
  }

  resizeImages(gallery) {
    if (!gallery) return;

    const containerWidth = gallery.offsetWidth;
    let currentWidth = 0;
    let currentRow = [];

    gallery.querySelectorAll('img').forEach((img) => {
      const anchor = img.closest('a');
      const { width, height } = this.getStoredDimensions(img);

      const heightRatio = TARGET_ROW_HEIGHT / height;
      const scaledWidth = Math.floor(heightRatio * width);

      // Check if this image would overflow the row
      if (containerWidth < currentWidth + scaledWidth && currentRow.length > 0) {
        this.fitRowToWidth(currentRow, containerWidth, currentWidth);
        currentRow = [];
        currentWidth = 0;
      }

      this.applyThumbSize(anchor, img, scaledWidth, TARGET_ROW_HEIGHT);
      currentRow.push(anchor);
      currentWidth += scaledWidth + TARGET_GUTTER_WIDTH;
    });
  }

  getStoredDimensions(img) {
    let width = img.getAttribute('data-original-width');
    let height = img.getAttribute('data-original-height');

    if (width === null) {
      width = img.offsetWidth;
      img.setAttribute('data-original-width', width);
    } else {
      width = parseInt(width, 10);
    }

    if (height === null) {
      height = img.offsetHeight;
      img.setAttribute('data-original-height', height);
    } else {
      height = parseInt(height, 10);
    }

    return { width, height };
  }

  fitRowToWidth(row, containerWidth, currentWidth) {
    const remainder = containerWidth - currentWidth;
    const ratio = containerWidth / currentWidth;
    let widthToDistribute = remainder;
    let widthPerItem = Math.ceil(widthToDistribute / row.length);

    row.forEach((anchor, index) => {
      const img = anchor.querySelector('img');
      const anchorWidth = parseInt(anchor.offsetWidth, 10);
      const anchorHeight = parseInt(anchor.offsetHeight, 10);

      const newWidth = anchorWidth + widthPerItem;
      const newHeight = Math.floor(anchorHeight * ratio);

      anchor.style.width = `${newWidth}px`;
      anchor.style.height = `${newHeight}px`;

      if (img) {
        img.style.width = `${newWidth}px`;
        img.style.height = `${newHeight}px`;
      }

      // Remove right margin from last item in row
      if (index === row.length - 1) {
        anchor.style.marginRight = '0';
      }

      widthToDistribute -= widthPerItem;
      if (widthPerItem > widthToDistribute) {
        widthPerItem = widthToDistribute;
      }
    });
  }

  applyThumbSize(anchor, img, width, height) {
    anchor.style.width = `${width}px`;
    anchor.style.height = `${height}px`;
    anchor.style.marginRight = `${TARGET_GUTTER_WIDTH}px`;
    anchor.style.marginBottom = `${TARGET_GUTTER_WIDTH}px`;

    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
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

// Register web component
registerWindowComponent('media-window', MediaWindowComponent, {
  windowType: 'media',
  displayName: 'Media',
  paramKeys: {}
});

// Export with original name for backwards compatibility
export { MediaWindowComponent as MediaWindow };

export default MediaWindowComponent;
