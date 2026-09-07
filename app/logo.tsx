// The brand mark: a single red die showing the one — the wild face this whole
// variant is built around. Drawn as inline SVG rather than a file so it renders
// identically in the Worker build and the static Pages build, neither of which
// share a public-asset base path.
//
// The shape is a squircle (a rounded square with continuous corners, softer than
// a plain border-radius), lit from the top-left: a light-to-deep vertical
// gradient across the body, a bright rim along the top edge and a darker one
// along the bottom, and a pip inset just enough to read as drilled, not printed.

export function LogoDie({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="logo-die-body" x1="18" y1="4" x2="46" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f0705f" />
          <stop offset="0.45" stopColor="#e2564a" />
          <stop offset="1" stopColor="#c8443c" />
        </linearGradient>
        <radialGradient id="logo-die-pip" cx="0.4" cy="0.32" r="0.8">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e9e2dc" />
        </radialGradient>
      </defs>
      {/* Body. The path is a squircle: corner curves run into the straight edges
          instead of meeting them at a tangent break, which is what stops it
          looking like a rounded rectangle at small sizes. */}
      <path
        d="M32 2c11.5 0 17.3 0 21.9 2.5A17 17 0 0 1 59.5 10C62 14.7 62 20.5 62 32s0 17.3-2.5 21.9a17 17 0 0 1-5.6 5.6C49.3 62 43.5 62 32 62s-17.3 0-21.9-2.5A17 17 0 0 1 4.5 53.9C2 49.3 2 43.5 2 32s0-17.3 2.5-21.9A17 17 0 0 1 10.1 4.5C14.7 2 20.5 2 32 2Z"
        fill="url(#logo-die-body)"
      />
      {/* Rim light along the top, shadow along the bottom — the whole sense of
          depth comes from these two, so they stay subtle. */}
      <path
        d="M32 2c11.5 0 17.3 0 21.9 2.5A17 17 0 0 1 59.5 10C62 14.7 62 20.5 62 32s0 17.3-2.5 21.9a17 17 0 0 1-5.6 5.6C49.3 62 43.5 62 32 62s-17.3 0-21.9-2.5A17 17 0 0 1 4.5 53.9C2 49.3 2 43.5 2 32s0-17.3 2.5-21.9A17 17 0 0 1 10.1 4.5C14.7 2 20.5 2 32 2Z"
        stroke="url(#logo-die-edge)"
        strokeWidth="1.6"
      />
      <defs>
        <linearGradient id="logo-die-edge" x1="32" y1="2" x2="32" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      {/* The one. Sat dead centre, with a hairline shadow at its top edge so it
          sits in the face rather than on it. */}
      <circle cx="32" cy="32.8" r="5.6" fill="#000000" opacity="0.13" />
      <circle cx="32" cy="32" r="5.6" fill="url(#logo-die-pip)" />
    </svg>
  );
}
