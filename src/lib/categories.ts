import type { CollectionEntry } from 'astro:content';

// 네이버 카테고리 경로("식품>건강식품>영양제>철분")의 최상위 분류를 URL 슬러그로 매핑.
// 내부 링크용 주제 허브(/category/{slug}/) 생성에 사용한다.
export const CATEGORY_SLUGS: Record<string, string> = {
	'식품': 'food',
	'디지털/가전': 'digital',
	'패션잡화': 'fashion-acc',
	'패션의류': 'fashion',
	'여가/생활편의': 'leisure',
	'생활/건강': 'living',
	'화장품/미용': 'beauty',
	'스포츠/레저': 'sports',
	'가구/인테리어': 'interior',
	'출산/육아': 'baby',
};

export const ETC_SLUG = 'etc';
export const ETC_NAME = '기타';

const SLUG_TO_NAME: Record<string, string> = Object.fromEntries(
	Object.entries(CATEGORY_SLUGS).map(([name, slug]) => [slug, name]),
);
SLUG_TO_NAME[ETC_SLUG] = ETC_NAME;

// 카테고리 문자열 → 최상위 분류명 (알 수 없으면 '기타')
export function topCategory(category?: string): string {
	if (!category) return ETC_NAME;
	const top = category.split('>')[0]?.trim();
	return top && CATEGORY_SLUGS[top] ? top : ETC_NAME;
}

// 카테고리 문자열 → 최상위 분류 슬러그
export function categorySlug(category?: string): string {
	const top = topCategory(category);
	return CATEGORY_SLUGS[top] ?? ETC_SLUG;
}

// 슬러그 → 분류명
export function nameFromSlug(slug: string): string {
	return SLUG_TO_NAME[slug] ?? ETC_NAME;
}

export interface CategoryGroup {
	name: string;
	slug: string;
	count: number;
	posts: CollectionEntry<'blog'>[];
}

// 글 모음을 최상위 분류별로 묶어 글 많은 순으로 반환
export function categoryList(posts: CollectionEntry<'blog'>[]): CategoryGroup[] {
	const map = new Map<string, CollectionEntry<'blog'>[]>();
	for (const p of posts) {
		const top = topCategory(p.data.category);
		if (!map.has(top)) map.set(top, []);
		map.get(top)!.push(p);
	}
	return [...map.entries()]
		.map(([name, items]) => ({
			name,
			slug: CATEGORY_SLUGS[name] ?? ETC_SLUG,
			count: items.length,
			posts: items.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()),
		}))
		.sort((a, b) => b.count - a.count);
}
