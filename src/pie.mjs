// The year as a 3D pie: a ring of month wedges standing on a floating disc,
// with a glowing core in the middle. Each wedge spans its month's share of the
// year (partial months at either end are thinner) and rises in height with
// that month's contributions. Planets orbit the whole thing.

const r1 = (n) => Math.round(n * 10) / 10;
const pts = (list) => list.map((p) => `${r1(p.x)},${r1(p.y)}`).join(" ");
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function adjust(hex, k) {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const out = ch.map((v) => (k >= 1 ? v + (255 - v) * (k - 1) : v * k));
  return "#" + out.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function mix(a, b, k) {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + ca.map((v, i) => Math.round(v + (cb[i] - v) * k).toString(16).padStart(2, "0")).join("");
}
// Colour at f (0..1) along a list of stops.
function along(stops, f) {
  const x = Math.max(0, Math.min(1, f)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}

export const PIE = { R: 236, r: 92, base: 22, depth: 16, maxH: 175, minH: 10 };

// Group the calendar into calendar months, oldest first.
export function monthBuckets(weeks) {
  const list = [];
  for (const day of weeks.flat()) {
    const key = String(day.date || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) continue;
    let m = list[list.length - 1];
    if (!m || m.key !== key) list.push((m = { key, days: 0, total: 0 }));
    m.days++;
    m.total += Math.max(0, Number(day.count) || 0);
  }
  return list.map((m) => ({ ...m, label: MONTHS[Number(m.key.slice(5)) - 1] || "" }));
}

export function pie({ data, t, project, animate }) {
  const { R, r, base, depth, maxH, minH } = PIE;
  const months = monthBuckets(data.weeks);
  const totalDays = months.reduce((s, m) => s + m.days, 0) || 1;
  const top = Math.max(1, ...months.map((m) => m.total));
  const peak = months.reduce((best, m) => (m.total > (best?.total ?? 0) ? m : best), null);

  // World point on the ring: angle 0 is the back (top of the image) and the
  // year runs clockwise as seen from above.
  const P = (rho, a, h = 0) => project(rho * Math.sin(a), -rho * Math.cos(a), h);
  const view = (nu, nv) => project.facing(nu, nv) > 1e-6;
  const lightDir = [-0.5, 0.85];
  const lit = (nu, nv) => 0.5 + 0.42 * Math.max(0, (nu * lightDir[0] + nv * lightDir[1]) / Math.hypot(...lightDir));

  // Floating base disc.
  const ring = (rho, h, n = 96) => Array.from({ length: n }, (_, k) => P(rho, (2 * Math.PI * k) / n, h));
  const discTop = ring(R + base, 0);
  const discBottom = ring(R + base, -depth);
  // The disc's near-side band: from the left extreme round the front to the right.
  const band = [];
  for (let k = 0; k <= 48; k++) band.push(P(R + base, Math.PI / 2 + (Math.PI * k) / 48, 0));
  for (let k = 48; k >= 0; k--) band.push(P(R + base, Math.PI / 2 + (Math.PI * k) / 48, -depth));
  const disc =
    `<polygon points="${pts(discBottom.map((p) => ({ x: p.x + 4, y: p.y + 18 })))}" fill="${t.shadow}" opacity="${t.dark ? ".7" : ".18"}" filter="url(#soft)"/>` +
    `<polygon points="${pts(band)}" fill="url(#discSide)"/>` +
    `<polygon points="${pts(discTop)}" fill="url(#discTop)" stroke="${t.discEdge}" stroke-width="1.2" stroke-opacity=".9"/>` +
    `<polygon points="${pts(ring(r - 10, 0, 64))}" fill="${t.dark ? "#000" : adjust(t.discTop, 0.94)}" opacity="${t.dark ? ".35" : ".6"}"/>`;

  // Wedges, cut into narrow segments so the painter's sort stays exact.
  const gap = 0.014;
  const segs = [];
  let start = 0;
  months.forEach((m, i) => {
    const a0 = (start / totalDays) * 2 * Math.PI + gap, a1 = ((start + m.days) / totalDays) * 2 * Math.PI - gap;
    start += m.days;
    if (a1 <= a0) return;
    const h = m.total ? minH + (m.total / top) * (maxH - minH) : 3;
    const colour = m.total ? along(t.wheel, i / Math.max(1, months.length - 1)) : t.emptyWedge;
    const n = Math.max(2, Math.round((a1 - a0) / 0.09));
    for (let k = 0; k < n; k++) {
      const b0 = a0 + ((a1 - a0) * k) / n, b1 = a0 + ((a1 - a0) * (k + 1)) / n;
      segs.push({ m, i, b0, b1, h, colour, first: k === 0, last: k === n - 1, mid: (b0 + b1) / 2 });
    }
    m.mid = (a0 + a1) / 2;
    m.h = h;
    m.colour = colour;
  });

  // Each face gets a hairline stroke in its own colour, so neighbouring
  // segments of a wedge join without a visible seam.
  const face = (list, fill, extra = "") => `<polygon points="${pts(list)}" fill="${fill}" stroke="${fill}" stroke-width=".7" stroke-linejoin="round"${extra}/>`;
  const drawSeg = (s) => {
    const { b0, b1, h, colour, mid } = s;
    let out = "";
    const inner = [-Math.sin(mid), Math.cos(mid)];
    const outer = [Math.sin(mid), -Math.cos(mid)];
    if (view(...inner)) out += face([P(r, b0), P(r, b1), P(r, b1, h), P(r, b0, h)], adjust(colour, lit(...inner) * 0.85));
    if (s.first) {
      const n = [-Math.cos(b0), -Math.sin(b0)];
      if (view(...n)) out += face([P(r, b0), P(R, b0), P(R, b0, h), P(r, b0, h)], adjust(colour, lit(...n)));
    }
    if (s.last) {
      const n = [Math.cos(b1), Math.sin(b1)];
      if (view(...n)) out += face([P(r, b1), P(R, b1), P(R, b1, h), P(r, b1, h)], adjust(colour, lit(...n)));
    }
    if (view(...outer)) out += face([P(R, b0), P(R, b1), P(R, b1, h), P(R, b0, h)], adjust(colour, lit(...outer)));
    return out;
  };
  // A wedge's top is one smooth shape with a light rim and its month name.
  const arc = (m, rho, h, rev) => {
    const list = [];
    for (let k = 0; k <= 24; k++) list.push(P(rho, m.a0 + ((m.a1 - m.a0) * k) / 24, h));
    return rev ? list.reverse() : list;
  };
  const topOf = (m) => {
    const outline = [...arc(m, R, m.h), ...arc(m, r, m.h, true)];
    const isPeak = m === peak;
    const shade = t.dark ? 1.08 : 1.12;
    let out = `<polygon points="${pts(outline)}" fill="${adjust(m.colour, shade)}"/>` +
      `<polygon points="${pts([...outline, outline[0]])}" fill="none" stroke="${isPeak ? t.peak : mix(m.colour, "#ffffff", 0.6)}" stroke-width="${isPeak ? 2 : 1}" stroke-linejoin="round"${isPeak ? ` filter="url(#glow)"` : ""}/>`;
    if (m.days >= 12) {
      const p = P((R + r) / 2 + 6, m.mid, m.h);
      out += `<text x="${r1(p.x)}" y="${r1(p.y + 4)}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#ffffff" fill-opacity=".95" paint-order="stroke" stroke="${adjust(m.colour, 0.55)}" stroke-width="2.4" stroke-linejoin="round">${m.label}</text>`;
    }
    return out;
  };
  start = 0;
  for (const m of months) {
    m.a0 = (start / totalDays) * 2 * Math.PI + gap;
    m.a1 = ((start + m.days) / totalDays) * 2 * Math.PI - gap;
    start += m.days;
  }

  const depthOf = (s) => P((R + r) / 2, s.mid).depth;
  segs.sort((a, b) => depthOf(a) - depthOf(b));
  // Each month's top is drawn with its nearest segment, the last of that
  // month to be painted.
  const nearest = new Map();
  for (const s of segs) nearest.set(s.m, s);
  let back = "", front = "";
  for (const s of segs) {
    const svg = drawSeg(s) + (nearest.get(s.m) === s ? topOf(s.m) : "");
    if (depthOf(s) < 0) back += svg;
    else front += svg;
  }

  // The core: a small glowing star in the ring's hole.
  const c = project(0, 0, 46);
  const core =
    `<ellipse cx="${r1(project(0, 0, 0).x)}" cy="${r1(project(0, 0, 0).y)}" rx="${r1(r * 0.8)}" ry="${r1(r * 0.8 * 0.5)}" fill="url(#coreGlow)" opacity=".8"/>` +
    `<circle cx="${r1(c.x)}" cy="${r1(c.y)}" r="64" fill="url(#coreHalo)"/>` +
    `<circle cx="${r1(c.x)}" cy="${r1(c.y)}" r="30" fill="url(#coreBody)">` +
    (animate ? `<animate attributeName="r" values="30;32;30" dur="4s" repeatCount="indefinite"/>` : "") +
    `</circle>`;

  // Peak month: a gold rim and a label above it.
  let peakLabel = "";
  if (peak && peak.total) {
    // The label floats in clear sky above the whole pie, joined to the peak
    // wedge by a fine line.
    const tip = P(R - 18, peak.mid, peak.h);
    const highest = Math.min(...months.filter((m) => m.h !== undefined).map((m) => P(R, m.mid, m.h).y, P(r, Math.PI, 0).y));
    const y1 = Math.max(46, Math.min(tip.y - 40, highest - 34));
    const label = `${peak.label} · ${peak.total.toLocaleString("en-US")}`;
    const w = 26 + label.length * 6.6;
    peakLabel = `<g>
  <line x1="${r1(tip.x)}" y1="${r1(tip.y - 2)}" x2="${r1(tip.x)}" y2="${r1(y1)}" stroke="${t.peak}" stroke-width="1.4" stroke-opacity=".8"/>
  <circle cx="${r1(tip.x)}" cy="${r1(tip.y - 2)}" r="3" fill="${t.peak}" filter="url(#glow)"/>
  <rect x="${r1(tip.x - 11)}" y="${r1(y1 - 20)}" width="${r1(w)}" height="20" rx="10" fill="${t.bgOuter}" fill-opacity=".78" stroke="${t.peak}" stroke-opacity=".6"/>
  <circle cx="${r1(tip.x)}" cy="${r1(y1 - 10)}" r="3" fill="${t.peak}"/>
  <text x="${r1(tip.x + 8)}" y="${r1(y1 - 6)}" font-size="11" font-weight="600" fill="${t.ink}">${esc(label)}</text>
</g>`;
  }

  // Shapes the planet labels must keep clear of on the far side.
  const outline = [...ring(R + base, 0, 48)];
  const boxes = segs.map((s) => {
    const list = [P(R, s.b0), P(R, s.b1), P(r, s.b0), P(r, s.b1), P(R, s.b0, s.h), P(R, s.b1, s.h), P(r, s.b0, s.h), P(r, s.b1, s.h)];
    return { x0: Math.min(...list.map((q) => q.x)), x1: Math.max(...list.map((q) => q.x)), y0: Math.min(...list.map((q) => q.y)), y1: Math.max(...list.map((q) => q.y)) };
  });

  const defs = `<linearGradient id="discTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${adjust(t.discTop, t.dark ? 1.25 : 1)}"/><stop offset="1" stop-color="${adjust(t.discTop, t.dark ? 0.8 : 0.96)}"/></linearGradient>
  <linearGradient id="discSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${adjust(t.discSide, t.dark ? 1.4 : 1)}"/><stop offset="1" stop-color="${adjust(t.discSide, 0.7)}"/></linearGradient>
  <radialGradient id="coreBody" cx="40%" cy="38%" r="60%"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="${t.core}"/><stop offset="1" stop-color="${adjust(t.core, 0.55)}"/></radialGradient>
  <radialGradient id="coreHalo"><stop offset=".3" stop-color="${t.core}" stop-opacity=".55"/><stop offset="1" stop-color="${t.core}" stop-opacity="0"/></radialGradient>
  <radialGradient id="coreGlow"><stop offset="0" stop-color="${t.core}" stop-opacity=".6"/><stop offset="1" stop-color="${t.core}" stop-opacity="0"/></radialGradient>`;

  return {
    defs,
    scene: disc + back + core + front,
    peakLabel,
    blockers: { plate: outline, boxes },
    months,
  };
}
