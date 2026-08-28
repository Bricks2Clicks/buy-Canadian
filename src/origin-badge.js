const ORIGIN_PATTERNS = [
  /made in canada/i,
  /fabriqu[ée] au canada/i,
  /canadian made/i,
  /handcrafted in ontario/i,
  /fabriqu[ée] au qu[ée]bec/i,
  /made in qu[ée]bec/i,
  /product of canada/i,
];

function collectText(product) {
  const parts = [product.title];
  const desc = product.description?.html ?? product.description?.plain ?? product.description;
  if (typeof desc === 'string') parts.push(desc);
  if (product.metadata?.top_features) parts.push(...product.metadata.top_features);
  if (product.metadata?.unique_selling_points) {
    parts.push(...product.metadata.unique_selling_points);
  }
  if (product.metadata?.tech_specs) parts.push(...product.metadata.tech_specs);
  if (product.metadata?.attributes) {
    for (const attr of product.metadata.attributes) {
      parts.push(attr.name, ...(attr.values || []));
    }
  }
  for (const v of product.variants || []) {
    if (v.tags) parts.push(...v.tags);
    const vd = v.description?.plain ?? v.description;
    if (typeof vd === 'string') parts.push(vd);
  }
  return parts.join(' ');
}

export function mentionsMadeInCanada(product) {
  return ORIGIN_PATTERNS.some((re) => re.test(collectText(product)));
}
