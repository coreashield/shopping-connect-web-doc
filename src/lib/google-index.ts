// 구글 색인 대상 판정 (2026-09-29)
//   Search Console 9/21 기준: 색인 57 / 발견됨-미색인 3,796 / 크롤링됨-미색인 711.
//   옛 템플릿 글(판매 페이지 재서술·구어체)이 크롤 예산을 먹어 새 글까지 방문이 밀린다고 보고,
//   구글에만 noindex(meta name="googlebot")를 걸어 크롤을 새 형식 글에 몰아준다.
//   🔴 네이버(Yeti)는 googlebot 메타를 읽지 않는다 — 트래픽 대부분인 네이버 노출은 그대로다.
//
// 구글 색인 유지 대상
//   ① Search Console 에 이미 색인된 URL (src/data/google_indexed.json)
//   ② 새 형식 글: 본문에 "(YYYY.M월 판매 페이지 기준)" 표기가 있는 글 — 9/28 서술체 발행분과 --refresh 로 다시 쓴 글
//   글이 다시 쓰기로 새 형식이 되면 자동으로 ② 에 들어가 풀린다.
import indexed from '../data/google_indexed.json';

const INDEXED = new Set<string>(indexed.urls);
const NEW_FORMAT = /판매 페이지 기준\)/;

export function isGoogleIndexable(url: string, body: string | undefined): boolean {
	return INDEXED.has(url) || NEW_FORMAT.test(body ?? '');
}
