const STORAGE_KEY = 'buyCanadianShipsTo';

export function getShipsTo() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('to');
  if (fromUrl) {
    localStorage.setItem(STORAGE_KEY, fromUrl.toUpperCase());
    return fromUrl.toUpperCase();
  }
  return localStorage.getItem(STORAGE_KEY) || 'CA';
}

export function setShipsTo(code) {
  localStorage.setItem(STORAGE_KEY, code);
  const url = new URL(window.location.href);
  url.searchParams.set('to', code);
  window.location.href = url.toString();
}

export function withShipsTo(url) {
  const u = new URL(url, window.location.origin);
  u.searchParams.set('to', getShipsTo());
  return u.pathname + u.search;
}

export async function fetchJson(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${path}${sep}to=${encodeURIComponent(getShipsTo())}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function productCardHtml(product, categorySlug) {
  let href = `/product.html?id=${encodeURIComponent(product.id)}&variant=${encodeURIComponent(product.variantId)}`;
  if (categorySlug) {
    href += `&category=${encodeURIComponent(categorySlug)}`;
  }
  href = withShipsTo(href);
  const badge = product.mentionsOrigin
    ? '<span class="badge">Mentions made in Canada</span>'
    : '';
  const img = product.image
    ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.imageAlt)}" loading="lazy">`
    : '';
  return `
    <a class="product-card" href="${href}">
      <div class="product-card-image">${img}</div>
      <div class="product-card-body">
        ${badge}
        <h3 class="product-card-title">${escapeHtml(product.title)}</h3>
        <div class="product-card-price">${escapeHtml(product.price)}</div>
        <div class="product-card-seller">${escapeHtml(product.sellerName)}</div>
      </div>
    </a>`;
}

export function renderProductGrid(container, products, categorySlug) {
  container.innerHTML = products
    .map((p) => productCardHtml(p, categorySlug))
    .join('');
}

export function appendProductGrid(container, products, categorySlug) {
  container.insertAdjacentHTML(
    'beforeend',
    products.map((p) => productCardHtml(p, categorySlug)).join(''),
  );
}

/** Visible breadcrumb nav. Items: { name, path? }. Last item or missing path = current page. */
export function breadcrumbHtml(items) {
  const lis = items.map((item, index) => {
    const isCurrent = index === items.length - 1 || !item.path;
    if (isCurrent) {
      return `<li><span class="breadcrumb-current" aria-current="page">${escapeHtml(item.name)}</span></li>`;
    }
    return `<li><a class="breadcrumb-link" href="${escapeHtml(withShipsTo(item.path))}">${escapeHtml(item.name)}</a></li>`;
  });
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol class="breadcrumb-list">${lis.join('')}</ol></nav>`;
}

export async function initFooter() {
  const select = document.getElementById('ships-to');
  if (!select) return;

  const config = await fetchJson('/api/config');
  const current = getShipsTo();

  select.innerHTML = config.shippableCountries
    .map(
      (c) =>
        `<option value="${c.code}" ${c.code === current ? 'selected' : ''}>${escapeHtml(c.name)}</option>`,
    )
    .join('');

  if (!config.exportCatalogConfigured) {
    select.disabled = true;
    select.title = 'International shipping coming in a future update';
  } else {
    select.addEventListener('change', () => setShipsTo(select.value));
  }

}

export function initSearchForm() {
  const form = document.getElementById('header-search');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = form.querySelector('input[name="q"]').value.trim();
    if (!q) return;
    window.location.href = withShipsTo(`/search.html?q=${encodeURIComponent(q)}`);
  });
}

import { logoMarkSvg } from './icons.js';

export function mountLogoMark() {
  const slot = document.querySelector('[data-logo-mark]');
  if (slot) slot.outerHTML = logoMarkSvg();
}

export function showError(el, message) {
  el.innerHTML = `<p class="status-message error-message">${escapeHtml(message)}</p>`;
}

export const MAX_PRODUCTS = 1000;

/** Category page price buckets (amounts in minor CAD units). */
export const PRICE_RANGE_OPTIONS = [
  { id: 'under25', label: 'Under $25', min: null, max: 2499 },
  { id: '25-50', label: '$25 – $50', min: 2500, max: 4999 },
  { id: '50-100', label: '$50 – $100', min: 5000, max: 9999 },
  { id: '100plus', label: '$100+', min: 10000, max: null },
];

export function filterProductsByPriceRanges(products, selectedIds) {
  if (!selectedIds?.length) return products;
  return products.filter((product) => {
    const price = product.priceRaw;
    if (price == null) return false;
    return selectedIds.some((id) => {
      const range = PRICE_RANGE_OPTIONS.find((r) => r.id === id);
      if (!range) return false;
      if (range.min != null && price < range.min) return false;
      if (range.max != null && price > range.max) return false;
      return true;
    });
  });
}

/** Sort products for category listing. sortMode: '' (API order), 'price-asc', 'price-desc'. */
export function sortProductsForDisplay(products, sortMode) {
  const list = [...products];
  if (sortMode === 'price-asc' || sortMode === 'price-desc') {
    const dir = sortMode === 'price-desc' ? -1 : 1;
    list.sort((a, b) => {
      const pa = a.priceRaw;
      const pb = b.priceRaw;
      if (pa == null && pb == null) return (a._order ?? 0) - (b._order ?? 0);
      if (pa == null) return 1;
      if (pb == null) return -1;
      if (pa === pb) return (a._order ?? 0) - (b._order ?? 0);
      return (pa - pb) * dir;
    });
    return list;
  }
  list.sort((a, b) => (a._order ?? 0) - (b._order ?? 0));
  return list;
}
