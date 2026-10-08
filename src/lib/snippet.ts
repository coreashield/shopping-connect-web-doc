// 검색 결과 클릭률(CTR) 개선용 렌더 시점 보정 (2026-10-08).
//   원인 조사(네이버 서치어드바이저 30일: 노출 3.9만 / 클릭 330 / CTR 0.8%):
//   ① 제목이 "고민 문장 + 뒤쪽 상품명" 구조인 글이 약 1,000개(20%) — 검색 결과에서 제목이 잘리면 상품명이 안 보인다.
//      네이버 클릭 상위 검색어 상당수가 상품명 그대로(예: "엠프리스 여성 면접 승무원 구두 …")라 앞쪽에 상품명이 있어야 한다.
//   ② 대표 이미지가 판매처 로고·배너인 글이 약 820개(17%) — og:image·구매 카드 썸네일이 로고가 된다.
//   콘텐츠 파일은 건드리지 않는다(발행 파이프라인과 충돌 방지·되돌리기 쉬움). 본문 H1 은 원래 제목 그대로다.

const NAME_EARLY_WITHIN = 10;   // 상품명(첫 단어)이 제목 앞 10자 안에 있으면 이미 앞쪽
const TITLE_MAX_VISIBLE = 38;   // 이보다 짧으면 잘리지 않으니 그대로
const MIN_KEPT = 12;            // 당긴 뒤 이보다 짧으면 의미가 사라지므로 원래 제목 유지

const firstWord = (s: string) => s.replace(/^\s*(\[[^\]]*\]\s*)+/g, '').split(/\s+/).filter(Boolean)[0] ?? '';

export type SeoTitleInput = { title: string; productName?: string };

/**
 * <title>/og:title 용 제목. 상품명(첫 단어)이 제목 뒤쪽에서 시작하는 긴 제목만,
 * 상품명이 시작되는 지점부터로 앞당긴다. 글자를 새로 만들지 않고 원래 제목의 뒷부분을 쓴다.
 *   "필드 나갈 때 볼마커 자꾸 잃어버린다면, 엑세스스튜디오 골프 가죽 볼마커 비교해봤어요"
 *   → "엑세스스튜디오 골프 가죽 볼마커 비교해봤어요"
 * 상품명이 제목에 없거나(브랜드 표기 차이) 결과가 너무 짧으면 원래 제목을 그대로 쓴다.
 */
export function seoTitle({ title, productName }: SeoTitleInput): string {
	if (!productName || [...title].length <= TITLE_MAX_VISIBLE) return title;
	const first = firstWord(productName);
	if (first.length < 2) return title;
	const idx = title.toLowerCase().indexOf(first.toLowerCase());
	if (idx <= NAME_EARLY_WITHIN) return title;   // -1(없음) 포함
	// 상품명 바로 앞의 쉼표·물음표 경계에서만 자른다. 경계가 없으면(문장 중간에 상품명이 박힌 경우) 브랜드가 잘릴 수 있어 그대로 둔다.
	const cut = Math.max(title.lastIndexOf(',', idx), title.lastIndexOf('?', idx), title.lastIndexOf('!', idx));
	if (cut < 0) return title;
	const moved = title.slice(cut + 1).trim();
	return [...moved].length >= MIN_KEPT ? moved : title;
}

// 판매처 로고·배너 이미지 판별 (파일명에 한글이 CP949 로 퍼센트 인코딩되어 있다: %B7%CE%B0%ED = "로고")
const LOGO_RE = /%B7%CE%B0%ED|%EB%A1%9C%EA%B3%A0|logo|GNB|banner|%B9%E8%B3%CA|%EB%B0%B0%EB%84%88/i;
export const isLogoImage = (url?: string): boolean => {
	if (!url) return false;
	let decoded = url;
	try { decoded = decodeURIComponent(url); } catch { /* CP949 바이트는 디코드 실패 — 원본 검사로 충분 */ }
	return LOGO_RE.test(url) || LOGO_RE.test(decoded);
};

/** 본문에서 첫 번째 상품 사진(로고 아님) */
export function firstBodyImage(body?: string): string | undefined {
	if (!body) return undefined;
	const re = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)|<img[^>]+src=["'](https?:\/\/[^"']+)["']/g;
	for (const m of body.matchAll(re)) {
		const url = m[1] ?? m[2];
		if (url && !isLogoImage(url)) return url;
	}
	return undefined;
}
