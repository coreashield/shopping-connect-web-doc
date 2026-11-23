// 요약 문단의 가격·평점 문장 — 렌더 시점 생성 (2026-09-08)
//   summary 프론트매터에는 정의·핵심·장점·대상만 저장하고, 숫자는 productPrice·rating 에서 매 빌드마다 만든다.
//   그래야 가격 갱신 스크립트가 productPrice 만 바꿔도 요약·Product 스키마·토픽 허브가 같은 값을 보인다.
//   기준 연월은 updatedDate 가 있으면 그것, 없으면 pubDate (실데이터가 확인된 시점).
//
// 낡은 기준월 문장 시험 (2026-11-22, 업무 OPT-06 — opt-geo 판단 GEO-1, PM 결정 11/22·skeptic 조건부 통과, 대표 "보류 없이 시범")
//   네이버 AI 브리핑이 요약 문단의 숫자 문장을 그대로 인용하는데, 가격 확인일이 오래된 글은 "2026년 9월 기준 …"으로 시작해
//   브리핑 안에서 우리 줄만 옛 가격처럼 보인다. food 사이트에서만, 확인일이 STALE_BEFORE 전인 글은
//   [요약] + [같은 분류 가격 위치 문장] + [판매가 문장 … 확인 날짜는 맨 뒤] 순서로 바꾼다.
//   날짜 값은 바꾸지 않는다(가격을 다시 확인하지 않고 기준일만 오늘로 바꾸는 것은 거짓 표기 — 금지).
//   그 밖의 글·사이트는 answerParagraph 가 예전 식([keyAnswer] + [가격 위치 문장])을 바이트 그대로 낸다.
//   기대 효과 근거 없음(시험). 판정: tasks/OPT-06 고정 목록 대 30일 이내 글 목록의 30일 클릭 비 0.98 → 1.18+, 12/24 스냅샷 이후.

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
	// 정수 평점(5·4)은 수집 기본값으로 보여 신뢰를 깎는다 — 소수점 실측값만 문장에 쓴다(10/3, BlogPost 구매 카드와 같은 기준)
	const rating = f.rating && f.rating > 0 && !Number.isInteger(f.rating) ? f.rating : 0;
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
	// 생성 요약의 "**핵심:** : …" 이중 콜론이 "핵심은 : …"으로 남는 글이 있다(10/3) — 렌더 시점에 조사 뒤 콜론을 지운다
	const parts = [cleanSummary(summary), priceSentence(f)].filter(Boolean);
	return parts.join(' ');
}

function cleanSummary(summary: string | undefined): string | undefined {
	return summary?.trim().replace(/(은|는|이|가)\s*:\s*/g, '$1 ').replace(/\s:\s/g, ' ');
}

// OPT-06: 이 날짜(YYYY-MM-DD) 전에 확인한 가격 = "확인일 30일 초과". 11/22 기준 30일(10/23) 로 고정한다.
//   빌드 날짜로 굴리면 비교군(30일 이내 글)이 판정일 전에 하나씩 적용군으로 넘어가 비교가 깨진다.
//   OPT-05 재확인으로 확인일이 바뀐 글은 자동으로 예전 식으로 돌아간다(판정에서는 따로 센다).
export const STALE_BEFORE = '2026-10-23';

// 문장에 쓰는 기준 시점과 같은 규칙: 가격 확인일 > 수정일 > 발행일
function basisDay(f: PriceFacts): { iso: string; text: string } {
	if (f.priceCheckedAt && /^\d{4}-\d{2}-\d{2}/.test(f.priceCheckedAt)) {
		const [y, m, d] = f.priceCheckedAt.slice(0, 10).split('-').map(Number);
		return { iso: f.priceCheckedAt.slice(0, 10), text: `${y}년 ${m}월 ${d}일` };
	}
	const dt = f.updatedDate ?? f.pubDate;
	return { iso: dt.toISOString().slice(0, 10), text: `${dt.getFullYear()}년 ${dt.getMonth() + 1}월 ${dt.getDate()}일` };
}

/** 가격 문장이 있고(판매 중·가격 있음) 기준 시점이 STALE_BEFORE 전인가 */
export function isStalePrice(f: PriceFacts): boolean {
	if (f.saleStatus === 'discontinued' || !(f.productPrice && f.productPrice > 0)) return false;
	return basisDay(f).iso < STALE_BEFORE;
}

// 낡은 글용 판매가 문장 — 머리말 없이 값부터, 확인 날짜는 맨 뒤(날짜 값은 그대로)
function stalePriceSentence(f: PriceFacts): string {
	const rating = f.rating && f.rating > 0 && !Number.isInteger(f.rating) ? f.rating : 0;
	const store = (f.productStore || '').trim() || '판매처';
	const won = f.productPrice!.toLocaleString('ko-KR');
	const reviews = f.reviewCount && f.reviewCount > 0 ? `(리뷰 ${f.reviewCount.toLocaleString('ko-KR')}개)` : '';
	const head = rating
		? `${store} 판매가는 ${won}원이고 구매자 평점은 5점 만점에 ${rating.toFixed(1)}점${reviews}이다.`
		: `${store} 판매가는 ${won}원이다.`;
	// "확인했다"고 쓰지 않는다 — 확인일이 없는 글은 수정일·발행일이 기준이라(예전 "YYYY년 M월 기준"과 같은 값, 일까지)
	return `${head} 이 가격은 ${basisDay(f).text} 기준이다.`;
}

/** 화면·abstract 에 쓰는 요약 문단 전체 = 요약 + 가격 문장 + 같은 분류 가격 위치 문장.
 *  staleLast(food 사이트만 true) 이고 낡은 가격이면 가격 위치 문장을 앞으로, 확인 날짜를 맨 뒤로 보낸다. */
export function answerParagraph(summary: string | undefined, f: PriceFacts, positionSentence: string | undefined, staleLast: boolean): string {
	if (staleLast && isStalePrice(f)) {
		return [cleanSummary(summary), positionSentence, stalePriceSentence(f)].filter(Boolean).join(' ');
	}
	return [keyAnswer(summary, f), positionSentence].filter(Boolean).join(' ');
}
