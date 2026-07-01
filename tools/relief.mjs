import { inflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

const MAGICK = (() => {
  try { execFileSync('magick', ['-version'], { stdio: 'ignore' }); return ['magick']; }
  catch { return ['convert']; }
})();
import { writeFile, readFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { MAP_BOUNDS, PADDING, SVG_WIDTH, SVG_HEIGHT } from '../browserbible/js/windows/MapWindow/constants.js';
import { svgToGeo, geoToSvg } from '../browserbible/js/windows/MapWindow/geo-utils.js';

const MAPS_JSON = join(dirname(fileURLToPath(import.meta.url)), '../browserbible/public/content/maps/maps.json');

const CACHE = join(tmpdir(), 'browserbible-basemap-cache', 'terrarium');
const TILE_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const ZOOM = 8;
const CONTENT_W = SVG_WIDTH - 2 * PADDING;
const CONTENT_H = SVG_HEIGHT - 2 * PADDING;

const SCALE = 4;
const OUT_W = Math.round(CONTENT_W * SCALE);
const OUT_H = Math.round(CONTENT_H * SCALE);

const LOD_BANDWIDTH_DEG = 1.6;
const LOD_BLUR_FACTOR = 5;
const LOD_BLUR_FACTOR2 = 14;
const LOD_DESOLATE_T = 0.18;
const LOD_FLOOR = 0.12;
const LOD_GAMMA = 0.6;
const LOD_NORM_PCTL = 0.80;
const LOD_WEIGHT = (verses) => Math.min(3, 1 + Math.log10(1 + (verses || 0)));

function decodePng(buf) {
  let p = 8;
  let w = 0, h = 0, colorType = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      colorType = data[9];
      if (data[8] !== 8) throw new Error(`bit depth ${data[8]} unsupported`);
      if (data[12] !== 0) throw new Error('interlaced PNG unsupported');
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') break;
    p += 12 + len;
  }
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : (() => { throw new Error(`color type ${colorType}`); })();
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(stride * h);
  const paeth = (a, b, c) => {
    const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  let q = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[q++];
    for (let x = 0; x < stride; x++) {
      const v = raw[q++];
      const a = x >= ch ? out[y * stride + x - ch] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= ch && y > 0 ? out[(y - 1) * stride + x - ch] : 0;
      let r;
      switch (filter) {
        case 0: r = v; break;
        case 1: r = v + a; break;
        case 2: r = v + b; break;
        case 3: r = v + ((a + b) >> 1); break;
        case 4: r = v + paeth(a, b, c); break;
        default: throw new Error(`filter ${filter}`);
      }
      out[y * stride + x] = r & 0xff;
    }
  }
  return { width: w, height: h, channels: ch, data: out };
}

async function fetchTile(z, x, y) {
  await mkdir(join(CACHE, `${z}/${x}`), { recursive: true });
  const file = join(CACHE, `${z}/${x}/${y}.png`);
  try { await access(file); return readFile(file); } catch {  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(TILE_URL(z, x, y));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = Buffer.from(await res.arrayBuffer());
      await writeFile(file, data);
      return data;
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
}

async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }));
  return results;
}

const n = 2 ** ZOOM;
const lonToGX = (lon) => ((lon + 180) / 360) * n * 256;
const latToGY = (lat) => {
  const r = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
  return (1 - Math.asinh(Math.tan(r)) / Math.PI) / 2 * n * 256;
};

