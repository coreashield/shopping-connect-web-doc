// 요약 문단의 가격·평점 문장 — 렌더 시점 생성 (2026-09-08)
//   summary 프론트매터에는 정의·핵심·장점·대상만 저장하고, 숫자는 productPrice·rating 에서 매 빌드마다 만든다.
//   그래야 가격 갱신 스크립트가 productPrice 만 바꿔도 요약·Product 스키마·토픽 허브가 같은 값을 보인다.
//   기준 연월은 updatedDate 가 있으면 그것, 없으면 pubDate (실데이터가 확인된 시점).

export interface PriceFacts {
	productPrice?: number;
	rating?: number;
	productStore?: string;
	pubDate: Date;
	updatedDate?: Date;
}

const yearMonth = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월`;

export function priceSentence(f: PriceFacts): string {
	const price = f.productPrice && f.productPrice > 0 ? f.productPrice : 0;
	const rating = f.rating && f.rating > 0 ? f.rating : 0;
	if (!price && !rating) return '';
	const ym = yearMonth(f.updatedDate ?? f.pubDate);
	const store = (f.productStore || '').trim() || '판매처';
	const won = price.toLocaleString('ko-KR');
	if (price && rating) return `${ym} 기준 ${store} 판매가는 ${won}원이고 구매자 평점은 5점 만점에 ${rating.toFixed(1)}점이다.`;
	if (price) return `${ym} 기준 ${store} 판매가는 ${won}원이다.`;
	return `${ym} 기준 구매자 평점은 5점 만점에 ${rating.toFixed(1)}점이다.`;
}

/** 저장된 summary + 렌더 시점 가격 문장 → 화면·abstract 에 쓰는 완성 문단 */
export function keyAnswer(summary: string | undefined, f: PriceFacts): string {
	const parts = [summary?.trim(), priceSentence(f)].filter(Boolean);
	return parts.join(' ');
}
