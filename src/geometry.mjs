// Tiny 3D helper: rotate around the vertical axis, tilt toward the viewer,
// and project to 2D. World axes: u (east), v (south), h (up).

export function makeProjector({ yawDeg, pitchDeg, cx, cy }) {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const sinPitch = Math.sin(pitch);
  const cosPitch = Math.cos(pitch);

  const project = (u, v, h = 0) => {
    const x = u * cosYaw - v * sinYaw;
    const depth = u * sinYaw + v * cosYaw; // larger = closer to the viewer
    return { x: cx + x, y: cy + depth * sinPitch - h * cosPitch, depth };
  };

  // How much a ground-plane direction (nu, nv) faces the viewer (>0 = visible).
  project.facing = (nu, nv) => nu * sinYaw + nv * cosYaw;
  return project;
}

const LIGHT = (() => {
  const l = [-0.45, 0.9];
  const len = Math.hypot(l[0], l[1]);
  return [l[0] / len, l[1] / len];
})();

// Returns the visible faces of an axis-aligned prism, each with a brightness
// multiplier derived from a fixed light direction.
export function prismFaces(project, u, v, size, height) {
  const u1 = u + size;
  const v1 = v + size;
  const P = (a, b, h) => project(a, b, h);
  const sides = [
    { n: [0, 1], pts: [P(u, v1, 0), P(u1, v1, 0), P(u1, v1, height), P(u, v1, height)] },
    { n: [1, 0], pts: [P(u1, v, 0), P(u1, v1, 0), P(u1, v1, height), P(u1, v, height)] },
    { n: [-1, 0], pts: [P(u, v, 0), P(u, v1, 0), P(u, v1, height), P(u, v, height)] },
    { n: [0, -1], pts: [P(u, v, 0), P(u1, v, 0), P(u1, v, height), P(u, v, height)] },
  ];

  const faces = [];
  for (const side of sides) {
    if (project.facing(side.n[0], side.n[1]) <= 0) continue;
    const lit = Math.max(0, side.n[0] * LIGHT[0] + side.n[1] * LIGHT[1]);
    faces.push({ pts: side.pts, shade: 0.42 + 0.45 * lit });
  }
  faces.push({ pts: [P(u, v, height), P(u1, v, height), P(u1, v1, height), P(u, v1, height)], shade: 1.16, top: true });
  return faces;
}
