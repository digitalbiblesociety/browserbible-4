export function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightTextMatches(root, regexps, className = 'highlight') {
  const skipSelector = '.' + className.trim().split(/\s+/).join('.');

  for (const regex of regexps) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest(skipSelector)) return NodeFilter.FILTER_REJECT;
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
        if (match[0] === '') { regex.lastIndex++; continue; }
        if (!frag) frag = document.createDocumentFragment();
        if (match.index > lastIndex) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const span = document.createElement('span');
        span.className = className;
        span.textContent = match[0];
        frag.appendChild(span);
        lastIndex = match.index + match[0].length;
        if (!regex.global) break;
      }

      if (frag) {
        if (lastIndex < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        textNode.parentNode.replaceChild(frag, textNode);
      }
    }
  }
}
