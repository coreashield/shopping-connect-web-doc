// /sitemaps/{n}.xml — 공개 상품 5,000개 묶음 (product_id 순), /sitemaps/cats.xml — 홈·분류
import { sb, getCats } from '../../lib/db.js';
import { SITE, catHref } from '../../lib/render.js';
import { PER_MAP } from '../sitemap.xml.js';

const xmlRes = (urls) => new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(([u, m]) => `<url><loc>${u}</loc>${m ? `<lastmod>${m}</lastmod>` : ''}</url>`).join('')}</urlset>`, {
  headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
});

export async function onRequestGet(context) {
  const name = String(context.params.n || '').replace(/\.xml$/, '');
  if (name === 'cats') {
    const { tree } = await getCats(context);
    const urls = [[`${SITE.origin}/`], [`${SITE.origin}/about/`]];
    const walk = (node, path) => { for (const [c, v] of Object.entries(node)) { if (v.n < 5) continue; const p = [...path, c]; urls.push([SITE.origin + catHref(p)]); walk(v.k, p); } };
    walk(tree, []);
    return xmlRes(urls);
  }
  const n = Number(name);
  if (!Number.isInteger(n) || n < 1) return new Response('not found', { status: 404 });
  // PostgREST 한 번 최대 1,000행 → 5번 나눠 읽기
  const urls = [];
  for (let off = (n - 1) * PER_MAP; off < n * PER_MAP; off += 1000) {
    const rows = await sb(context.env, `product_pages?published=eq.true&select=product_id,built_at&order=product_id&offset=${off}&limit=1000`);
    for (const r of rows) urls.push([`${SITE.origin}/p/${r.product_id}/`, r.built_at.slice(0, 10)]);
    if (rows.length < 1000) break;
  }
  if (!urls.length) return new Response('not found', { status: 404 });
  return xmlRes(urls);
}
