import type { APIRoute } from 'astro';
import { getGuides, getPosts, getTravel } from '../lib/site';
import { categoryList, topicHubs } from '../lib/categories';
import { isGoogleIndexable } from '../lib/google-index';
import { SITE_URL } from '../consts';

// /sitemap-google.xml — 구글 Search Console 전용 사이트맵 (2026-09-29)
//   구글에만 noindex(googlebot)를 건 옛 형식 글은 빼고, 색인 대상만 싣는다.
//   네이버 서치어드바이저는 기존 /sitemap-index.xml(전체 글)을 그대로 쓴다.
//   같은 상품 글이 여러 개면 canonical 대표(최신 글)만 넣는다([...slug].astro 와 같은 기준).
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const day = (d?: Date) => (d ? d.toISOString().slice(0, 10) : undefined);

export const GET: APIRoute = async () => {
	const posts = await getPosts();
	const pidOf = (p: (typeof posts)[number]) => p.data.productId ?? p.id.match(/-(\d{6,})-\d{8}$/)?.[1] ?? p.id;
	const primary = new Map<string, (typeof posts)[number]>();
	for (const p of posts) {
		const k = pidOf(p);
		const cur = primary.get(k);
		const newer = !cur || p.data.pubDate.valueOf() > cur.data.pubDate.valueOf()
			|| (p.data.pubDate.valueOf() === cur.data.pubDate.valueOf() && p.id.localeCompare(cur.id) < 0);
		if (newer) primary.set(k, p);
	}

	const entries: { loc: string; lastmod?: string }[] = [];
	const add = (path: string, lastmod?: string) => entries.push({ loc: new URL(path, SITE_URL).href, lastmod });

	add('/');
	add('/blog/');
	add('/about/');
	add('/category/');
	for (const c of categoryList(posts)) add(`/category/${c.slug}/`);
	for (const h of topicHubs(posts, 15)) add(`/topic/${encodeURI(h.slug)}/`);
	for (const g of await getGuides()) add(`/guide/${g.id}/`, day(g.data.updatedDate ?? g.data.pubDate));
	const trips = await getTravel();
	if (trips.length) {
		add('/travel/');
		for (const t of trips) add(`/travel/${t.id}/`);
	}
	for (const p of primary.values()) {
		const url = new URL(`/blog/${p.id}/`, SITE_URL).href;
		if (isGoogleIndexable(url, p.body)) entries.push({ loc: url, lastmod: day(p.data.updatedDate ?? p.data.pubDate) });
	}

	const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
		+ entries.map((e) => `<url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`).join('\n')
		+ '\n</urlset>\n';
	return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
