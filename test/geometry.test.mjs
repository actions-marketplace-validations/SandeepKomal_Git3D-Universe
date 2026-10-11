import test from "node:test";
import assert from "node:assert/strict";
import { makeProjector } from "../src/geometry.mjs";

test("projection origin lands on the centre point", () => {
  const p = makeProjector({ yawDeg: -26, pitchDeg: 58, cx: 100, cy: 50 });
  const o = p(0, 0, 0);
  assert.equal(o.x, 100);
  assert.equal(o.y, 50);
});

test("raising height moves a point up the screen", () => {
  const p = makeProjector({ yawDeg: -26, pitchDeg: 58, cx: 0, cy: 0 });
  assert.ok(p(0, 0, 10).y < p(0, 0, 0).y);
});

test("a direction faces the viewer when it points toward the camera", () => {
  const p = makeProjector({ yawDeg: 0, pitchDeg: 30, cx: 0, cy: 0 });
  assert.ok(p.facing(0, 1) > 0, "the near side faces the viewer");
  assert.ok(p.facing(0, -1) < 0, "the far side faces away");
});
