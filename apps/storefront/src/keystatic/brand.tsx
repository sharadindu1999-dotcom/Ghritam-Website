/**
 * Brand mark shown in the Keystatic admin sidebar.
 *
 * Inline SVG of the घ syllable in ink on paper — the same one used as the
 * favicon — so the CMS feels like part of the brand instead of a generic
 * Keystatic install.
 */
import type { ReactElement } from 'react';

export function BrandMark(): ReactElement {
  return (
    <svg
      viewBox="0 0 32 32"
      width={26}
      height={26}
      role="img"
      aria-label="Ghritam"
      style={{ display: 'block' }}
    >
      <rect width="32" height="32" fill="#f5efe4" rx="2" />
      <text
        x="16"
        y="23"
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontSize="22"
        fill="#1a1614"
      >
        घ
      </text>
    </svg>
  );
}
