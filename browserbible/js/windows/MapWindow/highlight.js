/**
 * Location Highlighting
 * Highlights location names in Bible window text and corresponding map markers
 */

/**
 * Highlight location names in Bible window DOM elements and corresponding map markers
 * @param {SVGElement} markersGroup - The SVG markers group element
 * @param {Object} locationDataByVerse - Verse-to-locations index
 */
export function highlightLocations(markersGroup, locationDataByVerse) {
  document.querySelectorAll('.BibleWindow .verse, .BibleWindow .v').forEach((verse) => {
    const verseid = verse.getAttribute('data-id');
    const verseLocations = locationDataByVerse?.[verseid];

    if (verseLocations !== undefined) {
      let html = verse.innerHTML;

      for (const location of verseLocations) {
        const regexp = new RegExp(`\\b${location.name}\\b`, 'gi');
        html = html.replace(regexp, `<span class="linked-location">${location.name}</span>`);

        // Highlight corresponding map markers
        if (markersGroup) {
          markersGroup.querySelectorAll('.map-marker').forEach((marker) => {
            if (marker.locationData?.name === location.name) {
              const icon = marker.querySelector('.map-marker-icon');
              if (icon) {
                icon.style.color = '#135C13';
                marker.classList.add('highlighted');
                marker.classList.remove('filtered-out');
                marker.style.display = '';
              }
            }
          });
        }
      }

      verse.innerHTML = html;
    }
  });
}

/**
 * Remove all location highlights from Bible window text and reset map marker colors
 * @param {SVGElement} markersGroup - The SVG markers group element
 */
export function removeHighlights(markersGroup) {
  document.querySelectorAll('.BibleWindow .linked-location').forEach((el) => {
    if (el.tagName.toLowerCase() === 'l') {
      el.className = el.className.replace(/linked-location/gi, '');
    } else {
      const textFragment = document.createTextNode(el.textContent);
      if (el.parentNode) {
        el.parentNode.insertBefore(textFragment, el);
        el.parentNode.removeChild(el);
      }
    }
  });

  // Reset highlighted marker colors
  if (markersGroup) {
    markersGroup.querySelectorAll('.map-marker.highlighted').forEach((marker) => {
      const icon = marker.querySelector('.map-marker-icon');
      if (icon) {
        const tier = parseInt(marker.getAttribute('data-tier') || '4', 10);
        const tierColors = { 1: '#c41e3a', 2: '#d45a5a' };
        const originalColor = tierColors[tier] || '#e08080';
        icon.style.color = originalColor;
        marker.classList.remove('highlighted');
      }
    });
  }
}
