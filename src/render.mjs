import { computeStats } from "./stats.mjs";
import { makeProjector } from "./geometry.mjs";
import { themes, FONT_STACK } from "./themes.mjs";
import { pie } from "./pie.mjs";

// The year is the hero: a 3D pie of month wedges round a glowing core, with
// the top repositories orbiting it as planets. The card sits in the top-left
// corner the scene leaves free.
const W = 1280;
const H = 760;

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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
    `<stop offset=".79" stop-color="${adjust(color, 1.3)}" stop-opacity=".38"/><stop offset=".88" stop-color="${color}" stop-opacity=".1"/>` +
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

const RINGS = [372, 438, 504];
const RING_FLATTEN = 0.24;
// Orbits circle the pie's centre.
const OCX = 704;
const OCY = 430;

// Planets orbit in a plane that passes behind the pie on its far side and in
// front of it on its near side. Rings are split into a back and a front
// arc; each planet is drawn twice, once per layer, clipped to its half, so the
// animated copies stay in lockstep and the far side is hidden by the pie.
// Point on an orbit at a fraction of its length, matching animateMotion's
// paced timing. The path starts on the left and runs through the near side first.
function orbitWalker(R, ry) {
  const steps = 720;
  const pts = [], len = [0];
  for (let k = 0; k <= steps; k++) {
    const th = Math.PI - (2 * Math.PI * k) / steps;
    pts.push({ x: OCX + R * Math.cos(th), y: OCY + ry * Math.sin(th) });
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

// True when an axis-aligned box touches the pie: its disc (a convex polygon,
// tested with separating axes) or any slice segment's bounding box.
function hitsPie(box, blockers) {
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
  const arc = (R, sweep) => `M${OCX - R},${OCY} A${R},${r1(R * RING_FLATTEN)} 0 0,${sweep} ${OCX + R},${OCY}`;
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
    // Planets use the theme's planet palette, one distinct colour each.
    const color = t.planets[i % t.planets.length];
    const name = esc(repo.name.length > 18 ? `${repo.name.slice(0, 17)}…` : repo.name);
    const starsLabel = repo.stars > 0 ? `<tspan fill="${t.mute}" font-weight="500"> ★${repo.stars}</tspan>` : "";
    const duration = 52 + ring * 20 + i * 3;
    const phase = (i / repos.length + ring * 0.17) % 1;
    const begin = r1(-duration * phase);

    // Path starts on the left and runs through the near side first.
    const path = `M${OCX - R},${OCY} a${R},${ry} 0 1,0 ${2 * R},0 a${R},${ry} 0 1,0 ${-2 * R},0`;
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
    const place = animate ? "" : ` transform="translate(${r1(OCX + R * Math.cos(angle))} ${r1(OCY + R * RING_FLATTEN * near)})"`;
    const staticScale = animate ? "" : ` transform="scale(${r1((1 + 0.18 * near) * 100) / 100})"`;

    // Names sit in their own top layer. On the near side they always show. On
    // the far side a name shows only while it would sit in clear sky, and hides
    // while it would overlap the pie, so it is never drawn over the pie or cut
    // off.
    const chars = Math.min(repo.name.length, 18) + (repo.stars > 0 ? 2 + String(repo.stars).length : 0);
    const labelBox = (x, y, sc) => {
      const w = (chars * 7 + 8) * sc, base = y + (-radius - 11) * sc;
      return { x0: x - w / 2, x1: x + w / 2, y0: base - 13 * sc, y1: base + 4 * sc };
    };
    const shown = (x, y, sc, isNear) => isNear || !hitsPie(labelBox(x, y, sc), blockers);
    const label = `<text y="${r1(-radius - 11)}" text-anchor="middle" font-size="12" font-weight="600" fill="${t.ink}" paint-order="stroke" stroke="${t.bgOuter}" stroke-width="3" stroke-linejoin="round">${name}${starsLabel}</text>`;
    const sphere = planetSphere(i, radius, color, seed, i === 0, animate, t);
    defs.push(sphere.defs);
    // Each planet is drawn twice: once behind the pie and once in front.
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
      const x = OCX + R * Math.cos(angle), y = OCY + R * RING_FLATTEN * near;
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

// Contribution mix: a small upright 3D pie facing the viewer, showing how the
// year's contributions split between commits, pull requests, issues and code
// review, as shares of those four, like GitHub's overview.
// Each slice's share and name sit beside it on a short leader line, as on
// GitHub's activity overview, so the split never relies on colour alone.
function mixPie(data, t, x0, w, top, size = 1) {
  const m = data.mix || {};
  const known = [
    ["Commits", m.commits], ["Pull requests", m.pullRequests], ["Issues", m.issues], ["Code review", m.reviews],
  ].map(([label, v]) => [label, Math.max(0, Math.floor(Number(v)) || 0)]);
  const parts = known.map(([label, v], i) => ({ label, v, colour: t.mix[i] })).filter((p) => p.v > 0);
  const sum = parts.reduce((s, p) => s + p.v, 0);

  // Shares that add up to exactly 100 (largest remainder).
  const raw = parts.map((p) => (p.v / (sum || 1)) * 100);
  const pct = raw.map(Math.floor);
  raw.map((v, i) => [v - pct[i], i]).sort((a, b) => b[0] - a[0]).slice(0, 100 - pct.reduce((s, v) => s + v, 0)).forEach(([, i]) => pct[i]++);

  // An upright disc facing the viewer, like a coin standing on its edge:
  // angle 0 is 12 o'clock and slices run clockwise. The disc has depth, so
  // its rim shows on the lower right and the hole's wall on the upper left.
  const R = 40 * size, hole = 0.46, depth = 7 * size;
  const cx = x0 + w / 2, cy = top + 22 + R;
  const off = { x: depth * 0.72, y: depth * 0.7 };
  const pt = (k, a, back = false) => ({ x: cx + k * R * Math.sin(a) + (back ? off.x : 0), y: cy - k * R * Math.cos(a) + (back ? off.y : 0) });
  const arcPts = (k, a0, a1, back = false, n = 24) => Array.from({ length: n + 1 }, (_, i) => pt(k, a0 + ((a1 - a0) * i) / n, back));
  // Where a ring's wall faces the viewer: the outer wall where it faces the
  // depth direction, the hole's wall where it faces away from it.
  const facesOut = (a) => Math.sin(a) * off.x - Math.cos(a) * off.y > 0;
  const runs = (a0, a1, want) => {
    const list = [];
    let start = null;
    for (let i = 0; i <= 48; i++) {
      const a = a0 + ((a1 - a0) * i) / 48;
      if (want(a) && start === null) start = a;
      if ((!want(a) || i === 48) && start !== null) { list.push([start, a]); start = null; }
    }
    return list;
  };
  const poly = (list, fill) => `<polygon points="${list.map((p) => `${r1(p.x)},${r1(p.y)}`).join(" ")}" fill="${fill}"/>`;
  let a = 0;
  const slices = parts.map((p, i) => {
    const span = (p.v / sum) * 2 * Math.PI;
    const s = { ...p, i, pct: pct[i], a0: a, a1: a + span, mid: a + span / 2 };
    a += span;
    return s;
  });

  // Materials: each face is lit from the top left; the rim and the hole's
  // wall fall into shade along their length.
  const grads = [];
  const lin = (id, x1, y1, x2, y2, stops) =>
    grads.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}">` +
      stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("") + `</linearGradient>`);
  let sides = "", inner = "", tops = "";
  for (const s of slices) {
    lin(`mixF${s.i}`, cx - R, cy - R, cx + R, cy + R, [[0, adjust(s.colour, 1.22)], [0.5, s.colour], [1, adjust(s.colour, 0.82)]]);
    lin(`mixR${s.i}`, cx - R, cy - R, cx + R + off.x, cy + R + off.y, [[0, adjust(s.colour, 0.72)], [1, adjust(s.colour, 0.42)]]);
    for (const [l, h] of runs(s.a0, s.a1, facesOut)) sides += poly([...arcPts(1, l, h), ...arcPts(1, l, h, true).reverse()], `url(#mixR${s.i})`);
    for (const [l, h] of runs(s.a0, s.a1, (a) => !facesOut(a))) inner += poly([...arcPts(hole, l, h), ...arcPts(hole, l, h, true).reverse()], adjust(s.colour, 0.38));
    tops += poly([...arcPts(1, s.a0, s.a1), ...arcPts(hole, s.a0, s.a1).reverse()], `url(#mixF${s.i})`);
  }
  // Even-width separators between slices, in the background colour, cut
  // through the face and the rim alike.
  const seps = slices.length > 1
    ? slices.map((s) => {
      const p0 = pt(hole, s.a0), p1 = pt(1, s.a0), p2 = pt(1, s.a0, true);
      return `<line x1="${r1(p0.x)}" y1="${r1(p0.y)}" x2="${r1(p1.x)}" y2="${r1(p1.y)}"/>` +
        (facesOut(s.a0) ? `<line x1="${r1(p1.x)}" y1="${r1(p1.y)}" x2="${r1(p2.x)}" y2="${r1(p2.y)}"/>` : "");
    }).join("")
    : "";
  const sepLayer = seps ? `<g stroke="${t.bgOuter}" stroke-width="1.8" stroke-linecap="round">${seps}</g>` : "";
  // A glossy highlight along the top-left of the outer edge, a soft shadow
  // inside the hole, and a contact shadow beneath the pie.
  const rimLight = `<path d="M${r1(pt(1.0, -1.25).x)},${r1(pt(1.0, -1.25).y)} A${r1(R)},${r1(R)} 0 0,1 ${r1(pt(1.0, 0.35).x)},${r1(pt(1.0, 0.35).y)}" fill="none" stroke="url(#mixRim)" stroke-width="1.6" stroke-linecap="round"/>`;
  const holeShade = `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(R * hole)}" fill="url(#mixHoleShade)"/>`;
  const ground = `<ellipse cx="${r1(cx + off.x)}" cy="${r1(cy + R + off.y + 4)}" rx="${r1(R * 0.88)}" ry="${r1(R * 0.12)}" fill="${t.shadow}" opacity="${t.dark ? ".55" : ".22"}" filter="url(#soft4)"/>`;
  const gloss = sum ? `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(R)}" fill="url(#mixGloss)"/>` : "";
  const track = sum ? "" : poly([...arcPts(1, 0, 2 * Math.PI, false, 48), ...arcPts(hole, 0, 2 * Math.PI, false, 48).reverse()], t.mixTrack);

  // Labels: slices on the right half label to the right, the rest to the
  // left, spread so they never overlap.
  const labelFor = (s, side, ly) => {
    const edge = pt(1.04, s.mid, facesOut(s.mid));
    const lx = side > 0 ? cx + R + 36 : cx - R - 36;
    return `<polyline points="${r1(edge.x)},${r1(edge.y)} ${r1(lx - side * 10)},${r1(ly - 4)} ${r1(lx)},${r1(ly - 4)}" fill="none" stroke="${s.colour}" stroke-width=".9" stroke-opacity=".9" stroke-linejoin="round"/>` +
      `<circle cx="${r1(edge.x)}" cy="${r1(edge.y)}" r="2.6" fill="${t.bgOuter}" stroke="${s.colour}" stroke-width="1.3"/>` +
      `<circle cx="${r1(lx)}" cy="${r1(ly - 4)}" r="1.4" fill="${s.colour}"/>` +
      `<text x="${r1(lx + side * 6)}" y="${r1(ly)}" text-anchor="${side > 0 ? "start" : "end"}" font-size="12" letter-spacing=".1" fill="${t.mute}" paint-order="stroke" stroke="${t.bgOuter}" stroke-width="3" stroke-linejoin="round"><tspan fill="${t.ink}" font-size="13" font-weight="700">${s.pct}%</tspan> ${esc(s.label)}</text>`;
  };
  const place = (list, side) => {
    list.sort((p, q) => pt(1, p.mid).y - pt(1, q.mid).y);
    const step = 18, first = cy - ((list.length - 1) * step) / 2 + 8;
    return list.map((s, i) => labelFor(s, side, first + i * step)).join("");
  };
  const right = slices.filter((s) => Math.sin(s.mid) >= 0), left = slices.filter((s) => Math.sin(s.mid) < 0);
  const labels = sum ? place(right, 1) + place(left, -1) : `<text x="${r1(cx + R + 22)}" y="${cy + 4}" font-size="11" fill="${t.mute}">No activity yet</text>`;

  return `<text x="${x0 + w / 2}" y="${top}" text-anchor="middle" font-size="12" font-weight="600" letter-spacing=".4" fill="${t.mute}">Contribution mix · last 12 months</text>
  <defs>${grads.join("")}
  <radialGradient id="mixGloss" cx="34%" cy="26%" r="78%"><stop offset="0" stop-color="#ffffff" stop-opacity=".26"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".04"/><stop offset=".75" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  <radialGradient id="mixHoleShade" r="50%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${t.dark ? ".55" : ".22"}"/></radialGradient>
  <linearGradient id="mixRim" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".75"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
  <mask id="mixHole"><rect x="${r1(cx - R - 2)}" y="${r1(cy - R - 2)}" width="${r1(2 * R + 4)}" height="${r1(2 * R + 4)}" fill="#fff"/><circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(R * hole)}" fill="#000"/></mask></defs>
  ${ground}${sides}${inner}${tops}<g mask="url(#mixHole)">${gloss}</g>${sum ? holeShade + sepLayer + rimLight : ""}${track}${labels}`;
}

// Top left: the contribution mix as a free-standing small 3D pie, with its
// title above it.
function mixCorner(data, t) {
  return mixPie(data, t, 40, 440, 62, 1.45);
}

// Bottom-right card: the year's colour wheel and the peak day.
function legend(stats, t) {
  const w = 340, h = 128, x = W - 40 - w, y = H - 28 - h;
  // The year's colour wheel as a row of small wedge tops, oldest month first.
  let ramp = "";
  t.wheel.forEach((color, i) => {
    const cx = x + 40 + i * 24, cy = y + 66;
    ramp += `<path d="M${cx - 9},${cy + 9} L${cx + 9},${cy + 9} L${cx + 9},${cy - 3 - i * 2} L${cx - 9},${cy - 3 - i * 2} Z" fill="${adjust(color, 0.8)}"/>` +
      `<path d="M${cx - 9},${cy - 3 - i * 2} L${cx - 3},${cy - 8 - i * 2} L${cx + 13},${cy - 8 - i * 2} L${cx + 9},${cy - 3 - i * 2} Z" fill="${adjust(color, 1.2)}"/>` +
      `<path d="M${cx + 9},${cy + 9} L${cx + 13},${cy + 4} L${cx + 13},${cy - 8 - i * 2} L${cx + 9},${cy - 3 - i * 2} Z" fill="${adjust(color, 0.6)}"/>`;
  });

  const px = x + 196;
  const peak = stats.peak.date
    ? `<text x="${px}" y="${y + 70}" font-size="20" font-weight="700" fill="${t.ink}">${esc(shortDate(stats.peak.date))}</text>
  <text x="${px}" y="${y + 88}" font-size="11" fill="${t.mute}">${stats.max} contributions</text>`
    : `<text x="${px}" y="${y + 70}" font-size="12" fill="${t.mute}">No activity yet</text>`;

  return `<g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="url(#glassFill)" stroke="url(#glassEdge)" stroke-width="1"/>
  <text x="${x + 28}" y="${y + 28}" font-size="11" fill="${t.mute}">Month wedges</text>
  ${ramp}
  <text x="${x + 28}" y="${y + 96}" font-size="10" fill="${t.mute}" opacity=".8">oldest</text>
  <text x="${x + 168}" y="${y + 96}" font-size="10" fill="${t.mute}" opacity=".8" text-anchor="end">latest</text>
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
  // The pie is seen straight on from above the front, so the year reads
  // clockwise like a clock face.
  const project = makeProjector({ yawDeg: 0, pitchDeg: 30, cx: OCX, cy: OCY });
  const year = pie({ data, t, project, animate });
  const orbit = orbits(data, t, animate, year.blockers);
  const label = `${data.name}: ${stats.total} contributions, longest streak ${stats.longest} days`;
  const desc =
    `3D contribution pie for @${data.login}: ${stats.total} contributions over ${stats.activeDays} active days, ` +
    `current streak ${stats.current} days, longest streak ${stats.longest} days` +
    (stats.peak.date ? `, busiest day ${stats.peak.date} with ${stats.max} contributions.` : ".");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}" font-family="${FONT_STACK}" text-rendering="geometricPrecision">
<title>${esc(label)}</title>
<desc>${esc(desc)}</desc>
<defs>
  <radialGradient id="bg" cx="62%" cy="58%" r="85%"><stop offset="0" stop-color="${t.bgInner}"/><stop offset=".55" stop-color="${t.bgMid}"/><stop offset="1" stop-color="${t.bgOuter}"/></radialGradient>
  <radialGradient id="nebA"><stop offset="0" stop-color="${t.nebulaA}" stop-opacity="${t.dark ? 0.28 : 0.6}"/><stop offset="1" stop-color="${t.nebulaA}" stop-opacity="0"/></radialGradient>
  <radialGradient id="nebB"><stop offset="0" stop-color="${t.nebulaB}" stop-opacity="${t.dark ? 0.22 : 0.55}"/><stop offset="1" stop-color="${t.nebulaB}" stop-opacity="0"/></radialGradient>
  <linearGradient id="glassFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${t.dark ? 0.09 : 1}"/><stop offset="1" stop-color="#fff" stop-opacity="${t.dark ? 0.03 : 0.97}"/></linearGradient>
  <linearGradient id="glassEdge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.borderA}" stop-opacity="${t.dark ? 0.35 : 0.9}"/><stop offset="1" stop-color="${t.borderB}" stop-opacity="${t.dark ? 0.35 : 0.9}"/></linearGradient>
  <linearGradient id="ringFade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.ring}" stop-opacity=".4"/><stop offset=".5" stop-color="${t.ring}" stop-opacity=".95"/><stop offset="1" stop-color="${t.ring}" stop-opacity=".4"/></linearGradient>
  <linearGradient id="plTerm" x1=".15" y1=".1" x2=".95" y2=".95"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></linearGradient>
  <radialGradient id="plSpec"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <filter id="soft4" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="3"/></filter>
  ${orbit.defs}
  ${year.defs}
  <radialGradient id="floorGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${t.glow}" stop-opacity="${t.dark ? 0.25 : 0.06}"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>
  <filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="soft" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="12"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${nebula()}
${t.stars ? stars(animate) : ""}
<ellipse cx="${OCX}" cy="${OCY + 40}" rx="520" ry="200" fill="url(#floorGlow)"/>
${orbit.back}
${year.scene}
${orbit.front}
${year.peakLabel}
${orbit.labels}
${mixCorner(data, t)}
${legend(stats, t)}
</svg>
`;
}
