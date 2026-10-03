import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site';

// AI 검색 크롤러를 명시 허용한다 (GEO 2026-09-07). 와일드카드로 이미 허용되지만
//   크롤러별 정책을 갖는 운영자들이 참고하는 위치라 의도를 드러내 둔다.
const ALLOW = [
	'*', 'Yeti', 'Googlebot',
	// AI 검색·답변 엔진
	'GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended',
];

// /go/ 는 제휴링크 리다이렉트 — 크롤러가 따라가면 제휴 클릭으로 잡힌다(10/3). 모든 그룹에 넣어야
//   크롤러별 그룹이 * 그룹 규칙을 대체해도 빠지지 않는다. 더 긴 경로라 Allow: / 보다 우선한다.
export const GET: APIRoute = () =>
	new Response(
		ALLOW.map((ua) => `User-agent: ${ua}\nAllow: /\nDisallow: /go/\n`).join('\n') + `\nSitemap: ${SITE_URL}/sitemap-index.xml\nSitemap: ${SITE_URL}/sitemap-google.xml\n`,   // google: 구글 색인 대상만 (9/29)
		{ headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
	);
