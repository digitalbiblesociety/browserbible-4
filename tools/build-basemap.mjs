import { writeFile, readFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { MAP_BOUNDS, SVG_WIDTH, SVG_HEIGHT, PADDING } from '../browserbible/js/windows/MapWindow/constants.js';
import { geoToSvg } from '../browserbible/js/windows/MapWindow/geo-utils.js';
import { buildRelief } from './relief.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const OUT = join(REPO, 'browserbible/public/content/maps/biblical-map.svg');
const RELIEF_AVIF = join(REPO, 'browserbible/public/content/maps/relief.avif');
const RELIEF_WEBP = join(REPO, 'browserbible/public/content/maps/relief.webp');
const RELIEF_HREF = 'content/maps/relief.avif';
const RELIEF_HREF_WEBP = 'content/maps/relief.webp';
const CACHE_DIR = join(tmpdir(), 'browserbible-basemap-cache', 'natural-earth');

const NE_BASE = 'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/10m/physical';
const LAYERS = {
  land: 'ne_10m_land',
  lakes: 'ne_10m_lakes',
  rivers: 'ne_10m_rivers_lake_centerlines'
};

const BBOX = {
  minLon: MAP_BOUNDS.minLon,
  maxLon: MAP_BOUNDS.maxLon,
  minLat: MAP_BOUNDS.minLat,
  maxLat: MAP_BOUNDS.maxLat
};
const SIMPLIFY_EPS = 0.008;
const RIVER_EPS = 0.025;
const RIVER_MAX_SCALERANK = 6;

async function loadLayer(key) {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = join(CACHE_DIR, `${LAYERS[key]}.json`);
  try {
    await access(file);
  } catch {
    const url = `${NE_BASE}/${LAYERS[key]}.json`;
    process.stdout.write(`  fetching ${url}\n`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    await writeFile(file, await res.text());
  }
  return JSON.parse(await readFile(file, 'utf8'));
}

const interpX = (a, b, cx) => [cx, a[1] + ((cx - a[0]) / (b[0] - a[0])) * (b[1] - a[1])];
const interpY = (a, b, cy) => [a[0] + ((cy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), cy];

function clipEdge(poly, inside, intersect) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const curIn = inside(cur);
    const prevIn = inside(prev);
    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur));
      out.push(cur);
    } else if (prevIn) {
      out.push(intersect(prev, cur));
    }
  }
  return out;
}

function clipRing(ring) {
  let p = ring;
  p = clipEdge(p, c => c[0] >= BBOX.minLon, (a, b) => interpX(a, b, BBOX.minLon));
  if (!p.length) return p;
  p = clipEdge(p, c => c[0] <= BBOX.maxLon, (a, b) => interpX(a, b, BBOX.maxLon));
  if (!p.length) return p;
  p = clipEdge(p, c => c[1] >= BBOX.minLat, (a, b) => interpY(a, b, BBOX.minLat));
  if (!p.length) return p;
  p = clipEdge(p, c => c[1] <= BBOX.maxLat, (a, b) => interpY(a, b, BBOX.maxLat));
  return p;
}

function clipSegment(x0, y0, x1, y1) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - BBOX.minLon, BBOX.maxLon - x0, y0 - BBOX.minLat, BBOX.maxLat - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
  }
  return [[x0 + t0 * dx, y0 + t0 * dy], [x0 + t1 * dx, y0 + t1 * dy]];
}

function simplify(points, eps) {
  if (points.length < 3) return points;
  const sqEps = eps * eps;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0, idx = -1;
    const [ax, ay] = points[s];
    const [bx, by] = points[e];
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy || 1e-12;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = points[i];
      const t = ((px - ax) * dx + (py - ay) * dy) / len;
      const cx = ax + t * dx, cy = ay + t * dy;
      const d = (px - cx) ** 2 + (py - cy) ** 2;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > sqEps && idx !== -1) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const fmt = (n) => (Math.round(n * 10) / 10).toString();

function ringToPath(ring) {
  const proj = ring.map(([lon, lat]) => geoToSvg(lon, lat));
  let d = `M${fmt(proj[0].x)},${fmt(proj[0].y)}`;
  for (let i = 1; i < proj.length; i++) d += `L${fmt(proj[i].x)},${fmt(proj[i].y)}`;
  return d + 'Z';
}

function* eachPolygon(geometry) {
  if (!geometry) return;
  if (geometry.type === 'Polygon') yield geometry.coordinates;
  else if (geometry.type === 'MultiPolygon') yield* geometry.coordinates;
}
function* eachLine(geometry) {
  if (!geometry) return;
  if (geometry.type === 'LineString') yield geometry.coordinates;
  else if (geometry.type === 'MultiLineString') yield* geometry.coordinates;
}

