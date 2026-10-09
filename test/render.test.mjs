import test from "node:test";
import assert from "node:assert/strict";
import { renderSvg } from "../src/render.mjs";
import { sampleData } from "../src/sample.mjs";
import { themes } from "../src/themes.mjs";

for (const theme of Object.keys(themes)) {
  test(`renders a clean SVG for theme ${theme}`, () => {
    const svg = renderSvg(sampleData(), { theme });
    assert.match(svg, /^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.ok(svg.trimEnd().endsWith("</svg>"));
    assert.ok(!/NaN|undefined|Infinity/.test(svg), "no invalid numbers or undefined values");
    assert.ok(svg.length < 600_000, "stays comfortably small for a README");
    assert.match(svg, new RegExp(`stroke="${themes[theme].cellEdge}"`), "terrain uses visible cell edges");
  });
}

test("output is deterministic", () => {
  assert.equal(renderSvg(sampleData()), renderSvg(sampleData()));
});

test("hostile names and colours cannot inject markup", () => {
  const data = sampleData();
  data.name = `<script>alert(1)</script>"&`;
  data.repos[0].name = `"><img src=x onerror=alert(1)>`;
  data.repos[0].color = `red" onload="alert(1)`;
  const svg = renderSvg(data);
  assert.ok(!svg.includes("<script"));
  assert.ok(!svg.includes("<img"));
  assert.ok(!svg.includes('onload="alert'));
});

test("static mode has no animation elements", () => {
  assert.ok(!renderSvg(sampleData(), { animate: false }).includes("<animateMotion"));
  assert.ok(renderSvg(sampleData(), { animate: true }).includes("<animateMotion"));
});

test("unknown theme gives a clear error", () => {
  assert.throws(() => renderSvg(sampleData(), { theme: "nope" }), /Unknown theme/);
});

test("includes an accessible title and description", () => {
  const svg = renderSvg(sampleData());
  assert.match(svg, /<title>Ada Example: \d+ contributions/);
  assert.match(svg, /<desc>3D contribution terrain for @ada-example/);
});

test("labels months along the plate and marks the peak day", () => {
  const svg = renderSvg(sampleData());
  for (const m of ["Jan", "Jun", "Sep"]) assert.ok(svg.includes(`>${m}</text>`), `month ${m} labelled`);
  assert.ok(svg.includes("Jun 3 · 29"), "peak callout uses a short date and the count");
});

test("animated planets are split into far and near layers around the terrain", () => {
  const svg = renderSvg(sampleData(), { animate: true });
  const far = svg.indexOf('id="farPlanets"');
  const near = svg.indexOf('id="nearPlanets"');
  const plate = svg.indexOf('fill="url(#plateFill)"');
  assert.ok(far > 0 && far < plate, "far side is drawn before the terrain");
  assert.ok(near > plate, "near side is drawn after the terrain");
});

test("an empty calendar renders without a peak beacon or invalid numbers", () => {
  const data = sampleData();
  data.weeks = data.weeks.map((w) => w.map((d) => ({ ...d, count: 0 })));
  const svg = renderSvg(data);
  assert.ok(!/NaN|undefined|Infinity/.test(svg));
  assert.ok(!svg.includes('id="beam"'));
  assert.ok(svg.includes("No activity yet"));
});

test("planets are lit spheres coloured from the theme's neon palette", () => {
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

test("planet names show in clear sky on both sides of the orbit, never over the terrain", () => {
  const data = sampleData();
  const svg = renderSvg(data, { animate: true });
  const layer = svg.slice(svg.indexOf('id="planetLabels"'));
  assert.ok(svg.indexOf('id="planetLabels"') > svg.indexOf('id="nearPlanets"'), "names sit above the planets");
  assert.equal([...layer.matchAll(/>infra-modules</g)].length, 1, "one name per planet");
  const anims = [...layer.matchAll(/attributeName="visibility" values="([^"]+)" keyTimes="([^"]+)"/g)];
  assert.ok(anims.length > 0, "names switch visibility as planets pass the terrain");
  for (const [, values, times] of anims) {
    assert.equal(values.split(";")[0], "visible", "every name starts visible on the near side");
    const v = values.split(";"), k = times.split(";").map(Number);
    const firstHidden = k[v.indexOf("hidden")];
    assert.ok(firstHidden === undefined || firstHidden >= 0.5, "names are only hidden on the far side");
  }
  const farVisible = anims.some(([, values, times]) => values.split(";").some((v, i) => v === "visible" && Number(times.split(";")[i]) >= 0.5)) ||
    anims.length < data.repos.length;
  assert.ok(farVisible, "at least one name stays visible on part of the far side");
});

test("night theme outlines bar tops in a lighter tint of their own colour", () => {
  const svg = renderSvg(sampleData(), { theme: "aurora", animate: false });
  assert.ok(themes.aurora.neonEdges);
  assert.ok(!svg.includes(`stroke="${themes.aurora.cellEdge}" stroke-width=".6" stroke-opacity=".62"`), "bar tops no longer use the flat cell edge");
  assert.match(svg, /stroke-width="1" stroke-opacity="\.95"/);
});

test("each planet switches depth layers as a whole, so labels are never cut in two", () => {
  const svg = renderSvg(sampleData(), { animate: true });
  assert.ok(!svg.includes("clip-path=\"url(#farSide)\"") && !svg.includes("clip-path=\"url(#nearSide)\""), "no half-scene clipping");
  const n = sampleData().repos.length;
  assert.equal(svg.split('values="visible;hidden" keyTimes="0;0.5" calcMode="discrete"').length - 1, n, "near copies show on the near half");
  assert.equal(svg.split('values="hidden;visible" keyTimes="0;0.5" calcMode="discrete"').length - 1, n, "far copies show on the far half");
});

test("day theme is clean white with pink and green borders", () => {
  const t = themes.daylight;
  assert.deepEqual([t.bgInner, t.bgMid, t.bgOuter, t.plateTop], ["#ffffff", "#ffffff", "#ffffff", "#ffffff"]);
  const svg = renderSvg(sampleData(), { theme: "daylight", animate: false });
  assert.match(svg, new RegExp(`id="glassEdge"[^>]*><stop offset="0" stop-color="${t.borderA}"[^>]*/><stop offset="1" stop-color="${t.borderB}"`));
  assert.match(svg, new RegExp(`fill="url\\(#plateFill\\)" stroke="${t.plateEdge}"`));
});

test("a colour wave rolls across the grid in animated mode only", () => {
  const data = sampleData();
  for (const theme of ["aurora", "daylight"]) {
    const t = themes[theme];
    const svg = renderSvg(data, { theme, animate: true });
    const strips = svg.split(`values="${t.wave.join(";")}" calcMode="discrete"`).length - 1;
    assert.equal(strips, data.weeks.length, `${theme}: one wave strip per week`);
    assert.ok(svg.indexOf(`values="${t.wave.join(";")}"`) < svg.indexOf('id="nearPlanets"'), "the wave sits under the near planets");
    assert.ok(!renderSvg(data, { theme, animate: false }).includes(t.wave.join(";")), `${theme}: static mode has no wave`);
  }
});

test("the plate has glowing pink and green neon-tube edges in both themes", () => {
  for (const theme of ["aurora", "daylight"]) {
    const t = themes[theme];
    const svg = renderSvg(sampleData(), { theme, animate: false });
    for (const c of [t.edgeBack, t.edgeFront]) {
      assert.match(svg, new RegExp(`stroke="${c}" stroke-width="2.6"[^>]*filter="url\\(#neon\\)"`), `${theme}: ${c} tube`);
    }
  }
  assert.match(renderSvg(sampleData(), { theme: "daylight" }), /stroke="url\(#glassEdge\)" stroke-width="2" filter="url\(#neon\)"/, "day cards glow");
});

test("day and night themes share one neon palette", () => {
  const { aurora: a, daylight: d } = themes;
  assert.deepEqual(d.ramp.slice(1), a.ramp.slice(1), "activity levels");
  for (const k of ["peak", "planets", "wave", "edgeBack", "edgeFront", "ring", "glow"]) assert.deepEqual(d[k], a[k], k);
});
