import test from "node:test";
import assert from "node:assert/strict";
import { renderSvg } from "../src/render.mjs";
import { sampleData } from "../src/sample.mjs";
import { themes } from "../src/themes.mjs";
import { monthBuckets } from "../src/pie.mjs";

for (const theme of Object.keys(themes)) {
  test(`renders a clean SVG for theme ${theme}`, () => {
    const svg = renderSvg(sampleData(), { theme });
    assert.match(svg, /^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.ok(svg.trimEnd().endsWith("</svg>"));
    assert.ok(!/NaN|undefined|Infinity/.test(svg), "no invalid numbers or undefined values");
    assert.ok(svg.length < 600_000, "stays comfortably small for a README");
    const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, "every id is unique");
  });
}

test("output is deterministic", () => {
  assert.equal(renderSvg(sampleData()), renderSvg(sampleData()));
});

test("hostile names and colours cannot inject markup", () => {
  const data = sampleData();
  data.name = `<script>alert(1)</script>"&`;
  data.login = `x"><img src=x>`;
  data.repos[0].name = `"><img src=x onerror=alert(1)>`;
  data.repos[0].color = `red" onload="alert(1)`;
  const svg = renderSvg(data);
  assert.ok(!svg.includes("<script"));
  assert.ok(!svg.includes("<img"));
  assert.ok(!svg.includes('onload="alert'));
});

test("static mode has no animation elements", () => {
  assert.ok(!/<animate/.test(renderSvg(sampleData(), { animate: false })));
  assert.ok(renderSvg(sampleData(), { animate: true }).includes("<animateMotion"));
});

test("unknown theme gives a clear error", () => {
  assert.throws(() => renderSvg(sampleData(), { theme: "nope" }), /Unknown theme/);
});

test("includes an accessible title and description", () => {
  const svg = renderSvg(sampleData());
  assert.match(svg, /<title>Ada Example: \d+ contributions/);
  assert.match(svg, /<desc>3D contribution pie for @ada-example/);
});

test("the big pie has one labelled wedge per month and flags the busiest month", () => {
  const data = sampleData();
  const svg = renderSvg(data, { animate: false });
  const months = monthBuckets(data.weeks);
  for (const m of months.filter((m) => m.days >= 12)) assert.ok(svg.includes(`>${m.label}</text>`), `${m.label} wedge is labelled`);
  const peak = months.reduce((a, b) => (b.total > a.total ? b : a));
  assert.ok(svg.includes(`${peak.label} · ${peak.total.toLocaleString("en-US")}`), "the busiest month carries a label");
});

test("months are grouped by calendar month with their days and totals", () => {
  const weeks = [[
    { date: "2026-01-30", count: 2 }, { date: "2026-01-31", count: 3 },
    { date: "2026-02-01", count: 4 }, { date: "bad", count: 9 }, { date: "2026-02-02", count: -1 },
  ]];
  assert.deepEqual(monthBuckets(weeks).map(({ key, days, total, label }) => ({ key, days, total, label })), [
    { key: "2026-01", days: 2, total: 5, label: "Jan" },
    { key: "2026-02", days: 2, total: 4, label: "Feb" },
  ]);
});

test("the corner pie shows only commits, pull requests, issues and code review, with shares adding to 100", () => {
  const data = sampleData();
  const svg = renderSvg(data, { animate: false });
  const shares = [...svg.matchAll(/font-weight="700">(\d+)%<\/tspan> (Commits|Pull requests|Issues|Code review)</g)];
  assert.deepEqual(shares.map((m) => m[2]).sort(), ["Code review", "Commits", "Issues", "Pull requests"]);
  assert.equal(shares.reduce((s, m) => s + Number(m[1]), 0), 100);
  assert.ok(!svg.includes("% Other") && !svg.includes("</tspan> Other<"), "no Other slice");
  assert.ok(svg.includes('mask="url(#mixHole)"'), "the upright pie keeps a clear hole");
});

test("odd or missing mix values cannot break the corner pie", () => {
  const data = sampleData();
  data.mix = { commits: "12", pullRequests: -4, issues: null, reviews: "x" };
  const svg = renderSvg(data);
  assert.ok(!/NaN|undefined|Infinity/.test(svg));
  assert.ok(svg.includes(">100%</tspan> Commits<"));
  delete data.mix;
  assert.ok(renderSvg(data).includes("No activity yet"), "no mix data reads as no activity");
});

