// 호스트(사이트)별 빌드 설정 — 카테고리 분리 실험(2026-09-02).
//   본체: env 없음 → SUB_SITES 카테고리를 제외한 전체. 서브: SITE_CATEGORY=<대분류> → 그 카테고리만.
//   빌드 env: SITE_CATEGORY, SITE_URL, SITE_TITLE, SITE_DESCRIPTION, NAVER_SITE_VERIFICATION
import { getCollection, type CollectionEntry } from 'astro:content';
import { topCategory } from './categories';

export type SubSite = { category: string; host: string; slug: string; title: string; description: string };
// 서브도메인으로 분리된 카테고리 (본체에서는 제외 + 301). 새 카테고리를 분리하면 여기에만 추가한다.
export const SUB_SITES: SubSite[] = [
	{ category: '디지털/가전', host: 'digital.shopping-log.com', slug: 'digital', title: '쇼핑로그 디지털·가전', description: '가전·디지털 기기 스펙 비교와 구매 가이드 — 평수·소음·전기세·호환성 기준으로 고르는 법' },
	{ category: '식품', host: 'food.shopping-log.com', slug: 'food', title: '쇼핑로그 식품', description: '식품·건강식품 비교 가이드 — 성분·용량·보관·가격 기준으로 고르는 법' },
];

const env = (k: string) => (import.meta.env[k] as string | undefined)?.trim() || '';
export const SITE_CATEGORY = env('SITE_CATEGORY');            // '' = 본체
export const CURRENT_SUB = SUB_SITES.find((s) => s.category === SITE_CATEGORY) ?? null;
export const SITE_URL = env('SITE_URL') || (CURRENT_SUB ? `https://${CURRENT_SUB.host}` : 'https://shopping-log.com');
export const SITE_TITLE = env('SITE_TITLE') || CURRENT_SUB?.title || '쇼핑로그';
export const SITE_DESCRIPTION = env('SITE_DESCRIPTION') || CURRENT_SUB?.description || '꼼꼼히 비교한 쇼핑 추천 — 가격, 후기, 스펙을 한눈에';
export const NAVER_SITE_VERIFICATION = env('NAVER_SITE_VERIFICATION') || (CURRENT_SUB ? '' : '7bb6ac531df1fe950cba4b95228c33104dc73fce');
export const GOOGLE_SITE_VERIFICATION = env('GOOGLE_SITE_VERIFICATION') || (CURRENT_SUB ? '' : 'L4XkgtlpgPwwbh27YhByAmN_-uIv8n8hhiEqwcBc8JU');

/** 이 호스트에 속하는 글인가 */
export function belongsHere(category?: string): boolean {
	const top = topCategory(category);
	if (SITE_CATEGORY) return top === SITE_CATEGORY;
	return !SUB_SITES.some((s) => s.category === top);
}

/** getCollection('blog') 대체 — 호스트 필터 적용 */
export async function getPosts(): Promise<CollectionEntry<'blog'>[]> {
	const all = await getCollection('blog');
	return all.filter((p) => belongsHere(p.data.category));
}

/** 본체에서 서브도메인으로 옮겨간 글의 새 URL (없으면 null) */
export function movedTo(category?: string, slug?: string): string | null {
	const top = topCategory(category);
	const sub = SUB_SITES.find((s) => s.category === top);
	return sub && slug ? `https://${sub.host}/blog/${slug}/` : null;
}

/** 가이드 페이지 — 호스트 필터 적용 */
export async function getGuides(): Promise<CollectionEntry<'guides'>[]> {
	const all = await getCollection('guides');
	return all.filter((g) => belongsHere(g.data.category)).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}
