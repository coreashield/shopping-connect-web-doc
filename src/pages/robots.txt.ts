import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site';

// AI 검색 크롤러를 명시 허용한다 (GEO 2026-09-07). 와일드카드로 이미 허용되지만
//   크롤러별 정책을 갖는 운영자들이 참고하는 위치라 의도를 드러내 둔다.
const ALLOW = [
	'*', 'Yeti', 'Googlebot',
	// AI 검색·답변 엔진
	'GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended',
];

export const GET: APIRoute = () =>
	new Response(
		ALLOW.map((ua) => `User-agent: ${ua}\nAllow: /\n`).join('\n') + `\nSitemap: ${SITE_URL}/sitemap-index.xml\n`,
		{ headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
	);
