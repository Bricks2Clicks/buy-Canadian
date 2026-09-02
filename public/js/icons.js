export const MAPLE_LEAF_SRC = '/icons/maple-leaf.png';

const RED = '#d80621';

export function logoMarkSvg() {
  return `<svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="6" fill="${RED}"/>
    <image class="logo-maple" href="${MAPLE_LEAF_SRC}" x="6" y="5" width="20" height="22" preserveAspectRatio="xMidYMid meet"/>
  </svg>`;
}
