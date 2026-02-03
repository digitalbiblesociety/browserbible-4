/**
 * MediaWindow - Web Component for media thumbnails (art, video, maps)
 */

import { BaseWindow, registerWindowComponent } from './BaseWindow.js';
import { Reference } from '../bible/BibleReference.js';
import { i18n } from '../lib/i18n.js';
import { getApp } from '../core/registry.js';
import { JesusFilmMediaApi } from '../media/ArclightApi.js';

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
      currentLanguage: 'eng',
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
      }, 100);
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
        this.processContent();
      });
    }

    setTimeout(() => {
      const app = getApp();
      if (app?.windowManager) {
        const firstWindowSettings = app.windowManager.getSettings()[0];
        const firstWin = document.querySelector('.window');

        if (firstWindowSettings?.data && firstWin) {
          const selectedChapter = firstWin.querySelector(`.section[data-id="${firstWindowSettings.data.sectionid}"]`);

          if (selectedChapter !== null) {
            this.contentToProcess = selectedChapter;
            this.processContent();
          }
        }
      }
    }, 500);
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
    if (e.data.messagetype === 'nav' && e.data.type === 'bible' && e.data.locationInfo) {
      const content = document.querySelector(`.section[data-id="${e.data.locationInfo.sectionid}"]`);
      this.contentToProcess = content;
      this.processContent();
    }
  }

  async showGalleryItem(index) {
    if (index < 0 || index >= this.state.galleryItems.length) return;

    this.state.currentGalleryIndex = index;
    const item = this.state.galleryItems[index];

    // Clear previous content
    this.refs.galleryContent.innerHTML = '';

    const oldVideo = this.refs.galleryContent.querySelector('video');
    if (oldVideo) oldVideo.pause();

    if (item.type === 'jfm') {
      this.refs.galleryContent.innerHTML = '<div class="media-gallery-loading">Loading video...</div>';
    }

    let mediaEl;
    if (item.type === 'image') {
      mediaEl = document.createElement('img');
      mediaEl.src = item.url;
      mediaEl.alt = item.title || item.reference;
    } else if (item.type === 'video') {
      mediaEl = document.createElement('video');
      mediaEl.src = item.url;
      mediaEl.controls = true;
      mediaEl.autoplay = true;
    } else if (item.type === 'jfm') {
      let videoData = null;
      try {
        videoData = await JesusFilmMediaApi.getVideoData(this.state.currentLanguage, item.chapterNumber);
      } catch (err) { /* empty */ }

      this.refs.galleryContent.innerHTML = '';
      mediaEl = document.createElement('video');
      mediaEl.controls = true;
      mediaEl.autoplay = true;

      if (videoData) {
        mediaEl.src = videoData.url;
        mediaEl.poster = videoData.poster || videoData.thumbnail || '';
        if (videoData.title) {
          item.title = videoData.title;
        }
      } else {
        mediaEl.src = item.url;
      }
    }

    if (mediaEl) {
      this.refs.galleryContent.innerHTML = '';
      this.refs.galleryContent.appendChild(mediaEl);
    }

    let titleText = item.title || item.reference;
    if (item.artist) {
      titleText += ` - ${item.artist}`;
      if (item.date) {
        titleText += ` (${item.date})`;
      }
    }
    this.refs.galleryTitle.textContent = titleText;
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
    if (this.mediaLibraries === null || this.contentToProcess === null) {
      return;
    }

    const contentEl = this.contentToProcess;
    const sectionid = contentEl.getAttribute('data-id');

    if (this.state.currentSectionId === sectionid) {
      return;
    }

    this.state.currentSectionId = sectionid;

    const bibleReference = new Reference(sectionid);
    bibleReference.language = contentEl.getAttribute('lang');

    this.state.currentLanguage = contentEl.getAttribute('data-lang3') ||
                                  contentEl.getAttribute('lang3') ||
                                  contentEl.getAttribute('lang') ||
                                  'eng';

    document.querySelectorAll('.checked-media').forEach((el) => {
      el.classList.remove('checked-media');
    });

    this.state.galleryItems = [];
    this.state.currentGalleryIndex = -1;
    this.refs.gallery.classList.remove('active');
    this.refs.galleryContent.innerHTML = '';

    this.refs.thumbsContainer.innerHTML = '';
    this.refs.main.scrollTop = 0;

    const node = this.createElement(`<div class="media-library-verses">
      <h2>${bibleReference.toString()}</h2>
      <div class="media-library-thumbs"></div>
    </div>`);
    this.refs.thumbsContainer.appendChild(node);
    const thumbsGallery = node.querySelector('.media-library-thumbs');
    let html = '';

    contentEl.querySelectorAll('.verse, .v').forEach((verse) => {
      const verseid = verse.getAttribute('data-id');
      const reference = new Reference(verseid);

      const chapter = verse.closest('.chapter');
      if (chapter) {
        verse = chapter.querySelector(`.${verseid}`) ?? verse;
      }

      if (verse.classList.contains('checked-media')) {
        return;
      }

      html += this.renderVerse(verseid, reference);

      verse.classList.add('checked-media');
    });

    thumbsGallery.innerHTML = html;

    thumbsGallery.querySelectorAll('a').forEach((a, index) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        this.showGalleryItem(index);
      });
    });

    const images = thumbsGallery.querySelectorAll('img');

    if (images.length === 0) {
      thumbsGallery.innerHTML = '<div class="media-no-content">No media for this chapter</div>';
      thumbsGallery.classList.add('resized');
      return;
    }

    let loadedCount = 0;
    const onImageReady = () => {
      loadedCount++;
      if (loadedCount === images.length) {
        this.resizeImages(thumbsGallery);
        thumbsGallery.classList.add('resized');
      }
    };
    images.forEach((img) => {
      img.addEventListener('load', function() {
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

    for (let i = 0, il = this.mediaLibraries.length; i < il; i++) {
      const mediaLibrary = this.mediaLibraries[i];

      const category = this.getFilterCategory(mediaLibrary);
      if (!this.state.filters[category]) {
        continue;
      }

      const mediaForVerse = mediaLibrary.data?.[verseid];

      if (mediaForVerse !== undefined) {
        for (let j = 0, jl = mediaForVerse.length; j < jl; j++) {
          const mediaInfo = mediaForVerse[j];

          if (mediaInfo.filename && mediaInfo.filename.includes('-color')) {
            continue;
          }

          let fullUrl, thumbUrl;
          if (mediaLibrary.baseUrl) {
            const largeSuffix = mediaLibrary.largeSuffix || `.${mediaInfo.exts}`;
            const thumbSuffix = mediaLibrary.thumbSuffix || '-thumb.jpg';
            fullUrl = `${mediaLibrary.baseUrl}${mediaInfo.filename}${largeSuffix}`;
            thumbUrl = `${mediaLibrary.baseUrl}${mediaInfo.filename}${thumbSuffix}`;
          } else {
            const baseUrl = `${this.config.baseContentUrl}content/media/${mediaLibrary.folder}/`;
            const ext = Array.isArray(mediaInfo.exts) ? mediaInfo.exts[0] : mediaInfo.exts;
            fullUrl = `${baseUrl}${mediaInfo.filename}.${ext}`;
            thumbUrl = `${baseUrl}${mediaInfo.filename}-thumb.jpg`;
          }

          this.state.galleryItems.push({
            url: fullUrl,
            thumbUrl: thumbUrl,
            type: mediaLibrary.type,
            title: mediaInfo.name || mediaInfo.title || '',
            artist: mediaInfo.artist || '',
            date: mediaInfo.date || '',
            reference: reference.toString(),
            category: category,
            // For jfm, store chapter number for Arclight API
            chapterNumber: mediaLibrary.type === 'jfm' ? mediaInfo.filename : null
          });

          const displayTitle = mediaInfo.name || mediaInfo.title || '';
          html += `<a href="${fullUrl}" class="mediatype-${mediaLibrary.type} mediacategory-${category}" ${displayTitle ? `title="${this.escapeHtml(displayTitle)}"` : ''} data-filename="${mediaInfo.filename}" data-index="${this.state.galleryItems.length - 1}">
            <img src="${thumbUrl}" />
            ${mediaLibrary.type !== 'image' ? '<b><i></i></b>' : ''}
            <span>${reference.toString()}</span>
          </a>`;
        }
      }
    }

    return html;
  }

  // ============================================================================
  // Resize Logic
  // ============================================================================

  startResize() {
    this.resizeImages(this.refs.thumbsContainer.querySelector('.media-library-thumbs'));
  }

  resizeImages(gallery) {
    if (!gallery) return;

    const TARGET_ROW_HEIGHT = 80;
    const TARGET_GUTTER_WIDTH = 4;
    const container_width = gallery.offsetWidth;
    let current_width = 0;
    let currentRow = [];

    gallery.querySelectorAll('img').forEach((img) => {
      const a = img.closest('a');
      let width = img.getAttribute('data-original-width');
      let height = img.getAttribute('data-original-height');

      // store for resize
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

      const height_ratio = TARGET_ROW_HEIGHT / height;
      const new_width = Math.floor(height_ratio * width);

      // will this push the last row
      if (container_width < current_width + new_width) {
        // resize the previous ones
        let remainder = container_width - current_width;
        let width_per_item = Math.ceil(remainder / currentRow.length);

        for (let j = 0, jl = currentRow.length; j < jl; j++) {
          const row_a = currentRow[j];
          const row_img = row_a.querySelector('img');
          const row_width = parseInt(row_a.offsetWidth, 10);
          const row_height = parseInt(row_a.offsetHeight, 10);
          const row_ratio = container_width / current_width;
          const new_row_width = row_width + width_per_item;
          const new_row_height = Math.floor(row_height * row_ratio);

          row_a.style.width = `${new_row_width}px`;
          row_a.style.height = `${new_row_height}px`;

          if (row_img) {
            row_img.style.width = `${new_row_width}px`;
            row_img.style.height = `${new_row_height}px`;
          }

          if (j + 1 === jl) {
            row_a.style.marginRight = '0';
          }

          remainder = remainder - width_per_item;

          if (width_per_item > remainder) {
            width_per_item = remainder;
          }
        }

        // start over
        currentRow = [];
        current_width = 0;
      }

      // restart
      a.style.width = `${new_width}px`;
      a.style.height = `${TARGET_ROW_HEIGHT}px`;
      a.style.marginRight = `${TARGET_GUTTER_WIDTH}px`;
      a.style.marginBottom = `${TARGET_GUTTER_WIDTH}px`;

      img.style.width = `${new_width}px`;
      img.style.height = `${TARGET_ROW_HEIGHT}px`;

      currentRow.push(a);

      current_width += new_width + TARGET_GUTTER_WIDTH;
    });
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
