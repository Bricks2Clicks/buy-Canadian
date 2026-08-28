export const MAPLE_LEAF_SRC = '/icons/maple-leaf.png';

const RED = '#d80621';

/** Canadian-flag-style hero: red panels + maple PNG centered on white. */
export function heroSvg() {
  return `<div class="ca-flag" role="img" aria-label="Canadian flag motif">
    <img src="${MAPLE_LEAF_SRC}" alt="" class="ca-flag-leaf" width="64" height="64" decoding="async">
  </div>`;
}

export function logoMarkSvg() {
  return `<svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="6" fill="${RED}"/>
    <image class="logo-maple" href="${MAPLE_LEAF_SRC}" x="6" y="5" width="20" height="22" preserveAspectRatio="xMidYMid meet"/>
  </svg>`;
}
