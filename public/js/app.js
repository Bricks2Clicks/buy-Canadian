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

export function productCardHtml(product) {
  const href = withShipsTo(
    `/product.html?id=${encodeURIComponent(product.id)}&variant=${encodeURIComponent(product.variantId)}`,
  );
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

export function renderProductGrid(container, products) {
  container.innerHTML = products.map(productCardHtml).join('');
}

export function appendProductGrid(container, products) {
  container.insertAdjacentHTML('beforeend', products.map(productCardHtml).join(''));
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

  document.querySelectorAll('.footer-attribution').forEach((el) => {
    el.innerHTML =
      '<a href="https://www.flaticon.com/free-icons/maple-leaf" title="maple leaf icons">Maple leaf icons created by Magnific - Flaticon</a>';
  });
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

import { heroSvg, logoMarkSvg } from './icons.js';

export { heroSvg };

export function mountLogoMark() {
  const slot = document.querySelector('[data-logo-mark]');
  if (slot) slot.outerHTML = logoMarkSvg();
}

export function showError(el, message) {
  el.innerHTML = `<p class="status-message error-message">${escapeHtml(message)}</p>`;
}

export const MAX_PRODUCTS = 1000;
