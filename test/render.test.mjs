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
  const far = svg.indexOf('clip-path="url(#farSide)"');
  const near = svg.indexOf('clip-path="url(#nearSide)"');
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

test("planets are lit spheres, and repos without a language colour get a palette colour", () => {
  const data = sampleData();
  data.repos[1].color = null;
  const svg = renderSvg(data, { theme: "aurora" });
  assert.ok(svg.includes('id="pl0b"') && svg.includes('id="pl0c"'), "per-planet gradient and clip");
  assert.ok(svg.includes('fill="url(#plTerm)"') && svg.includes('fill="url(#plSpec)"'), "terminator and specular");
  assert.ok(themes.aurora.planets.some((c) => svg.includes(`stop-color="${c}"`)), "fallback colour from the theme palette");
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
