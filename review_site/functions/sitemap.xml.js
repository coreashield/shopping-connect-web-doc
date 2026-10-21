// 사이트맵 색인 — 공개 상품 5,000개씩 /sitemaps/{n}.xml + 분류 /sitemaps/cats.xml
import { sb } from '../lib/db.js';
import { SITE } from '../lib/render.js';

export const PER_MAP = 5000;

export async function onRequestGet({ env }) {
  const { total } = await sb(env, 'product_pages?published=eq.true&select=product_id&limit=1', { count: true });
  const n = Math.ceil(total / PER_MAP);
  const maps = [`${SITE.origin}/sitemaps/cats.xml`, ...Array.from({ length: n }, (_, i) => `${SITE.origin}/sitemaps/${i + 1}.xml`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${maps.map((u) => `<sitemap><loc>${u}</loc></sitemap>`).join('')}</sitemapindex>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
