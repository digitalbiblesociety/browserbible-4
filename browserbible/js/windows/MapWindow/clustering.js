/**
 * Marker Clustering
 * Groups nearby markers into cluster indicators to reduce visual clutter.
 * Cluster indicators are HTML div elements in the markers overlay.
 */

import { SVG_WIDTH, CLUSTER_RADIUS_PX } from './constants.js';

/**
 * Compute clusters from visible markers based on the current viewport.
 *
 * @param {HTMLElement} overlay - The HTML markers overlay div
 * @param {Object} viewBox - Current viewBox {x, y, width, height}
 * @param {number} containerWidth - Map container width in screen pixels
 * @returns {{ clusters: Array, singles: HTMLElement[] }}
 */
export function computeClusters(overlay, viewBox, containerWidth) {
  if (!overlay || !containerWidth) return { clusters: [], singles: [] };

  // Scale cluster radius down at high zoom so nearby locations can separate
  const zoomRatio = viewBox.width / SVG_WIDTH; // 1 at full extent, small at max zoom
  const zoomScale = Math.min(1, zoomRatio * 6);
  const effectiveRadiusPx = CLUSTER_RADIUS_PX * zoomScale;

  // Convert screen pixel radius to SVG coordinate radius for distance checks
  const clusterRadiusSvg = effectiveRadiusPx * (viewBox.width / containerWidth);
  const radiusSq = clusterRadiusSvg * clusterRadiusSvg;

  // Collect eligible markers (not filtered out)
  const eligible = [];
  overlay.querySelectorAll('.map-marker').forEach((marker) => {
    if (marker.classList.contains('filtered-out')) return;
    if (marker._svgX === undefined) return;

    eligible.push({
      marker,
      x: marker._svgX,
      y: marker._svgY,
      tier: parseInt(marker.getAttribute('data-tier') || '4', 10)
    });
  });

  // Sort by tier: lower number = more important = becomes cluster center
  eligible.sort((a, b) => a.tier - b.tier);

  const assigned = new Set();
  const clusters = [];
  const singles = [];
  const hidden = []; // co-located non-representative markers (hidden but not clustered-badged)

  for (const item of eligible) {
    if (assigned.has(item)) continue;

    const nearby = [];
    for (const other of eligible) {
      if (assigned.has(other) || other === item) continue;
      const dx = item.x - other.x;
      const dy = item.y - other.y;
      if (dx * dx + dy * dy < radiusSq) {
        nearby.push(other);
      }
    }

    if (nearby.length > 0) {
      const allMembers = [item, ...nearby];
      assigned.add(item);
      for (const n of nearby) assigned.add(n);

      // Check if all members are truly co-located (can never be separated by zooming)
      let maxDistSq = 0;
      for (let i = 0; i < allMembers.length; i++) {
        for (let j = i + 1; j < allMembers.length; j++) {
          const dx = allMembers[i].x - allMembers[j].x;
          const dy = allMembers[i].y - allMembers[j].y;
          maxDistSq = Math.max(maxDistSq, dx * dx + dy * dy);
        }
      }

      if (maxDistSq < 0.25) { // threshold: 0.5 SVG units — pins at the same geographic point
        // Show only the pin with the most verse entries; hide the rest
        const best = allMembers.reduce((a, b) => {
          const av = a.marker.locationData?.verses?.length ?? 0;
          const bv = b.marker.locationData?.verses?.length ?? 0;
          return bv > av ? b : a;
        });
        singles.push(best.marker);
        for (const m of allMembers) {
          if (m !== best) hidden.push(m.marker);
        }
      } else {
        const members = [item.marker, ...nearby.map(n => n.marker)];
        clusters.push({
          x: item.x,
          y: item.y,
          members,
          count: members.length
        });
      }
    } else {
      singles.push(item.marker);
    }
  }

  return { clusters, singles, hidden };
}

/**
 * Render cluster indicators as HTML divs in the overlay.
 * Positions are stored as _svgX/_svgY for later repositioning by repositionAllMarkers.
 *
 * @param {HTMLElement} overlay - The HTML markers overlay div
 * @param {Array} clusters - Cluster objects from computeClusters
 */
export function renderClusters(overlay, clusters) {
  clearClusters(overlay);

  for (const cluster of clusters) {
    const div = document.createElement('div');
    div.className = 'map-cluster';
    div._svgX = cluster.x;
    div._svgY = cluster.y;
    div._clusterData = cluster;

    // Size scales slightly with member count
    const countScale = Math.min(1.5, 1 + (cluster.count - 2) * 0.08);
    const size = Math.round(28 * countScale);
    div.style.width = `${size}px`;
    div.style.height = `${size}px`;

    // Precompute anchor for translate3d positioning (Leaflet pattern)
    div._anchorX = size / 2;
    div._anchorY = size / 2;

    const text = document.createElement('span');
    text.className = 'map-cluster-text';
    text.textContent = cluster.count;
    div.appendChild(text);

    overlay.appendChild(div);
  }
}

/**
 * Remove all cluster indicator elements from the overlay.
 */
export function clearClusters(overlay) {
  if (!overlay) return;
  overlay.querySelectorAll('.map-cluster').forEach(el => el.remove());
}

/**
 * Apply clustering results: add .clustered to grouped markers, remove from singles.
 * @param {Array} clusters
 * @param {HTMLElement[]} singles
 * @param {HTMLElement[]} hidden - Co-located non-representative markers to keep hidden
 */
export function applyClusterVisibility(clusters, singles, hidden = []) {
  for (const cluster of clusters) {
    for (const marker of cluster.members) {
      marker.classList.add('clustered');
    }
  }
  for (const marker of singles) {
    marker.classList.remove('clustered');
  }
  for (const marker of hidden) {
    marker.classList.add('clustered');
  }
}
