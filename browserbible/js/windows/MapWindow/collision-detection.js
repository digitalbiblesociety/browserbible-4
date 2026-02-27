/**
 * Collision Detection for Map Markers
 * Prevents icon overlap through spatial analysis and position optimization
 */

import { COLLISION_OFFSET_MAX, COLLISION_GRID_SIZE, ICON_SIZES } from './constants.js';

/**
 * Get bounding box for a marker element
 * @param {SVGElement} marker - Marker group element
 * @returns {Object} Bounding box {x, y, width, height, tier, element}
 */
export function getMarkerBounds(marker) {
  const transform = marker.getAttribute('transform');
  const match = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(transform);

  if (!match) {
    return null;
  }

  const x = parseFloat(match[1]);
  const y = parseFloat(match[2]);
  const tier = parseInt(marker.getAttribute('data-tier') || '4', 10);
  const iconSize = ICON_SIZES[tier] || ICON_SIZES[4];

  return {
    x: x - iconSize / 2,
    y: y - iconSize / 2,
    width: iconSize,
    height: iconSize,
    centerX: x,
    centerY: y,
    tier,
    element: marker
  };
}

/**
 * Check if two bounding boxes overlap
 * @param {Object} bounds1 - First bounding box
 * @param {Object} bounds2 - Second bounding box
 * @returns {boolean} True if boxes overlap
 */
export function checkOverlap(bounds1, bounds2) {
  return !(
    bounds1.x + bounds1.width < bounds2.x ||
    bounds2.x + bounds2.width < bounds1.x ||
    bounds1.y + bounds1.height < bounds2.y ||
    bounds2.y + bounds2.height < bounds1.y
  );
}

/**
 * Create spatial hash grid for efficient collision detection
 * @param {Array} markers - Array of marker elements
 * @returns {Map} Grid map with cell coordinates as keys
 */
function createSpatialGrid(markers) {
  const grid = new Map();

  markers.forEach(marker => {
    const bounds = getMarkerBounds(marker);
    if (!bounds) return;

    const cellX = Math.floor(bounds.centerX / COLLISION_GRID_SIZE);
    const cellY = Math.floor(bounds.centerY / COLLISION_GRID_SIZE);
    const key = `${cellX},${cellY}`;

    if (!grid.has(key)) {
      grid.set(key, []);
    }
    grid.get(key).push({ marker, bounds });
  });

  return grid;
}

/**
 * Get neighboring grid cells for collision checking
 * @param {number} cellX - Cell X coordinate
 * @param {number} cellY - Cell Y coordinate
 * @returns {Array} Array of neighboring cell keys
 */
function getNeighborCells(cellX, cellY) {
  const neighbors = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      neighbors.push(`${cellX + dx},${cellY + dy}`);
    }
  }
  return neighbors;
}

/**
 * Calculate offset to separate two overlapping markers
 * @param {Object} bounds1 - First marker bounds
 * @param {Object} bounds2 - Second marker bounds
 * @returns {Object} Offset {dx, dy}
 */
function calculateSeparationOffset(bounds1, bounds2) {
  const dx = bounds1.centerX - bounds2.centerX;
  const dy = bounds1.centerY - bounds2.centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) {
    // Markers at exact same position, offset in random direction
    const angle = Math.random() * Math.PI * 2;
    return {
      dx: Math.cos(angle) * COLLISION_OFFSET_MAX,
      dy: Math.sin(angle) * COLLISION_OFFSET_MAX
    };
  }

  // Calculate minimum separation distance
  const minDistance = (bounds1.width + bounds2.width) / 2 + 2; // 2px padding
  const separation = minDistance - distance;

  if (separation <= 0) {
    return { dx: 0, dy: 0 };
  }

  // Normalize direction and apply offset
  const offsetMagnitude = Math.min(separation / 2, COLLISION_OFFSET_MAX);
  return {
    dx: (dx / distance) * offsetMagnitude,
    dy: (dy / distance) * offsetMagnitude
  };
}

/**
 * Process collision between two markers and calculate offset adjustments
 * @param {Object} marker1 - First marker element
 * @param {Object} bounds1 - First marker bounds
 * @param {Object} marker2 - Second marker element
 * @param {Object} bounds2 - Second marker bounds
 * @returns {Object|null} Offset adjustment {dx, dy} or null if no adjustment needed
 */
