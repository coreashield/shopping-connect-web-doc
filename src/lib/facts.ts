// 상품 사실값 (2026-10-21, review101 형식 카드용) — review_site/scripts/build_product_pages.mjs 가 매일 src/data/product_facts.json 으로 낸다.
//   구매 점수·판정·추천/신중·확인할 것·리뷰 항목·키워드·할인은 모두 DB 숫자에서 계산한 값이다(AI·리뷰 원문 없음).
//   리뷰 사이트(review.shopping-log.com)의 lib/render.js 와 같은 규칙.
import raw from '../data/product_facts.json';

export type Facts = {
	score: number; label: string; parts: Record<string, number>;
	price: number | null; orig: number | null; discount: number | null; rating: number | null; reviews: number;
	leaf: string; leafN: number; leafMedian: number | null; pricePct: number | null; store: string | null; brand: string;
	fit: string[]; unfit: string[]; checks: string[]; attrs: { label: string; top: string; pct: number }[];
	keywords: string[]; spec: [string, string][]; checkedAt: string;
};

const ALL = raw as unknown as Record<string, Facts>;
export const factsOf = (pid?: string | null): Facts | null => (pid ? ALL[pid] ?? null : null);

const n = (v: number) => v.toLocaleString('ko-KR');
export const trustOf = (reviews: number) => (reviews >= 1000 ? '높음' : reviews >= 100 ? '보통' : '낮음');
export const riskOf = (score: number) => (score >= 85 ? '낮음' : score >= 72 ? '보통' : '높음');
export const toneOf = (score: number) => (score >= 85 ? 'g' : score >= 72 ? 'b' : score >= 58 ? 'y' : 'r');

export function reasonsOf(d: Facts): string[] {
	const r: string[] = [];
	if (d.reviews >= 1000) r.push(`리뷰가 ${n(d.reviews)}개로 충분해 구매 판단 근거가 넓습니다.`);
	else if (d.reviews >= 100) r.push(`리뷰 ${n(d.reviews)}개로 기본적인 표본이 있습니다.`);
	if (d.rating && d.rating >= 4.7) r.push(`평점 ${d.rating.toFixed(1)}점으로 만족도 신호가 안정적입니다.`);
	else if (d.rating && d.rating >= 4.5) r.push(`평점 ${d.rating.toFixed(1)}점으로 대체로 만족하는 편입니다.`);
	for (const a of d.attrs || []) if (a.pct >= 70 && r.length < 4) r.push(`구매자 ${a.pct}%가 ${a.label} "${a.top}"라고 답했습니다.`);
	if (d.pricePct != null && d.pricePct <= 33 && r.length < 4) r.push(`같은 ${d.leaf} ${n(d.leafN)}개 중 가격이 낮은 쪽입니다.`);
	if (d.discount && d.discount >= 20 && r.length < 4) r.push(`표시 정가 대비 ${d.discount}% 낮은 가격입니다.`);
	if (!r.length) r.push(`${d.leaf}을(를) 찾는다면 비교 후보로 볼 만합니다.`);
	return r.slice(0, 3);
}

export function verdictLine(score: number): string {
	if (score >= 85) return '리뷰 근거가 탄탄해 구매 후보로 먼저 검토하기 좋습니다.';
	if (score >= 72) return '구매 후보로 검토하기 좋지만 일부 조건은 스토어에서 확인하는 것이 좋습니다.';
	// 11/16: 아래 두 문장이 제목 바로 밑에 있어 네이버 검색 결과 설명란 첫 문장으로 나갔다("근거가 아직 부족해…").
	//   사실은 그대로 두고(비교·확인 권장) 읽는 사람이 다음에 할 일을 말하는 문장으로 바꿨다.
	if (score >= 58) return '같은 분류 상품과 가격·구성을 나란히 비교해 보고 고르기 좋습니다.';
	return '판매 페이지에서 가격·구성·후기를 먼저 확인하고 결정하세요.';
}

// "검증된 상품을 원하는 분 — 리뷰 3,395개에 평점 4.9" → ["검증된 상품을 원하는 사람", "리뷰 3,395개에 평점 4.9"]
export const splitWho = (s: string): [string, string] => {
	const [a, b = ''] = String(s).split(' — ');
	return [a.replace(/ 분$/, ' 사람').replace(/분$/, '사람'), b];
};
