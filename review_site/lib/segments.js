// 11/8 세그먼트 페이지 /c/{분류…}/{세그먼트}/ — rentre.kr /rank/{품목}/{세그먼트} 구조를 우리 데이터(가격·리뷰 수·할인율)로.
//   1주 시범: PILOT 의 세부 분류 10곳만 연다(나머지는 404). 11/15경 노출·클릭 보고 전체 확대(대표 승인 콘티 v1).
//   상품 5개 미만 세그먼트는 noindex. 탭 목록(tabs)은 11/8 기준 5개 이상인 것만 — 사이트맵·탭 링크에 쓴다.
//   정렬을 탭마다 다르게 — 전부 점수순이면 점수 상위 상품이 모든 탭을 차지해 목록이 판박이가 된다(11/8 로컬 확인: 크림 3개 탭 상위 20 동일).
export const SEGMENTS = {
  'under-100k': { label: '10만원 이하', q: 'data->price=lte.100000', order: 'score.desc,review_count.desc', sortNote: '구매 점수 순' },
  '100k-300k': { label: '10~30만원', q: 'and=(data->price.gt.100000,data->price.lte.300000)', order: 'score.desc,review_count.desc', sortNote: '구매 점수 순' },
  'reviews-1k': { label: '리뷰 1천 개 이상', q: 'review_count=gte.1000', order: 'review_count.desc,score.desc', sortNote: '리뷰 많은 순' },
  'on-sale': { label: '할인 중', q: 'data->discount=gte.10&score=gte.60', order: 'data->discount.desc,score.desc', sortNote: '할인율 높은 순' },
};

// 탭 = 11/8 실측으로 5개 이상 + 점수순 탭은 분류의 80% 미만인 것만(넘으면 전체 목록과 같은 페이지). 렌더에서도 같은 기준으로 noindex.
const PRICE_MID = ['100k-300k', 'reviews-1k', 'on-sale'];
const NO_PRICE = ['reviews-1k', 'on-sale'];
export const PILOT = [
  ['식품>건강식품>영양제>프로바이오틱스', PRICE_MID],
  ['식품>건강식품>영양제>기타건강보조식품', PRICE_MID],
  ['화장품/미용>스킨케어>크림', PRICE_MID],
  ['디지털/가전>계절가전>공기정화기>공기정화기필터', NO_PRICE],
  ['디지털/가전>계절가전>선풍기>휴대용선풍기', NO_PRICE],
  ['식품>건강식품>건강즙/과일즙>기타건강즙/과일즙', PRICE_MID],
  ['식품>다이어트식품>단백질보충제>단백질파우더', PRICE_MID],
  ['디지털/가전>음향가전>블루투스셋>블루투스이어폰/이어셋', ['under-100k', ...PRICE_MID]],
  ['패션의류>남성의류>티셔츠', NO_PRICE],
  ['식품>건강식품>비타민제>멀티비타민', PRICE_MID],
];
export const REDUNDANT_SHARE = 0.8;
const PILOT_MAP = new Map(PILOT);
// 분류 경로(segs 배열)의 시범 탭 목록, 시범 아니면 null
export const pilotTabs = (segs) => PILOT_MAP.get(segs.join('>')) || null;
