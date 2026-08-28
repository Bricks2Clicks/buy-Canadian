/** Shopify Standard Product Taxonomy root categories (public data). Excludes bu, gc. */
export const ROOT_CATEGORIES = [
  { slug: 'aa', name: 'Apparel & Accessories' },
  { slug: 'fb', name: 'Food, Beverages & Tobacco' },
  { slug: 'hg', name: 'Home & Garden' },
  { slug: 'hb', name: 'Health & Beauty' },
  { slug: 'ap', name: 'Animals & Pet Supplies' },
  { slug: 'ae', name: 'Arts & Entertainment' },
  { slug: 'bt', name: 'Baby & Toddler' },
  { slug: 'bi', name: 'Business & Industrial' },
  { slug: 'co', name: 'Cameras & Optics' },
  { slug: 'el', name: 'Electronics' },
  { slug: 'fr', name: 'Furniture' },
  { slug: 'ha', name: 'Hardware' },
  { slug: 'lb', name: 'Luggage & Bags' },
  { slug: 'me', name: 'Media' },
  { slug: 'os', name: 'Office Supplies' },
  { slug: 'rc', name: 'Religious & Ceremonial' },
  { slug: 'sg', name: 'Sporting Goods' },
  { slug: 'so', name: 'Software' },
  { slug: 'tg', name: 'Toys & Games' },
  { slug: 'vp', name: 'Vehicles & Parts' },
];

export function categoryGid(slug) {
  return `gid://shopify/TaxonomyCategory/${slug}`;
}

export function getCategoryBySlug(slug) {
  return ROOT_CATEGORIES.find((c) => c.slug === slug);
}
