// 요약 문단의 가격·평점 문장 — 렌더 시점 생성 (2026-09-08)
//   summary 프론트매터에는 정의·핵심·장점·대상만 저장하고, 숫자는 productPrice·rating 에서 매 빌드마다 만든다.
//   그래야 가격 갱신 스크립트가 productPrice 만 바꿔도 요약·Product 스키마·토픽 허브가 같은 값을 보인다.
//   기준 연월은 updatedDate 가 있으면 그것, 없으면 pubDate (실데이터가 확인된 시점).

export interface PriceFacts {
	productPrice?: number;
	rating?: number;
	reviewCount?: number;
	productStore?: string;
	pubDate: Date;
	updatedDate?: Date;
	priceCheckedAt?: string; // YYYY-MM-DD — 가격 갱신 스크립트가 확인한 자료 시점
	saleStatus?: 'on_sale' | 'discontinued';
}

const yearMonth = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월`;

export function priceSentence(f: PriceFacts): string {
	const price = f.productPrice && f.productPrice > 0 ? f.productPrice : 0;
	const rating = f.rating && f.rating > 0 ? f.rating : 0;
	// 기준 시점 우선순위: 가격 확인일 > 수정일 > 발행일
	const checked = f.priceCheckedAt && /^\d{4}-\d{2}-\d{2}/.test(f.priceCheckedAt) ? new Date(f.priceCheckedAt) : null;
	const ym = yearMonth(checked ?? f.updatedDate ?? f.pubDate);
	// 판매 종료: 판매처 상품 페이지가 삭제된 것을 확인한 경우. 옛 가격은 "당시" 로 명시
	if (f.saleStatus === 'discontinued') {
		const was = price ? ` 발행 당시 판매가는 ${price.toLocaleString('ko-KR')}원이었다.` : '';
		return `${ym} 기준 판매처 상품 페이지가 삭제되어 현재는 구매할 수 없다.${was}`;
	}
	if (!price && !rating) return '';
	const store = (f.productStore || '').trim() || '판매처';
	const won = price.toLocaleString('ko-KR');
	const reviews = f.reviewCount && f.reviewCount > 0 ? `(리뷰 ${f.reviewCount.toLocaleString('ko-KR')}개)` : '';
	const ratingText = `구매자 평점은 5점 만점에 ${rating.toFixed(1)}점${reviews}이다.`;
	if (price && rating) return `${ym} 기준 ${store} 판매가는 ${won}원이고 ${ratingText}`;
	if (price) return `${ym} 기준 ${store} 판매가는 ${won}원이다.`;
	return `${ym} 기준 ${ratingText}`;
}

/** 저장된 summary + 렌더 시점 가격 문장 → 화면·abstract 에 쓰는 완성 문단 */
export function keyAnswer(summary: string | undefined, f: PriceFacts): string {
	const parts = [summary?.trim(), priceSentence(f)].filter(Boolean);
	return parts.join(' ');
}
