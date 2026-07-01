/**
 * Location Highlighting
 * Highlights location names in Bible window text and corresponding map markers.
 * Matches are wrapped via a text-node walk (never innerHTML string replacement)
 * so element attributes and existing markup can't be corrupted.
 */

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Wrap every regex match inside root's text nodes in a .linked-location span.
 * The matched text is kept verbatim (preserves source casing); the span carries
 * the canonical location name for two-way linking.
 * @param {Element} root - Verse element to walk
 * @param {RegExp} regex - Combined name pattern (global)
 * @param {Map<string,string>} nameByMatch - lowercased match → canonical location name
 */
function wrapMatches(root, regex, nameByMatch) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest('.linked-location')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  for (const textNode of textNodes) {
    const text = textNode.nodeValue;
    regex.lastIndex = 0;

    let match;
    let lastIndex = 0;
    let frag = null;
    while ((match = regex.exec(text)) !== null) {
      if (!frag) frag = document.createDocumentFragment();
      if (match.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      const span = document.createElement('span');
      span.className = 'linked-location';
      span.setAttribute('data-location-name', nameByMatch.get(match[0].toLowerCase()) ?? match[0]);
      span.textContent = match[0];
      frag.appendChild(span);
      lastIndex = match.index + match[0].length;
    }

    if (frag) {
      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      textNode.parentNode.replaceChild(frag, textNode);
    }
  }
}

/**
 * Highlight location names in Bible window DOM elements and corresponding map markers
 * @param {HTMLElement} markersGroup - The markers overlay element
 * @param {Object} locationDataByVerse - Verse-to-locations index
 */
export function highlightLocations(markersGroup, locationDataByVerse) {
  const highlightedNames = new Set();

  document.querySelectorAll('.BibleWindow .verse, .BibleWindow .v').forEach((verse) => {
    const verseid = verse.getAttribute('data-id');
    const verseLocations = locationDataByVerse?.[verseid];
    if (!verseLocations) return;

    // Map lowercased display form → canonical name. A trailing "?" in the data
    // marks an uncertain identification and never appears in the Bible text,
    // so it is stripped for matching but kept in the canonical name.
    const nameByMatch = new Map();
    for (const location of verseLocations) {
      const matchName = location.name.replace(/\?+$/, '');
      if (matchName && !nameByMatch.has(matchName.toLowerCase())) {
        nameByMatch.set(matchName.toLowerCase(), location.name);
      }
      highlightedNames.add(location.name);
    }
    if (nameByMatch.size === 0) return;

    // Longest-first alternation so "Abel-beth-maacah" wins over "Abel".
    // Right boundary is (?!\w), not \b — names can end in a non-word character.
    const patterns = [...nameByMatch.keys()]
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);
    const regex = new RegExp(`\\b(?:${patterns.join('|')})(?!\\w)`, 'gi');

    wrapMatches(verse, regex, nameByMatch);
  });

  if (markersGroup && highlightedNames.size > 0) {
    markersGroup.querySelectorAll('.map-marker').forEach((marker) => {
      if (marker.locationData && highlightedNames.has(marker.locationData.name)) {
        marker.classList.add('highlighted');
        marker.classList.remove('filtered-out');
      }
    });
  }
}

/**
 * Remove all location highlights from Bible window text and map markers
 * @param {HTMLElement} markersGroup - The markers overlay element
 */
export function removeHighlights(markersGroup) {
  const parents = new Set();
  document.querySelectorAll('.BibleWindow .linked-location').forEach((el) => {
    if (el.tagName.toLowerCase() === 'l') {
      el.className = el.className.replace(/linked-location/gi, '');
    } else if (el.parentNode) {
      parents.add(el.parentNode);
      el.parentNode.insertBefore(document.createTextNode(el.textContent), el);
      el.parentNode.removeChild(el);
    }
  });
  // Merge the text nodes back together so repeated highlight cycles don't fragment the DOM
  parents.forEach(p => p.normalize());

  if (markersGroup) {
    markersGroup.querySelectorAll('.map-marker.highlighted').forEach((marker) => {
      marker.classList.remove('highlighted');
    });
  }
}
