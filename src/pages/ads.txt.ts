import type { APIRoute } from 'astro';
import { ADSENSE_CLIENT } from '../lib/site';

// AdSense ads.txt (2026-10-15). 게시자 ID 가 없으면 빈 파일 — 승인 전에는 판매자 선언을 하지 않는다.
//   f08c47fec0942fa0 = 구글 인증기관 ID (모든 AdSense 게시자 공통)
export const GET: APIRoute = () =>
	new Response(
		ADSENSE_CLIENT ? `google.com, ${ADSENSE_CLIENT.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n` : '',
		{ headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
	);