const RAMP = [
  [-500, [196, 210, 170]], [0, [202, 222, 156]], [200, [222, 216, 150]],
  [600, [214, 190, 130]], [1200, [196, 160, 104]], [2200, [160, 120, 82]],
  [3200, [188, 170, 150]], [4500, [240, 240, 240]]
];
function tint(elev) {
  if (elev <= RAMP[0][0]) return RAMP[0][1];
  for (let i = 1; i < RAMP.length; i++) {
    if (elev <= RAMP[i][0]) {
      const [e0, c0] = RAMP[i - 1], [e1, c1] = RAMP[i];
      const t = (elev - e0) / (e1 - e0);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

async function buildDetailWeight() {
  const locs = JSON.parse(await readFile(MAPS_JSON, 'utf8'));
  const DS = 8;
  const dW = Math.ceil(OUT_W / DS), dH = Math.ceil(OUT_H / DS);
  const dens = new Float64Array(dW * dH);

  const lonRange = MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon;
  const bwCells = (LOD_BANDWIDTH_DEG / lonRange) * OUT_W / DS;
  const inv2s2 = 1 / (2 * bwCells * bwCells);
  const rad = Math.ceil(bwCells * 3);

  let placed = 0;
  for (const l of locs) {
    const [lon, lat] = l.coordinates;
    const { x, y } = geoToSvg(lon, lat);
    const px = (x - PADDING) / CONTENT_W * OUT_W;
    const py = (y - PADDING) / CONTENT_H * OUT_H;
    if (px < 0 || px >= OUT_W || py < 0 || py >= OUT_H) continue;
    placed++;
    const cx = px / DS, cy = py / DS;
    const w = LOD_WEIGHT(l.verses?.length);
    const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(dW - 1, Math.ceil(cx + rad));
    const y0 = Math.max(0, Math.floor(cy - rad)), y1 = Math.min(dH - 1, Math.ceil(cy + rad));
    for (let gy = y0; gy <= y1; gy++) {
      const ddy = gy - cy;
      for (let gx = x0; gx <= x1; gx++) {
        const ddx = gx - cx;
        dens[gy * dW + gx] += w * Math.exp(-(ddx * ddx + ddy * ddy) * inv2s2);
      }
    }
  }

  const nonzero = Array.from(dens).filter(v => v > 0).sort((a, b) => a - b);
  const ref = nonzero.length ? nonzero[Math.floor(nonzero.length * LOD_NORM_PCTL)] : 1;
  const detail = new Float32Array(dW * dH);
  for (let i = 0; i < dens.length; i++) {
    detail[i] = Math.min(1, Math.pow(dens[i] / ref, LOD_GAMMA));
  }
  return { detail, dW, dH, DS, placed };
}

function makeSmoothBase(rgb, factor) {
  const sw = Math.ceil(OUT_W / factor), sh = Math.ceil(OUT_H / factor);
  const acc = new Float32Array(sw * sh * 3), cnt = new Float32Array(sw * sh);
  for (let y = 0; y < OUT_H; y++) {
    const sy = (y / factor) | 0;
    for (let x = 0; x < OUT_W; x++) {
      const si = sy * sw + ((x / factor) | 0), o = (y * OUT_W + x) * 3;
      acc[si * 3] += rgb[o]; acc[si * 3 + 1] += rgb[o + 1]; acc[si * 3 + 2] += rgb[o + 2]; cnt[si]++;
    }
  }
  for (let i = 0; i < sw * sh; i++) if (cnt[i]) { acc[i * 3] /= cnt[i]; acc[i * 3 + 1] /= cnt[i]; acc[i * 3 + 2] /= cnt[i]; }
  const out = Buffer.alloc(OUT_W * OUT_H * 3);
  for (let y = 0; y < OUT_H; y++) {
    const fy = Math.min(sh - 1.001, y / factor), iy = fy | 0, ty = fy - iy;
    for (let x = 0; x < OUT_W; x++) {
      const fx = Math.min(sw - 1.001, x / factor), ix = fx | 0, tx = fx - ix;
      const i00 = (iy * sw + ix) * 3, i10 = i00 + 3, i01 = i00 + sw * 3, i11 = i01 + 3, o = (y * OUT_W + x) * 3;
      for (let c = 0; c < 3; c++) {
        out[o + c] = acc[i00 + c] * (1 - tx) * (1 - ty) + acc[i10 + c] * tx * (1 - ty)
                   + acc[i01 + c] * (1 - tx) * ty + acc[i11 + c] * tx * ty;
      }
    }
  }
  return out;
}

export async function buildRelief({ outputs, outPath, quality = 55 }) {
  const x0 = Math.floor(lonToGX(MAP_BOUNDS.minLon) / 256);
  const x1 = Math.floor(lonToGX(MAP_BOUNDS.maxLon) / 256);
  const y0 = Math.floor(latToGY(MAP_BOUNDS.maxLat) / 256);
  const y1 = Math.floor(latToGY(MAP_BOUNDS.minLat) / 256);

  const tiles = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push({ x, y });
  process.stdout.write(`  relief: ${tiles.length} terrarium tiles (z${ZOOM}, x${x0}..${x1}, y${y0}..${y1})\n`);

  const mosaicW = (x1 - x0 + 1) * 256;
  const mosaicH = (y1 - y0 + 1) * 256;
  const elev = new Float32Array(mosaicW * mosaicH);

  const buffers = await pool(tiles, 12, t => fetchTile(ZOOM, t.x, t.y));
  tiles.forEach((t, k) => {
    const ox = (t.x - x0) * 256, oy = (t.y - y0) * 256;
    if (!buffers[k]) return;
    const { data, channels } = decodePng(buffers[k]);
    for (let yy = 0; yy < 256; yy++) {
      for (let xx = 0; xx < 256; xx++) {
        const s = (yy * 256 + xx) * channels;
        const e = data[s] * 256 + data[s + 1] + data[s + 2] / 256 - 32768;
        elev[(oy + yy) * mosaicW + (ox + xx)] = e;
      }
    }
  });

  const ox = x0 * 256, oy = y0 * 256;
  const sample = (lon, lat) => {
    const gx = lonToGX(lon) - ox;
    const gy = latToGY(lat) - oy;
    const fx = Math.max(0, Math.min(mosaicW - 1.001, gx));
    const fy = Math.max(0, Math.min(mosaicH - 1.001, gy));
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const i = iy * mosaicW + ix;
    const a = elev[i], b = elev[i + 1], c = elev[i + mosaicW], d = elev[i + mosaicW + 1];
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  };

  const checks = {
    'Dead Sea (35.5,31.5)': sample(35.5, 31.5),
    'Mediterranean (32,34)': sample(32, 34),
    'Mt Ararat (44.3,39.7)': sample(44.3, 39.7),
    'C Anatolia (35,39)': sample(35, 39)
  };
  process.stdout.write('  elevation check: ' +
    Object.entries(checks).map(([k, v]) => `${k}=${v.toFixed(0)}m`).join(', ') + '\n');

  const ZF = 5, azRad = (360 - 315 + 90) * Math.PI / 180, zenith = (90 - 45) * Math.PI / 180;
  const dLon = (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon) / OUT_W;
  const dLat = (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat) / OUT_H;
  const rgb = Buffer.alloc(OUT_W * OUT_H * 3);

  for (let py = 0; py < OUT_H; py++) {
    const sy = PADDING + ((py + 0.5) / OUT_H) * CONTENT_H;
    for (let px = 0; px < OUT_W; px++) {
      const sx = PADDING + ((px + 0.5) / OUT_W) * CONTENT_W;
      const { lon, lat } = svgToGeo(sx, sy);
      const e = sample(lon, lat);

      const latRad = lat * Math.PI / 180;
      const dzdx = (sample(lon + dLon, lat) - sample(lon - dLon, lat)) / (2 * dLon * 111320 * Math.cos(latRad));
      const dzdy = (sample(lon, lat - dLat) - sample(lon, lat + dLat)) / (2 * dLat * 110540);
      const slope = Math.atan(ZF * Math.hypot(dzdx, dzdy));
      let aspect = Math.atan2(dzdy, -dzdx);
      if (aspect < 0) aspect += 2 * Math.PI;
      let hs = Math.cos(zenith) * Math.cos(slope) + Math.sin(zenith) * Math.sin(slope) * Math.cos(azRad - aspect);
      hs = Math.max(0, hs);

      const [r, g, b] = tint(e);
      const f = 0.55 + 0.7 * hs;
      const o = (py * OUT_W + px) * 3;
      rgb[o] = Math.max(0, Math.min(255, r * f));
      rgb[o + 1] = Math.max(0, Math.min(255, g * f));
      rgb[o + 2] = Math.max(0, Math.min(255, b * f));
    }
  }

  const { detail, dW, dH, DS, placed } = await buildDetailWeight();
  const base1 = makeSmoothBase(rgb, LOD_BLUR_FACTOR);
  const base2 = makeSmoothBase(rgb, LOD_BLUR_FACTOR2);
  let sharpPx = 0;
  for (let py = 0; py < OUT_H; py++) {
    const fy = Math.min(dH - 1.001, py / DS), iy = fy | 0, ty = fy - iy;
    for (let px = 0; px < OUT_W; px++) {
      const fx = Math.min(dW - 1.001, px / DS), ix = fx | 0, tx = fx - ix;
      const i00 = iy * dW + ix;
      const d = detail[i00] * (1 - tx) * (1 - ty) + detail[i00 + 1] * tx * (1 - ty)
              + detail[i00 + dW] * (1 - tx) * ty + detail[i00 + dW + 1] * tx * ty;
      const e = Math.min(1, Math.max(0, (LOD_DESOLATE_T - d) / LOD_DESOLATE_T));
      const w = d * (1 - LOD_FLOOR) + LOD_FLOOR * (1 - e);
      if (w > 0.8) sharpPx++;
      const o = (py * OUT_W + px) * 3;
      for (let c = 0; c < 3; c++) {
        const base = base1[o + c] + e * (base2[o + c] - base1[o + c]);
        rgb[o + c] = Math.max(0, Math.min(255, base + w * (rgb[o + c] - base)));
      }
    }
  }
  process.stdout.write(`  relief LOD: ${placed} locations, ${(100 * sharpPx / (OUT_W * OUT_H)).toFixed(0)}% of pixels at near-full detail\n`);

  if (process.env.RELIEF_DEBUG) {
    const dbg = Buffer.alloc(OUT_W * OUT_H);
    for (let py = 0; py < OUT_H; py++) for (let px = 0; px < OUT_W; px++) {
      dbg[py * OUT_W + px] = Math.round(detail[Math.min(dH - 1, (py / DS) | 0) * dW + Math.min(dW - 1, (px / DS) | 0)] * 255);
    }
    const dbgRaw = join(CACHE, 'weight.gray');
    await writeFile(dbgRaw, dbg);
    execFileSync(MAGICK[0], [...MAGICK.slice(1), '-size', `${OUT_W}x${OUT_H}`, '-depth', '8', `GRAY:${dbgRaw}`, process.env.RELIEF_DEBUG]);
  }

  const rawFile = join(CACHE, 'relief.rgb');
  await writeFile(rawFile, rgb);
  const targets = outputs || [{ path: outPath, quality }];
  for (const t of targets) {
    const enc = [...MAGICK.slice(1), '-size', `${OUT_W}x${OUT_H}`, '-depth', '8', `RGB:${rawFile}`];
    if (/\.avif$/i.test(t.path)) enc.push('-define', 'heic:speed=5');
    enc.push('-quality', String(t.quality ?? quality), t.path);
    execFileSync(MAGICK[0], enc);
    const bytes = (await readFile(t.path)).length;
    process.stdout.write(`  relief: wrote ${t.path} (${OUT_W}×${OUT_H}, ${(bytes / 1024).toFixed(0)} KB)\n`);
  }
  return { width: OUT_W, height: OUT_H };
}