function processMarkerCollision(marker1, bounds1, marker2, bounds2) {
  if (marker1 === marker2) return null;

  if (!checkOverlap(bounds1, bounds2)) return null;

  // Higher tier markers don't move for lower tier markers
  const tier1 = bounds1.tier;
  const tier2 = bounds2.tier;

  if (tier1 < tier2) {
    // marker1 is more important, don't move it
    return null;
  }

  // Same tier or marker1 is less important - calculate offset
  return calculateSeparationOffset(bounds1, bounds2);
}

/**
 * Accumulate collision offsets from neighbor markers
 * @param {Object} marker1 - First marker element
 * @param {Object} bounds1 - First marker bounds
 * @param {Array} neighborMarkers - Array of neighbor marker objects
 * @returns {Object} Accumulated offset {totalDx, totalDy, collisionCount}
 */
function accumulateNeighborCollisions(marker1, bounds1, neighborMarkers) {
  let totalDx = 0;
  let totalDy = 0;
  let collisionCount = 0;

  neighborMarkers.forEach(({ marker: marker2, bounds: bounds2 }) => {
    const offset = processMarkerCollision(marker1, bounds1, marker2, bounds2);
    if (offset) {
      totalDx += offset.dx;
      totalDy += offset.dy;
      collisionCount++;
    }
  });

  return { totalDx, totalDy, collisionCount };
}

/**
 * Optimize marker positions to minimize overlap
 * @param {Array} markers - Array of marker SVG elements
 * @param {number} iterations - Number of optimization iterations (default: 3)
 * @returns {Map} Map of marker element to offset {dx, dy}
 */
export function optimizeMarkerPositions(markers, iterations = 3) {
  const offsets = new Map();

  // Filter visible markers only
  const visibleMarkers = markers.filter(m => m.style.display !== 'none');

  if (visibleMarkers.length === 0) {
    return offsets;
  }

  // Initialize offsets
  visibleMarkers.forEach(marker => {
    offsets.set(marker, { dx: 0, dy: 0 });
  });

  // Iterative position optimization
  for (let iter = 0; iter < iterations; iter++) {
    const grid = createSpatialGrid(visibleMarkers);
    const adjustments = new Map();

    grid.forEach((cellMarkers, cellKey) => {
      const [cellX, cellY] = cellKey.split(',').map(Number);
      const neighborKeys = getNeighborCells(cellX, cellY);

      cellMarkers.forEach(({ marker: marker1, bounds: bounds1 }) => {
        let totalDx = 0;
        let totalDy = 0;
        let collisionCount = 0;

        // Check against neighbors
        neighborKeys.forEach(neighborKey => {
          const neighborMarkers = grid.get(neighborKey) || [];
          const result = accumulateNeighborCollisions(marker1, bounds1, neighborMarkers);
          totalDx += result.totalDx;
          totalDy += result.totalDy;
          collisionCount += result.collisionCount;
        });

        if (collisionCount > 0) {
          adjustments.set(marker1, {
            dx: totalDx / collisionCount,
            dy: totalDy / collisionCount
          });
        }
      });
    });

    // Apply adjustments
    adjustments.forEach((adjustment, marker) => {
      const currentOffset = offsets.get(marker);
      offsets.set(marker, {
        dx: currentOffset.dx + adjustment.dx,
        dy: currentOffset.dy + adjustment.dy
      });
    });
  }

  return offsets;
}

/**
 * Apply collision offsets to markers
 * @param {Map} offsets - Map of marker to offset {dx, dy}
 */
export function applyCollisionOffsets(offsets) {
  offsets.forEach((offset, marker) => {
    const transform = marker.getAttribute('transform');
    const match = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(transform);

    if (match) {
      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);
      marker.setAttribute('transform', `translate(${x + offset.dx}, ${y + offset.dy})`);
    }
  });
}

/**
 * Reset markers to original positions (remove collision offsets)
 * @param {Array} markers - Array of marker elements
 */
export function resetMarkerPositions(markers) {
  markers.forEach(marker => {
    if (marker.locationData) {
      const { x, y } = marker.locationData.svgCoords || {};
      if (x !== undefined && y !== undefined) {
        marker.setAttribute('transform', `translate(${x}, ${y})`);
      }
    }
  });
}