function polygonLayerPath(fc) {
  let d = '';
  let rings = 0;
  for (const feature of fc.features) {
    for (const polygon of eachPolygon(feature.geometry)) {
      for (const ring of polygon) {
        const clipped = clipRing(ring);
        if (clipped.length < 4) continue;
        const simplified = simplify(clipped, SIMPLIFY_EPS);
        if (simplified.length < 4) continue;
        d += ringToPath(simplified);
        rings++;
      }
    }
  }
  return { d, rings };
}

function riverLayerPath(fc) {
  let d = '';
  let segs = 0;
  for (const feature of fc.features) {
    const rank = feature.properties?.scalerank;
    if (typeof rank === 'number' && rank > RIVER_MAX_SCALERANK) continue;
    for (const line of eachLine(feature.geometry)) {
      const simplified = simplify(line, RIVER_EPS);
      for (let i = 0; i < simplified.length - 1; i++) {
        const seg = clipSegment(simplified[i][0], simplified[i][1], simplified[i + 1][0], simplified[i + 1][1]);
        if (!seg) continue;
        const a = geoToSvg(seg[0][0], seg[0][1]);
        const b = geoToSvg(seg[1][0], seg[1][1]);
        d += `M${fmt(a.x)},${fmt(a.y)}L${fmt(b.x)},${fmt(b.y)}`;
        segs++;
      }
    }
  }
  return { d, segs };
}

async function main() {
  process.stdout.write('Loading Natural Earth layers…\n');
  const [land, lakes, rivers] = await Promise.all([
    loadLayer('land'), loadLayer('lakes'), loadLayer('rivers')
  ]);

  const W = +SVG_WIDTH.toFixed(2);
  const H = +SVG_HEIGHT.toFixed(2);
  const contentX = PADDING;
  const contentY = PADDING;
  const contentW = +(SVG_WIDTH - 2 * PADDING).toFixed(2);
  const contentH = +(SVG_HEIGHT - 2 * PADDING).toFixed(2);

  const landPath = polygonLayerPath(land);
  const lakePath = polygonLayerPath(lakes);
  const riverPath = riverLayerPath(rivers);

  process.stdout.write(`  land rings: ${landPath.rings}, lake rings: ${lakePath.rings}, river segments: ${riverPath.segs}\n`);

  await buildRelief({ outputs: [
    { path: RELIEF_AVIF, quality: 55 },
    { path: RELIEF_WEBP, quality: 58 }
  ] });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg id="map-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- Generated by tools/build-basemap.mjs from Natural Earth 10m physical data + Terrarium relief. -->
  <!-- Corrected equirectangular projection (standard parallel ${(MAP_BOUNDS.minLat + MAP_BOUNDS.maxLat) / 2}°N) via geoToSvg(). -->
  <defs>
    <linearGradient id="seaGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#bfe0ef"/>
      <stop offset="100%" stop-color="#8fbdd9"/>
    </linearGradient>
    <linearGradient id="landGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ecdcb0"/>
      <stop offset="100%" stop-color="#dac99c"/>
    </linearGradient>
    <clipPath id="content-clip">
      <rect x="${contentX}" y="${contentY}" width="${contentW}" height="${contentH}"/>
    </clipPath>
    <!-- Land geometry stored once; referenced via <use> for clip, fill and outline. -->
    <path id="land-shape" d="${landPath.d}"/>
    <clipPath id="land-clip">
      <use href="#land-shape"/>
    </clipPath>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#seaGradient)"/>

  <g clip-path="url(#content-clip)">
    <rect x="${contentX}" y="${contentY}" width="${contentW}" height="${contentH}" fill="url(#seaGradient)"/>
    <!-- Flat land fill is the fallback while the relief lazy-loads (or if it can't). -->
    <use href="#land-shape" fill="url(#landGradient)"/>
    <!-- Relief is lazy-loaded: MapPanel probes AVIF support and sets href from
         data-src (AVIF) or data-src-fallback (WebP) after first paint. -->
    <image id="relief-layer" data-src="${RELIEF_HREF}" data-src-fallback="${RELIEF_HREF_WEBP}"
           x="${contentX}" y="${contentY}" width="${contentW}" height="${contentH}"
           preserveAspectRatio="none" clip-path="url(#land-clip)"/>
    <path d="${lakePath.d}" fill="#9fc8df" stroke="#7fb0cf" stroke-width="0.4"/>
    <path d="${riverPath.d}" fill="none" stroke="#8fb8d2" stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Crisp coastline on top of the relief. -->
    <use href="#land-shape" fill="none" stroke="#9c8a5c" stroke-width="0.5"/>
  </g>

  <rect x="${contentX}" y="${contentY}" width="${contentW}" height="${contentH}" fill="none" stroke="#9a8a5e" stroke-width="1"/>
</svg>
`;

  await writeFile(OUT, svg);
  const kb = (Buffer.byteLength(svg) / 1024).toFixed(0);
  process.stdout.write(`Wrote ${OUT} (${kb} KB)\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
