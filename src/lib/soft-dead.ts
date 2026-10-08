// 판매 종료 + 네이버 노출 0 글은 검색에 둘 이유가 없다 — 구매 링크가 없고(remark-discontinued) 노출도 없어
//   서치어드바이저 사이트 진단의 "소프트 404"(30개)로 잡히는 후보다(10/7 점검). noindex,follow + 사이트맵 제외.
//   - 노출이 있는 판매 종료 글(26개)은 그대로 둔다(노출·클릭 보존).
//   - 같은 상품(productId)에 다른 글이 있으면 canonical 대상일 수 있어 건드리지 않는다.
//   - 노출 데이터(naver_impressions.json)는 본체(shopping-log.com)만이라 서브사이트(디지털/가전·식품) 글은 제외.
//   ⚠️ astro.config.mjs 의 buildSoftDeadSet 이 같은 규칙을 복제한다(config 는 이 파일을 import 못 함) — 바꾸면 둘 다.
import naver from '../data/naver_impressions.json';

const IMP: Record<string, number> = (naver as any).impressions || {};
export const SUB_TOPS = ['디지털/가전', '식품'];

export function isSoftDead(id: string, saleStatus: string | undefined, category: string | undefined, hasSiblings: boolean): boolean {
	if (saleStatus !== 'discontinued' || hasSiblings) return false;
	const top = String(category || '').split('>')[0].trim();
	if (SUB_TOPS.includes(top)) return false;
	return !(IMP[id] > 0);
}
