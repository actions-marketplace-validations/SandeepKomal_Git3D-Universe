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
