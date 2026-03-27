/**
 * MapWindow Constants
 * Map bounds, SVG dimensions, and location classifications
 */

export const MAP_BOUNDS = {
  minLat: 8,
  maxLat: 47,
  minLon: -8,
  maxLon: 78
};

export const SVG_WIDTH = 1200;
export const SVG_HEIGHT = 800;
export const PADDING = 40;
export const CONTENT_WIDTH = SVG_WIDTH - 2 * PADDING;
export const CONTENT_HEIGHT = SVG_HEIGHT - 2 * PADDING;

export const IMPORTANT_LOCATIONS = new Set([
  'Rome', 'Athens', 'Corinth', 'Ephesus', 'Antioch', 'Alexandria',
  'Thessalonica', 'Philippi', 'Galatia', 'Colossae', 'Patmos',
  'Crete', 'Malta', 'Puteoli', 'Cyprus', 'Iconium', 'Lystra', 'Derbe',
  'Troas', 'Miletus', 'Caesarea Philippi', 'Decapolis', 'Petra'
]);

export const DEMOTED_LOCATIONS = new Set([
  'Most Holy Place', 'Most Holy Place 2', 'Holy Place', 'Holy Place 2',
  'Mount Seir 1',
  'Valley of the Son of Hinnom', 'Zorah', 'Valley of the Arnon',
  'Kadesh-barnea', 'Mount Hor', 'Shephelah', 'Succoth',
  'Jazer', 'Jabesh-gilead', 'Tirzah',
  'Hazor', 'Ziklag', 'Gezer', 'Rabbah', 'Ramah',
  'Ashkelon', 'Megiddo', 'Aroer', 'Ekron', 'Lachish',
  'Mahanaim?', 'Kiriath-jearim?'
]);

// Cluster radius in screen pixels — markers within this distance merge into clusters
export const CLUSTER_RADIUS_PX = 60;

// Icon sizes for each tier (in pixels) — must match CSS .map-marker[data-tier] .map-marker-icon
export const ICON_SIZES = {
  1: 28,
  2: 22,
  3: 18,
  4: 14
};

