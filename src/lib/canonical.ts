// 같은 상품(productId) 글이 여러 개일 때 대표 글(canonical) 고르기 — 2026-10-05 대표 결정.
//   ① 네이버 노출을 받는 글이 있으면 노출이 가장 많은 글 ② 없으면 가장 먼저 쓴 글 ③ 동률이면 id 사전순.
//   왜: 8/17~ 30일 dedup 재발행으로 같은 상품 글이 날짜만 다르게 쌓였고, 최신 글을 대표로 삼자 네이버가 이미 노출 주던
//   첫 글이 canonical 에서 빠졌다(중복 상품 중 노출이 첫 글에만 71 · 나중 글에만 27 · 둘 다 7).
//   노출 데이터 = src/data/naver_impressions.json (서치어드바이저 30일, naver_exposure_fetch → naver_url_stats 스냅샷).
//   ⚠️ astro.config.mjs 의 buildNonCanonicalSet 이 같은 규칙을 복제한다(config 는 이 파일을 import 못 함) — 바꾸면 둘 다.
import naver from '../data/naver_impressions.json';

const IMP: Record<string, number> = (naver as any).impressions || {};

export const pidOf = (p: { id: string; data: { productId?: string } }): string | undefined =>
	p.data.productId ?? p.id.match(/-(\d{6,})-\d{8}$/)?.[1];

export function comparePrimary(a: { id: string; data: { pubDate: Date } }, b: { id: string; data: { pubDate: Date } }): number {
	const ia = IMP[a.id] || 0, ib = IMP[b.id] || 0;
	if (ia !== ib) return ib - ia;                                       // 노출 많은 글 먼저
	const d = a.data.pubDate.valueOf() - b.data.pubDate.valueOf();       // 그다음 먼저 쓴 글
	return d !== 0 ? d : a.id.localeCompare(b.id);
}

/** 상품별 대표 글 id 맵 (productId → 대표 id) */
export function primaryIds<T extends { id: string; data: { productId?: string; pubDate: Date } }>(posts: T[]): Map<string, string> {
	const m = new Map<string, string>();
	for (const p of [...posts].sort(comparePrimary)) {
		const pid = pidOf(p);
		if (pid && !m.has(pid)) m.set(pid, p.id);
	}
	return m;
}
