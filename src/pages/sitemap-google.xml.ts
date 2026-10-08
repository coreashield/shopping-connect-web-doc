import type { APIRoute } from 'astro';
import { getGuides, getPosts, getTravel } from '../lib/site';
import { categoryList, topicHubs } from '../lib/categories';
import { isGoogleIndexable } from '../lib/google-index';
import { comparePrimary, pidOf } from '../lib/canonical';
import { SITE_URL } from '../consts';

// /sitemap-google.xml — 구글 Search Console 전용 사이트맵 (2026-09-29)
//   구글에만 noindex(googlebot)를 건 옛 형식 글은 빼고, 색인 대상만 싣는다.
//   네이버 서치어드바이저는 기존 /sitemap-index.xml(전체 글)을 그대로 쓴다.
//   같은 상품 글이 여러 개면 canonical 대표 글만 넣는다. 대표는 [...slug].astro 와 같은 규칙(src/lib/canonical.ts comparePrimary:
//   네이버 노출 많은 글 → 먼저 쓴 글)이다. 10/5 에 대표 규칙이 "최신 글"에서 바뀌었는데 이 사이트맵만 최신 글을 싣고 있어,
//   제출한 URL 의 canonical 이 다른 글을 가리키는 충돌이 났다(2026-10-08 조사: 구글 사이트맵 글 1,891개 중 약 559개).
//   canonical 이 가리키는 대표 글이 구글 noindex 면 그 상품은 사이트맵에서 뺀다(대표가 색인 불가인 글을 제출하지 않는다).
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const day = (d?: Date) => (d ? d.toISOString().slice(0, 10) : undefined);

export const GET: APIRoute = async () => {
	const posts = await getPosts();
	// [...slug].astro 가 canonical 대표를 고르는 것과 같은 정렬·같은 productId 규칙
	const primary = new Map<string, (typeof posts)[number]>();
	for (const p of [...posts].sort(comparePrimary)) {
		const k = pidOf(p) ?? p.id;
		if (!primary.has(k)) primary.set(k, p);
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
