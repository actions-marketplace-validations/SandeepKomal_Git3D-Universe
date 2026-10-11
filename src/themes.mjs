// Colour tokens. Every colour that reaches the SVG comes from here.
// Git3D Universe is cosmic: deep space at night, a soft dawn sky by day, and
// one colour wheel for the year in both.

export const themes = {
  // Night: deep space. The year's wedges run through a cosmic wheel of teal,
  // sky, indigo, violet, rose and gold around a glowing core.
  aurora: {
    dark: true,
    bgInner: "#0b1530",
    bgMid: "#060b1d",
    bgOuter: "#02040b",
    ink: "#eef4ff",
    mute: "#9fb0cf",
    rule: "#1d2a48",
    glow: "#5eead4",
    nebulaA: "#6d4bd8",
    nebulaB: "#0e9fb0",
    shadow: "#000000",
    borderA: "#5eead4",
    borderB: "#a78bfa",
    ring: "#7dd3fc",
    ringHi: "#e0f2fe",
    planetLight: "#ffffff",
    planets: ["#5eead4", "#f9a8d4", "#7dd3fc", "#fcd34d", "#c4b5fd", "#86efac", "#fdba74"],
    wheel: ["#14d3b9", "#22b4f5", "#5b6cf9", "#a24bf7", "#ee4fa8", "#f9ad1a"],
    emptyWedge: "#1b2747",
    discTop: "#101a36",
    discSide: "#0a1128",
    discEdge: "#3b5a9a",
    core: "#fde68a",
    peak: "#fbbf24",
    // Card chart: moons lit in pale teal on a dark disc.
    // Contribution mix: commits, pull requests, issues, code review.
    mix: ["#10a893", "#9446ec", "#c8850c", "#db3f96"],
    mixTrack: "#1a2646",
    stars: true,
  },
  // Day: a soft dawn sky with the same cosmic wheel, a little deeper so it
  // holds up on a light background.
  daylight: {
    dark: false,
    bgInner: "#ffffff",
    bgMid: "#f3f6fd",
    bgOuter: "#e7ecf8",
    ink: "#13203d",
    mute: "#5b6b8c",
    rule: "#e2e8f5",
    glow: "#0d9488",
    nebulaA: "#ede9fe",
    nebulaB: "#ccfbf1",
    shadow: "#7d8bb0",
    borderA: "#99f6e4",
    borderB: "#ddd6fe",
    ring: "#38bdf8",
    ringHi: "#ffffff",
    planetLight: "#ffffff",
    planets: ["#14b8a6", "#ec4899", "#0ea5e9", "#f59e0b", "#8b5cf6", "#22c55e", "#f97316"],
    wheel: ["#14b8a6", "#0ea5e9", "#6366f1", "#a855f7", "#ec4899", "#f59e0b"],
    emptyWedge: "#dde3f1",
    discTop: "#ffffff",
    discSide: "#dfe5f3",
    discEdge: "#b7c3e0",
    core: "#fbbf24",
    peak: "#f59e0b",
    mix: ["#10a893", "#9446ec", "#c8850c", "#db3f96"],
    mixTrack: "#e6ebf5",
    stars: false,
  },
};

export const FONT_STACK = "ui-sans-serif, 'SF Pro Display', 'Segoe UI', Inter, Helvetica, Arial, sans-serif";
