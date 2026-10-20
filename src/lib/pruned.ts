// 정리 대상 상품 글 (2026-10-20 대표 승인 — AdSense 콘텐츠 품질 + 노출 50% 계획 A안)
//   본체 사이트맵 상품 글 중 발행 60일+ & 네이버 30일 노출 스냅샷 10/6·10/13·10/20 모두 0 → 1,645개.
//   noindex,follow + 사이트맵 제외 + 목록(홈·/blog/·분류·관련 글·RSS·llms.txt)에서 뺀다. 글 페이지는 그대로 열린다.
//   목록은 승인 시점에 고정했다 — 규칙으로 자동 확장하지 않는다. 되돌리기 = src/data/pruned_posts.json 에서 id 삭제.
//   ⚠️ astro.config.mjs 사이트맵 필터가 같은 파일을 직접 읽는다(config 는 이 파일을 import 못 함).
//   토픽 허브(/topic/)는 노출이 있는 페이지라 제목·목록을 건드리지 않는다.
import pruned from '../data/pruned_posts.json';

const PRUNED = new Set<string>((pruned as { ids: string[] }).ids);

export function isPruned(id: string): boolean {
	return PRUNED.has(id);
}

/** 목록에 보일 글만 (정리 대상 제외) */
export function listed<T extends { id: string }>(posts: T[]): T[] {
	return posts.filter((p) => !PRUNED.has(p.id));
}
