import { computeStats, levelByRank } from "./stats.mjs";
import { makeProjector, prismFaces } from "./geometry.mjs";
import { themes, FONT_STACK } from "./themes.mjs";

// The terrain is the hero: it runs corner to corner, rising from bottom-left
// to top-right, and the cards sit in the two empty corners it leaves.
const W = 1280;
const H = 760;
const CX = 640;
const CY = 452;
const CELL = 22;
const GAP = 3.4;
const YAW = -24;
const PITCH = 50;
const PLATE_PAD = 14;
const PLATE_DEPTH = 30; // world units below the ground plane
const MAX_BAR = 290; // world height of the busiest day

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const r1 = (n) => Math.round(n * 10) / 10;

function adjust(hex, k) {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const out = ch.map((v) => (k >= 1 ? v + (255 - v) * (k - 1) : v * k));
  return "#" + out.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

// Linear blend between two #rrggbb colours.
function mix(a, b, k) {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + ca.map((v, i) => Math.round(v + (cb[i] - v) * k).toString(16).padStart(2, "0")).join("");
}

// Colour of the floor band at position f (0..1) through the year.
function floorAt(stops, f) {
  const x = Math.max(0, Math.min(1, f)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}

const pts = (list) => list.map((p) => `${r1(p.x)},${r1(p.y)}`).join(" ");
const poly = (list, fill, extra = "") => `<polygon points="${pts(list)}" fill="${fill}"${extra}/>`;

// "2026-06-03" -> "Jun 3"
function shortDate(iso) {
  const [, m, d] = String(iso).split("-").map(Number);
  return m >= 1 && m <= 12 && d ? `${MONTHS[m - 1]} ${d}` : esc(iso);
}

function lcg(seed) {
  return () => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

function stars(animate) {
  const rand = lcg(99);
  let out = "";
  for (let i = 0; i < 150; i++) {
    const big = rand() < 0.08;
    const x = r1(rand() * W);
    const y = r1(rand() * H);
    const o = r1(0.12 + rand() * 0.45);
    if (big && animate) {
      const dur = r1(3 + rand() * 4);
      out += `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff" opacity="${o}"><animate attributeName="opacity" values="${o};.9;${o}" dur="${dur}s" begin="${r1(-rand() * dur)}s" repeatCount="indefinite"/></circle>`;
    } else {
      out += `<circle cx="${x}" cy="${y}" r="${big ? 1.4 : 0.7}" fill="#fff" opacity="${o}"/>`;
    }
  }
  return out;
}

// Soft colour clouds behind the scene so the backdrop has depth instead of a flat fill.
function nebula() {
  return `<ellipse cx="${W * 0.8}" cy="${H * 0.2}" rx="420" ry="220" fill="url(#nebA)"/><ellipse cx="${W * 0.28}" cy="${H * 0.82}" rx="460" ry="200" fill="url(#nebB)"/>`;
}

// A ground-plane grid around the plate, faded out radially by a mask.
function floorGrid(data, project, t) {
  const halfU = (data.weeks.length * CELL) / 2 + 260;
  const halfV = (7 * CELL) / 2 + 300;
  const step = CELL * 2;
  const h = -PLATE_DEPTH;
  let lines = "";
  for (let u = -Math.floor(halfU / step) * step; u <= halfU; u += step) {
    const a = project(u, -halfV, h), b = project(u, halfV, h);
    lines += `M${r1(a.x)},${r1(a.y)}L${r1(b.x)},${r1(b.y)}`;
  }
  for (let v = -Math.floor(halfV / step) * step; v <= halfV; v += step) {
    const a = project(-halfU, v, h), b = project(halfU, v, h);
    lines += `M${r1(a.x)},${r1(a.y)}L${r1(b.x)},${r1(b.y)}`;
  }
  return `<path d="${lines}" fill="none" stroke="${t.grid}" stroke-width=".6" opacity="${t.dark ? ".55" : ".5"}" mask="url(#gridMask)"/>`;
}

// Colour levels follow the spread of active days (quartiles), so one huge day
// does not flatten every other day into the lowest colour.
function rankThresholds(weeks) {
  const counts = weeks.flat().map((d) => d.count).filter((c) => c > 0).sort((a, b) => a - b);
  const at = (q) => counts[Math.min(counts.length - 1, Math.floor(q * counts.length))] ?? 0;
  return [at(0.25), at(0.5), at(0.75)];
}

function terrain(data, stats, t, project, animate) {
  const weekCount = data.weeks.length;
  const u0 = (-weekCount * CELL) / 2;
  const v0 = (-7 * CELL) / 2;

  const cells = [];
  data.weeks.forEach((week, i) =>
    week.forEach((day, j) => {
      const u = u0 + i * CELL + GAP / 2;
      const v = v0 + j * CELL + GAP / 2;
      cells.push({ u, v, day, week: i, row: j, depth: project(u, v, 0).depth });
    })
  );
  cells.sort((a, b) => a.depth - b.depth);

  const size = CELL - GAP;
  const thresholds = rankThresholds(data.weeks);
  const heightOf = (count) => 6 + Math.pow(count / stats.max, 0.6) * MAX_BAR;
  let floor = "";
  let svg = "";
  const barBoxes = [];
  let peakTop = null;
  const jitter = lcg(7);
  for (const { u, v, day, week, row } of cells) {
    const isPeak = stats.peak.date === day.date && day.count > 0;
    const base = isPeak ? t.peak : t.ramp[levelByRank(day.count, thresholds)];
    if (day.count === 0) {
      // Empty days take the floor band, with a little per-cell variation for texture.
      const band = floorAt(t.floor, (week + row / 7) / Math.max(1, weekCount - 1));
      floor += poly(
        [project(u, v), project(u + size, v), project(u + size, v + size), project(u, v + size)],
        t.dark ? adjust(band, 0.9 + jitter() * 0.2) : band,
        ` opacity="${t.dark ? ".9" : "1"}" stroke="${t.cellEdge}" stroke-width="${t.dark ? ".6" : "1.2"}" stroke-opacity="${t.dark ? ".7" : "1"}"`
      );
      continue;
    }
    const height = heightOf(day.count);
    const faces = prismFaces(project, u, v, size, height);
    const xs = faces.flatMap((f) => f.pts.map((q) => q.x)), ys = faces.flatMap((f) => f.pts.map((q) => q.y));
    barBoxes.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
    for (const face of faces) {
      const edge = !face.top
        ? ""
        : t.neonEdges
          ? ` stroke="${t.dark ? mix(base, "#ffffff", 0.45) : adjust(base, 0.82)}" stroke-width="1" stroke-opacity=".95"`
          : ` stroke="${t.cellEdge}" stroke-width=".6" stroke-opacity=".62"`;
      const glow = face.top && isPeak ? ` filter="url(#glow)"` : "";
      svg += poly(face.pts, adjust(base, face.shade), `${edge}${glow}`);
    }
    if (isPeak) peakTop = project(u + size / 2, v + size / 2, height);
  }

  // The plate is a slab under the calendar; only faces turned toward the viewer are drawn.
  const U0 = u0 - PLATE_PAD, U1 = -u0 + PLATE_PAD, V0 = v0 - PLATE_PAD, V1 = -v0 + PLATE_PAD;
  const corner = (u, v, h = 0) => project(u, v, h);
  const top = [corner(U0, V0), corner(U1, V0), corner(U1, V1), corner(U0, V1)];
  const bottom = [corner(U0, V0, -PLATE_DEPTH), corner(U1, V0, -PLATE_DEPTH), corner(U1, V1, -PLATE_DEPTH), corner(U0, V1, -PLATE_DEPTH)];
  const sides = [
    { n: [0, 1], i: [3, 2], shade: 1 },
    { n: [-1, 0], i: [0, 3], shade: 0.8 },
    { n: [1, 0], i: [2, 1], shade: 0.8 },
    { n: [0, -1], i: [1, 0], shade: 1 },
  ]
    .filter((s) => project.facing(s.n[0], s.n[1]) > 0)
    .map((s) => poly([top[s.i[0]], top[s.i[1]], bottom[s.i[1]], bottom[s.i[0]]], adjust(t.plateSide, s.shade)))
    .join("");

  const shadow = `<polygon points="${pts(bottom.map((p) => ({ x: p.x + 6, y: p.y + 22 })))}" fill="${t.shadow}" opacity="${t.dark ? ".75" : ".2"}" filter="url(#soft)"/>`;
  // Rim light along the two front edges catches the eye and separates plate from floor.
  // Neon tube edges: a thick glowing core with a soft halo, pink along the
  // back edges and green along the front edges.
  const tube = (list, color) =>
    `<polyline points="${pts(list)}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#neon)"/>` +
    `<polyline points="${pts(list)}" fill="none" stroke="${mix(color, "#ffffff", 0.55)}" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/>`;
  const rim = tube([top[3], top[0], top[1], top[2]], t.edgeBack) + tube([top[0], top[3], top[2]], t.edgeFront);
  const plate =
    shadow +
    sides +
    `<polygon points="${pts(top)}" fill="url(#plateFill)" stroke="${t.plateEdge}" stroke-width="1"/>` +
    rim;

  // Month ticks along the front edge, below the slab.
  let months = "";
  let prev = -1;
  data.weeks.forEach((week, i) => {
    const m = Number(String(week[0]?.date || "").slice(5, 7));
    if (!m || m === prev) return;
    const first = prev === -1;
    prev = m;
    if (first && Number(String(week[0].date).slice(8, 10)) > 14) return; // partial leading month
    const a = project(u0 + i * CELL, V1, -PLATE_DEPTH);
    months += `<line x1="${r1(a.x)}" y1="${r1(a.y + 4)}" x2="${r1(a.x)}" y2="${r1(a.y + 10)}" stroke="${t.mute}" stroke-opacity=".6"/><text x="${r1(a.x)}" y="${r1(a.y + 24)}" text-anchor="middle" font-size="12" letter-spacing=".4" fill="${t.mute}">${MONTHS[m - 1]}</text>`;
  });

  // A colour wave rolls across the year: one soft strip per week fades in and
  // out in turn, between the floor and the bars, so bars stay solid in front.
  // Each pass takes the next colour in the theme's wave palette.
  let wave = "";
  if (animate && t.wave) {
    const period = 7;
    const travel = 4;
    data.weeks.forEach((_, i) => {
      const a = u0 + i * CELL, b = a + CELL;
      const begin = r1((i / weekCount) * travel);
      wave += `<polygon points="${pts([project(a, v0), project(b, v0), project(b, -v0), project(a, -v0)])}" fill="${t.wave[0]}" opacity="0">` +
        `<animate attributeName="opacity" values="0;${t.waveOpacity};0;0" keyTimes="0;0.07;0.2;1" dur="${period}s" begin="${begin}s" repeatCount="indefinite"/>` +
        `<animate attributeName="fill" values="${t.wave.join(";")}" calcMode="discrete" dur="${period * t.wave.length}s" begin="${begin}s" repeatCount="indefinite"/>` +
        `</polygon>`;
    });
  }

  return { plate, bars: floor + wave + svg, months, peakTop, blockers: { plate: top, boxes: barBoxes } };
}

// A light beam rising from the busiest day, with a callout at its tip.
function beacon(peakTop, stats, t) {
  if (!peakTop) return "";
  const x = r1(peakTop.x), y0 = r1(peakTop.y - 2), y1 = r1(Math.max(44, peakTop.y - 64));
  const label = `${shortDate(stats.peak.date)} · ${stats.max}`;
  const w = 26 + label.length * 6.4;
  return `<g>
  <linearGradient id="beam" gradientUnits="userSpaceOnUse" x1="0" y1="${y0}" x2="0" y2="${y1}"><stop offset="0" stop-color="${t.peak}" stop-opacity=".95"/><stop offset="1" stop-color="${t.peak}" stop-opacity="0"/></linearGradient>
  <line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="url(#beam)" stroke-width="7" opacity=".25"/>
  <line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="url(#beam)" stroke-width="1.5"/>
  <rect x="${r1(x - 11)}" y="${r1(y1 - 22)}" width="${r1(w)}" height="20" rx="10" fill="${t.bgOuter}" fill-opacity=".72" stroke="${t.peak}" stroke-opacity=".55"/>
  <circle cx="${x}" cy="${r1(y1 - 12)}" r="3" fill="${t.peak}"/>
  <text x="${r1(x + 8)}" y="${r1(y1 - 8)}" font-size="11" font-weight="600" fill="${t.ink}">${esc(label)}</text>
</g>`;
}

function hashName(name) {
  let h = 2166136261;
  for (const ch of String(name)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// A lit sphere: base gradient with a highlight toward the scene light, tilted
// cloud bands and a drifting storm spot clipped to the disc, a terminator
// shadow, a specular glint, an atmosphere rim, and for the lead planet a
// banded ring that passes behind and in front of the body.
function planetSphere(i, r, color, seed, ringed, animate, t) {
  const rand = lcg(seed % 100000 + 1);
  const id = `pl${i}`;
  const light = mix(color, "#ffffff", 0.55);
  const defs = `<radialGradient id="${id}b" cx="50%" cy="50%" r="50%" fx="33%" fy="30%">` +
    `<stop offset="0" stop-color="${light}"/><stop offset=".28" stop-color="${adjust(color, 1.12)}"/>` +
    `<stop offset=".62" stop-color="${color}"/><stop offset=".88" stop-color="${adjust(color, 0.42)}"/>` +
    `<stop offset="1" stop-color="${adjust(color, 0.2)}"/></radialGradient>` +
    `<radialGradient id="${id}a" r="50%"><stop offset=".7" stop-color="${color}" stop-opacity="0"/>` +
    `<stop offset=".79" stop-color="${adjust(color, 1.3)}" stop-opacity="${t.neonEdges ? 0.7 : 0.38}"/><stop offset=".88" stop-color="${color}" stop-opacity="${t.neonEdges ? 0.28 : 0.1}"/>` +
    `<stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>` +
    `<clipPath id="${id}c"><circle r="${r1(r)}"/></clipPath>`;

  // Cloud bands: soft tilted stripes, alternating lighter and darker.
  const tilt = -14 + rand() * 10;
  let bands = "";
  const n = 3 + Math.floor(rand() * 3);
  for (let k = 0; k < n; k++) {
    const y = r1(-r + ((k + 0.5) * 2 * r) / n + (rand() - 0.5) * r * 0.2);
    const h = r1(r * (0.1 + rand() * 0.16));
    const tone = k % 2 ? adjust(color, 0.62) : mix(color, "#ffffff", 0.35);
    bands += `<ellipse cx="0" cy="${y}" rx="${r1(r * 1.5)}" ry="${h}" fill="${tone}" opacity="${r1(0.18 + rand() * 0.16)}"/>`;
  }
  const spotY = r1((rand() - 0.5) * r * 0.9);
  const spotDur = r1(18 + rand() * 14);
  const spot = `<ellipse cx="${r1((rand() - 0.5) * r)}" cy="${spotY}" rx="${r1(r * 0.26)}" ry="${r1(r * 0.12)}" fill="${adjust(color, 0.55)}" opacity=".45">` +
    (animate ? `<animate attributeName="cx" values="${r1(-r * 1.4)};${r1(r * 1.4)}" dur="${spotDur}s" begin="${r1(-rand() * spotDur)}s" repeatCount="indefinite"/>` : "") +
    `</ellipse>`;

  const ringArc = (rx, ry, sweep, width, op, tone) =>
    `<path d="M${r1(-rx)},0 A${r1(rx)},${r1(ry)} 0 0,${sweep} ${r1(rx)},0" fill="none" stroke="${tone}" stroke-opacity="${op}" stroke-width="${width}"/>`;
  const ringSet = (sweep, k) =>
    `<g transform="rotate(-18)">` +
    ringArc(r * 1.55, r * 0.36, sweep, r1(r * 0.16), r1(0.55 * k), mix(color, "#ffffff", 0.4)) +
    ringArc(r * 1.85, r * 0.43, sweep, r1(r * 0.2), r1(0.75 * k), adjust(color, 1.2)) +
    ringArc(r * 2.15, r * 0.5, sweep, r1(r * 0.08), r1(0.45 * k), mix(color, "#ffffff", 0.6)) +
    `</g>`;

  const svg =
    `<circle r="${r1(r * 1.28)}" fill="url(#${id}a)"/>` +
    (ringed ? ringSet(1, 0.75) : "") +
    `<circle r="${r1(r)}" fill="url(#${id}b)"/>` +
    `<g clip-path="url(#${id}c)"><g transform="rotate(${r1(tilt)})">${bands}${spot}</g>` +
    (ringed ? `<ellipse cx="0" cy="${r1(r * 0.18)}" rx="${r1(r * 1.9)}" ry="${r1(r * 0.12)}" fill="#000" opacity=".28" transform="rotate(-18)"/>` : "") +
    `</g>` +
    `<circle r="${r1(r)}" fill="url(#plTerm)"/>` +
    `<ellipse cx="${r1(-r * 0.36)}" cy="${r1(-r * 0.42)}" rx="${r1(r * 0.3)}" ry="${r1(r * 0.17)}" fill="url(#plSpec)" transform="rotate(-38 ${r1(-r * 0.36)} ${r1(-r * 0.42)})"/>` +
    `<path d="M${r1(r * Math.cos(3.5))},${r1(r * Math.sin(3.5))} A${r1(r)},${r1(r)} 0 0,1 ${r1(r * Math.cos(5.1))},${r1(r * Math.sin(5.1))}" fill="none" stroke="${t.planetLight}" stroke-opacity=".3" stroke-width=".7" stroke-linecap="round"/>` +
    (ringed ? ringSet(0, 1) : "");
  return { defs, svg };
}

const RINGS = [440, 515, 590];
const RING_FLATTEN = 0.2;

// Planets orbit in a plane that passes behind the calendar on its far side
// and in front of it on its near side. Rings are split into a back and a front
// arc; each planet is drawn twice, once per layer, clipped to its half, so the
// animated copies stay in lockstep and the far side is hidden by the terrain.
// Point on an orbit at a fraction of its length, matching animateMotion's
// paced timing. The path starts on the left and runs through the near side first.
function orbitWalker(R, ry) {
  const steps = 720;
  const pts = [], len = [0];
  for (let k = 0; k <= steps; k++) {
    const th = Math.PI - (2 * Math.PI * k) / steps;
    pts.push({ x: CX + R * Math.cos(th), y: CY + ry * Math.sin(th) });
    if (k) len.push(len[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
  }
  const total = len[steps];
  return (f) => {
    const target = (((f % 1) + 1) % 1) * total;
    let k = len.findIndex((l) => l >= target);
    if (k <= 0) return pts[0];
    const a = (target - len[k - 1]) / (len[k] - len[k - 1] || 1);
    return { x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * a, y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * a };
  };
}

// True when an axis-aligned box touches the terrain: the plate's top surface
// (a convex polygon, tested with separating axes) or any bar's bounding box.
function hitsTerrain(box, blockers) {
  if (!blockers) return false;
  for (const b of blockers.boxes) if (box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0) return true;
  const poly = blockers.plate;
  const corners = [{ x: box.x0, y: box.y0 }, { x: box.x1, y: box.y0 }, { x: box.x1, y: box.y1 }, { x: box.x0, y: box.y1 }];
  const axes = [{ x: 1, y: 0 }, { x: 0, y: 1 }, ...poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length];
    return { x: q.y - p.y, y: p.x - q.x };
  })];
  return axes.every((ax) => {
    const proj = (list) => list.map((p) => p.x * ax.x + p.y * ax.y);
    const a = proj(corners), b = proj(poly);
    return Math.max(...a) > Math.min(...b) && Math.max(...b) > Math.min(...a);
  });
}

function orbits(data, t, animate, blockers) {
  const arc = (R, sweep) => `M${CX - R},${CY} A${R},${r1(R * RING_FLATTEN)} 0 0,${sweep} ${CX + R},${CY}`;
  // Each orbit is layered: a soft glow, a crisp core line, and a fine bright
  // line on top. The near half is brighter than the far half, and in animated
  // mode a pulse of light travels along the near half.
  const ringPath = (R, i, sweep) => {
    const d = arc(R, sweep);
    const near = !sweep;
    const ry = R * RING_FLATTEN;
    const half = Math.PI * Math.sqrt((R * R + ry * ry) / 2);
    const glow = `<path d="${d}" fill="none" stroke="${t.ring}" stroke-width="${near ? 7 : 5}" stroke-opacity="${near ? 0.1 : 0.05}" stroke-linecap="round"/>`;
    const core = i === 2
      ? `<path d="${d}" fill="none" stroke="url(#ringFade)" stroke-width="${near ? 2.2 : 1.6}" stroke-dasharray="0.1 9" stroke-linecap="round" opacity="${near ? 1 : 0.55}"/>`
      : `<path d="${d}" fill="none" stroke="url(#ringFade)" stroke-width="${near ? 1.8 : 1.3}" opacity="${near ? 1 : 0.55}"/>` +
        `<path d="${d}" fill="none" stroke="${t.ringHi}" stroke-width=".6" stroke-opacity="${near ? 0.55 : 0.25}"/>`;
    const dur = 9 + i * 3;
    const pulse = animate && near
      ? `<path d="${d}" fill="none" stroke="${t.ringHi}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="${r1(half * 0.08)} ${r1(half * 2)}" stroke-opacity=".8"><animate attributeName="stroke-dashoffset" values="${r1(half * 0.1)};${r1(-half * 1.05)}" dur="${dur}s" begin="${-i * 2.7}s" repeatCount="indefinite"/></path>`
      : "";
    return glow + core + pulse;
  };

  // Normalise repo fields so unexpected API values cannot break the geometry.
  const repos = (data.repos || []).slice(0, 6).map((r) => ({
    name: String(r?.name ?? ""),
    stars: Math.max(0, Math.floor(Number(r?.stars)) || 0),
  }));
  const maxStars = Math.max(1, ...repos.map((r) => r.stars));
  const planet = (repo, i) => {
    const ring = i % RINGS.length;
    const R = RINGS[ring];
    const ry = r1(R * RING_FLATTEN);
    const radius = 14 + 10 * Math.sqrt(repo.stars / maxStars);
    const seed = hashName(repo.name);
    // Planets always use the theme's neon palette, one distinct colour each.
    const color = t.planets[i % t.planets.length];
    const name = esc(repo.name.length > 18 ? `${repo.name.slice(0, 17)}…` : repo.name);
    const starsLabel = repo.stars > 0 ? `<tspan fill="${t.mute}" font-weight="500"> ★${repo.stars}</tspan>` : "";
    const duration = 52 + ring * 20 + i * 3;
    const phase = (i / repos.length + ring * 0.17) % 1;
    const begin = r1(-duration * phase);

    // Path starts on the left and runs through the near side first.
    const path = `M${CX - R},${CY} a${R},${ry} 0 1,0 ${2 * R},0 a${R},${ry} 0 1,0 ${-2 * R},0`;
    const samples = 12;
    // Planets swell slightly on the near side and shrink on the far side.
    const scales = Array.from({ length: samples + 1 }, (_, k) => 1 + 0.18 * Math.sin((2 * Math.PI * k) / samples));
    const angle = Math.PI - 2 * Math.PI * phase;
    const near = Math.sin(angle);

    const motion = animate
      ? `<animateMotion dur="${duration}s" begin="${begin}s" repeatCount="indefinite" path="${path}"/>`
      : "";
    const scale = animate
      ? `<animateTransform attributeName="transform" type="scale" values="${scales.map((s) => r1(s * 100) / 100).join(";")}" dur="${duration}s" begin="${begin}s" repeatCount="indefinite"/>`
      : "";
    const place = animate ? "" : ` transform="translate(${r1(CX + R * Math.cos(angle))} ${r1(CY + R * RING_FLATTEN * near)})"`;
    const staticScale = animate ? "" : ` transform="scale(${r1((1 + 0.18 * near) * 100) / 100})"`;

    // Names sit in their own top layer. On the near side they always show. On
    // the far side a name shows only while it would sit in clear sky, and hides
    // while it would overlap the grid or the bars, so it is never drawn over
    // the terrain or cut off.
    const chars = Math.min(repo.name.length, 18) + (repo.stars > 0 ? 2 + String(repo.stars).length : 0);
    const labelBox = (x, y, sc) => {
      const w = (chars * 7 + 8) * sc, base = y + (-radius - 11) * sc;
      return { x0: x - w / 2, x1: x + w / 2, y0: base - 13 * sc, y1: base + 4 * sc };
    };
    const shown = (x, y, sc, isNear) => isNear || !hitsTerrain(labelBox(x, y, sc), blockers);
    const label = `<text y="${r1(-radius - 11)}" text-anchor="middle" font-size="12" font-weight="600" fill="${t.ink}" paint-order="stroke" stroke="${t.bgOuter}" stroke-width="3" stroke-linejoin="round">${name}${starsLabel}</text>`;
    const sphere = planetSphere(i, radius, color, seed, i === 0, animate, t);
    defs.push(sphere.defs);
    // Each planet is drawn twice: once behind the terrain and once in front.
    // In animated mode exactly one copy is visible at a time. The near copy
    // shows for the first half of the orbit (the near side) and the far copy
    // for the second half, so the planet and its label always switch layers
    // together and are never cut in two.
    const swap = (side) =>
      animate
        ? `<animate attributeName="visibility" values="${side === "near" ? "visible;hidden" : "hidden;visible"}" keyTimes="0;0.5" calcMode="discrete" dur="${duration}s" begin="${begin}s" repeatCount="indefinite"/>`
        : "";
    const body = (side) => `<g${place}>${motion}${swap(side)}<g${staticScale}>${scale}
  <ellipse cx="0" cy="${r1(radius + 7)}" rx="${r1(radius * 1.15)}" ry="${r1(radius * 0.28)}" fill="#000" opacity=".3" filter="url(#soft4)"/>
  ${sphere.svg}
</g></g>`;

    let labelLayer;
    if (animate) {
      const N = 72;
      const at = orbitWalker(R, R * RING_FLATTEN);
      const states = Array.from({ length: N }, (_, k) => {
        const f = k / N, p = at(f);
        return shown(p.x, p.y, 1 + 0.18 * Math.sin(2 * Math.PI * f), f < 0.5) ? "visible" : "hidden";
      });
      const values = [], times = [];
      states.forEach((v, k) => { if (k === 0 || v !== states[k - 1]) { values.push(v); times.push(r1((k / N) * 1000) / 1000); } });
      const vis = values.length > 1
        ? `<animate attributeName="visibility" values="${values.join(";")}" keyTimes="${times.join(";")}" calcMode="discrete" dur="${duration}s" begin="${begin}s" repeatCount="indefinite"/>`
        : "";
      labelLayer = values.length === 1 && values[0] === "hidden"
        ? ""
        : `<g>${motion}${vis}<g>${scale}${label}</g></g>`;
    } else {
      const x = CX + R * Math.cos(angle), y = CY + R * RING_FLATTEN * near;
      labelLayer = shown(x, y, 1 + 0.18 * near, near >= 0) ? `<g${place}><g${staticScale}>${label}</g></g>` : "";
    }

    return { body, near, labelLayer };
  };

  const defs = [];
  const bodies = repos.map(planet);
  const layer = (side, pick) =>
    `<g id="${side}Planets">` +
    (animate ? bodies : bodies.filter(pick)).map((b) => b.body(side)).join("\n") +
    `</g>`;

  return {
    back: RINGS.map((R, i) => ringPath(R, i, 1)).join("") + layer("far", (b) => b.near < 0),
    front: RINGS.map((R, i) => ringPath(R, i, 0)).join("") + layer("near", (b) => b.near >= 0),
    labels: `<g id="planetLabels">${bodies.map((b) => b.labelLayer).join("\n")}</g>`,
    defs: defs.join("\n"),
  };
}

// Top-left card: identity, four headline numbers in a row, and a sparkline.
function panel(data, stats, t) {
  const x = 40, y = 36, w = 440, h = 236;
  const col = (w - 56) / 4;
  const stat = (i, value, label) =>
    `<text x="${r1(x + 28 + i * col)}" y="${y + 138}" font-size="26" font-weight="700" letter-spacing="-0.5" fill="${t.ink}">${esc(value)}</text>` +
    `<text x="${r1(x + 28 + i * col)}" y="${y + 156}" font-size="11.5" fill="${t.mute}">${esc(label)}</text>`;

  const series = stats.weekly.slice(-26);
  const top = Math.max(1, ...series);
  const sx0 = x + 28, sw = w - 56, sy0 = y + h - 18, sh = 30;
  const step = sw / Math.max(1, series.length - 1);
  const line = series.map((v, i) => `${r1(sx0 + i * step)},${r1(sy0 - (v / top) * sh)}`);
  const area = `${sx0},${sy0} ${line.join(" ")} ${r1(sx0 + sw)},${sy0}`;
  const last = line[line.length - 1] || `${sx0},${sy0}`;
  const [lx, ly] = last.split(",");

  return `<g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="url(#glassFill)" stroke="url(#glassEdge)" stroke-width="${t.neonFrame ? 2 : 1}"${t.neonFrame ? ` filter="url(#neon)"` : ""}/>
  <rect x="${x + 28}" y="${y + 26}" width="18" height="3" rx="1.5" fill="${t.glow}"/>
  <text x="${x + 52}" y="${y + 31}" font-size="9.5" font-weight="700" letter-spacing="1.6" fill="${t.glow}">CONTRIBUTION OBSERVATORY</text>
  <text x="${x + w - 28}" y="${y + 31}" text-anchor="end" font-size="10.5" fill="${t.mute}" opacity=".8">Updated ${esc(data.generatedAt)}</text>
  <text x="${x + 28}" y="${y + 62}" font-size="24" font-weight="700" letter-spacing="-0.3" fill="${t.ink}">${esc(data.name)}</text>
  <text x="${x + 28}" y="${y + 82}" font-size="13" fill="${t.mute}">@${esc(data.login)} · last 12 months</text>
  <line x1="${x + 28}" x2="${x + w - 28}" y1="${y + 100}" y2="${y + 100}" stroke="${t.rule}"/>
  ${stat(0, stats.total.toLocaleString("en-US"), "contributions")}
  ${stat(1, `${stats.activeDays}`, "active days")}
  ${stat(2, `${stats.current} d`, "current streak")}
  ${stat(3, `${stats.longest} d`, "longest streak")}
  <text x="${x + 28}" y="${y + 184}" font-size="11" fill="${t.mute}">Weekly activity · last 26 weeks</text>
  <polygon points="${area}" fill="url(#sparkFill)"/>
  <polyline points="${line.join(" ")}" fill="none" stroke="${t.glow}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="${lx}" cy="${ly}" r="3.2" fill="${t.glow}" stroke="${t.bgOuter}" stroke-width="1.5"/>
</g>`;
}

// Bottom-right card: the intensity ramp drawn as tiny prisms that echo the terrain, and the peak day.
function legend(stats, t) {
  const w = 340, h = 128, x = W - 40 - w, y = H - 28 - h;
  let ramp = "";
  t.ramp.forEach((color, i) => {
    const p = makeProjector({ yawDeg: YAW, pitchDeg: PITCH, cx: x + 42 + i * 26, cy: y + 72 });
    const size = 12;
    if (i === 0) {
      ramp += poly([p(-size / 2, -size / 2), p(size / 2, -size / 2), p(size / 2, size / 2), p(-size / 2, size / 2)], color, ` stroke="${t.cellEdge}" stroke-width="${t.dark ? ".6" : "1.2"}"`);
      return;
    }
    for (const face of prismFaces(p, -size / 2, -size / 2, size, i * 9)) {
      ramp += poly(face.pts, adjust(color, face.shade), face.top ? ` stroke="${t.cellEdge}" stroke-width=".45" stroke-opacity=".62"` : "");
    }
  });

  const px = x + 196;
  const peak = stats.peak.date
    ? `<text x="${px}" y="${y + 70}" font-size="20" font-weight="700" fill="${t.ink}">${esc(shortDate(stats.peak.date))}</text>
  <text x="${px}" y="${y + 88}" font-size="11" fill="${t.mute}">${stats.max} contributions</text>`
    : `<text x="${px}" y="${y + 70}" font-size="12" fill="${t.mute}">No activity yet</text>`;

  return `<g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="url(#glassFill)" stroke="url(#glassEdge)" stroke-width="${t.neonFrame ? 2 : 1}"${t.neonFrame ? ` filter="url(#neon)"` : ""}/>
  <text x="${x + 28}" y="${y + 28}" font-size="11" fill="${t.mute}">Daily intensity</text>
  ${ramp}
  <text x="${x + 28}" y="${y + 96}" font-size="10" fill="${t.mute}" opacity=".8">less</text>
  <text x="${x + 162}" y="${y + 96}" font-size="10" fill="${t.mute}" opacity=".8" text-anchor="end">more</text>
  <line x1="${x + 178}" x2="${x + 178}" y1="${y + 18}" y2="${y + 96}" stroke="${t.rule}"/>
  <circle cx="${px + 4}" cy="${y + 24}" r="4" fill="${t.peak}" filter="url(#glow)"/>
  <text x="${px + 14}" y="${y + 28}" font-size="11" fill="${t.mute}">Peak day</text>
  ${peak}
  <text x="${x + 28}" y="${y + h - 12}" font-size="10" fill="${t.mute}" opacity=".8">Planets: top repositories · size by stars</text>
</g>`;
}

export function renderSvg(data, { theme = "aurora", animate = true } = {}) {
  const t = themes[theme];
  if (!t) throw new Error(`Unknown theme "${theme}". Available: ${Object.keys(themes).join(", ")}`);

  const stats = computeStats(data.weeks);
  const project = makeProjector({ yawDeg: YAW, pitchDeg: PITCH, cx: CX, cy: CY });
  const { plate, bars, months, peakTop, blockers } = terrain(data, stats, t, project, animate);
  const orbit = orbits(data, t, animate, blockers);
  const label = `${data.name}: ${stats.total} contributions, longest streak ${stats.longest} days`;
  const desc =
    `3D contribution terrain for @${data.login}: ${stats.total} contributions over ${stats.activeDays} active days, ` +
    `current streak ${stats.current} days, longest streak ${stats.longest} days` +
    (stats.peak.date ? `, busiest day ${stats.peak.date} with ${stats.max} contributions.` : ".");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}" font-family="${FONT_STACK}" text-rendering="geometricPrecision">
<title>${esc(label)}</title>
<desc>${esc(desc)}</desc>
<defs>
  <radialGradient id="bg" cx="62%" cy="58%" r="85%"><stop offset="0" stop-color="${t.bgInner}"/><stop offset=".55" stop-color="${t.bgMid}"/><stop offset="1" stop-color="${t.bgOuter}"/></radialGradient>
  <radialGradient id="nebA"><stop offset="0" stop-color="${t.nebulaA}" stop-opacity="${t.dark ? 0.28 : 0.6}"/><stop offset="1" stop-color="${t.nebulaA}" stop-opacity="0"/></radialGradient>
  <radialGradient id="nebB"><stop offset="0" stop-color="${t.nebulaB}" stop-opacity="${t.dark ? 0.22 : 0.55}"/><stop offset="1" stop-color="${t.nebulaB}" stop-opacity="0"/></radialGradient>
  <radialGradient id="gridFade" cx="50%" cy="58%" r="52%"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <mask id="gridMask"><rect width="${W}" height="${H}" fill="url(#gridFade)"/></mask>
  <linearGradient id="glassFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${t.dark ? 0.09 : 1}"/><stop offset="1" stop-color="#fff" stop-opacity="${t.dark ? 0.03 : 0.97}"/></linearGradient>
  <linearGradient id="glassEdge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.borderA}" stop-opacity="${t.dark ? 0.35 : 0.9}"/><stop offset="1" stop-color="${t.borderB}" stop-opacity="${t.dark ? 0.35 : 0.9}"/></linearGradient>
  <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.glow}" stop-opacity=".35"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></linearGradient>
  <linearGradient id="plateFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.dark ? adjust(t.plateTop, 0.85) : t.plateTop}"/><stop offset="1" stop-color="${t.dark ? adjust(t.plateTop, 1.08) : t.plateTop}"/></linearGradient>
  <linearGradient id="ringFade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.ring}" stop-opacity=".4"/><stop offset=".5" stop-color="${t.ring}" stop-opacity=".95"/><stop offset="1" stop-color="${t.ring}" stop-opacity=".4"/></linearGradient>
  <linearGradient id="plTerm" x1=".15" y1=".1" x2=".95" y2=".95"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></linearGradient>
  <radialGradient id="plSpec"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <filter id="soft4" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="3"/></filter>
  ${orbit.defs}
  <radialGradient id="floorGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${t.glow}" stop-opacity="${t.dark ? 0.25 : 0.06}"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>
  <filter id="neon" x="-10%" y="-10%" width="120%" height="120%" filterUnits="objectBoundingBox"><feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="soft" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="12"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${nebula()}
${t.stars ? stars(animate) : ""}
${floorGrid(data, project, t)}
<ellipse cx="${CX}" cy="${CY}" rx="660" ry="280" fill="url(#floorGlow)"/>
${orbit.back}
${plate}
${bars}
${months}
${beacon(peakTop, stats, t)}
${orbit.front}
${orbit.labels}
${panel(data, stats, t)}
${legend(stats, t)}
</svg>
`;
}