test("an empty calendar renders without a month label or invalid numbers", () => {
  const data = sampleData();
  data.weeks = data.weeks.map((w) => w.map((d) => ({ ...d, count: 0 })));
  data.mix = { commits: 0, pullRequests: 0, issues: 0, reviews: 0 };
  const svg = renderSvg(data);
  assert.ok(!/NaN|undefined|Infinity/.test(svg));
  assert.ok(!svg.includes(" · 0<"), "no busiest-month label");
  assert.ok(svg.includes("No activity yet"));
});

test("animated planets are split into far and near layers around the pie", () => {
  const svg = renderSvg(sampleData(), { animate: true });
  const far = svg.indexOf('id="farPlanets"');
  const near = svg.indexOf('id="nearPlanets"');
  const disc = svg.indexOf('fill="url(#discTop)"');
  assert.ok(far > 0 && far < disc, "far side is drawn before the pie");
  assert.ok(near > disc, "near side is drawn after the pie");
});

test("planets are lit spheres coloured from the theme's planet palette", () => {
  const data = sampleData();
  const svg = renderSvg(data, { theme: "aurora" });
  assert.ok(svg.includes('id="pl0b"') && svg.includes('id="pl0c"'), "per-planet gradient and clip");
  assert.ok(svg.includes('fill="url(#plTerm)"') && svg.includes('fill="url(#plSpec)"'), "terminator and specular");
  data.repos.forEach((r, i) => {
    assert.ok(svg.includes(`stop-color="${themes.aurora.planets[i % themes.aurora.planets.length]}"`), `planet ${i} uses the palette`);
    assert.ok(!svg.includes(`stop-color="${r.color}"`), `planet ${i} ignores the language colour`);
  });
});

test("unexpected repo values cannot break the geometry or the render", () => {
  const data = sampleData();
  data.repos[0].stars = `1" onload="x`;
  data.repos[1].name = null;
  data.repos[2].stars = -5;
  const svg = renderSvg(data);
  assert.ok(!/NaN|undefined|Infinity/.test(svg));
  assert.ok(!svg.includes("onload"));
});

test("planet names sit above the planets and are only hidden on the far side", () => {
  const data = sampleData();
  const svg = renderSvg(data, { animate: true });
  const layer = svg.slice(svg.indexOf('id="planetLabels"'));
  assert.ok(svg.indexOf('id="planetLabels"') > svg.indexOf('id="nearPlanets"'), "names sit above the planets");
  assert.equal([...layer.matchAll(/>infra-modules</g)].length, 1, "one name per planet");
  for (const [, values, times] of layer.matchAll(/attributeName="visibility" values="([^"]+)" keyTimes="([^"]+)"/g)) {
    const v = values.split(";"), k = times.split(";").map(Number);
    assert.equal(v[0], "visible", "every name starts visible on the near side");
    const firstHidden = k[v.indexOf("hidden")];
    assert.ok(firstHidden === undefined || firstHidden >= 0.5, "names are only hidden on the far side");
  }
});

test("each planet switches depth layers as a whole", () => {
  const svg = renderSvg(sampleData(), { animate: true });
  const n = sampleData().repos.length;
  assert.equal(svg.split('values="visible;hidden" keyTimes="0;0.5" calcMode="discrete"').length - 1, n, "near copies show on the near half");
  assert.equal(svg.split('values="hidden;visible" keyTimes="0;0.5" calcMode="discrete"').length - 1, n, "far copies show on the far half");
});

test("the bottom-right card keeps the month colours and the peak day; there is no top-left card", () => {
  const svg = renderSvg(sampleData(), { animate: false });
  assert.ok(svg.includes(">Month wedges<") && svg.includes(">Peak day<") && svg.includes(">Jun 3<"));
  assert.ok(!svg.includes("CONTRIBUTION OBSERVATORY") && !svg.includes("longest streak<"), "no top-left card or headline numbers");
});

test("night and day share the year's colour wheel shape and the contribution-mix colours", () => {
  const { aurora: a, daylight: d } = themes;
  assert.equal(a.wheel.length, d.wheel.length);
  assert.deepEqual(a.mix, d.mix);
  assert.equal(a.mix.length, 4);
});

test("profile workflows that check the SVG for the headline stats keep passing", () => {
  const svg = renderSvg(sampleData());
  for (const s of ["@ada-example", "contributions", "active days", "current streak", "longest streak"]) assert.ok(svg.includes(s), s);
});
