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

// ── 토픽 클러스터 허브 (2026-07-18) ──
// 2026 SEO: 구글은 "콘텐츠 클러스터 단위"로 전문성 평가. 상품당 1글 살포로는 어느 주제도 얕음.
// 2단계 분류(대>중, 예 "디지털/가전>계절가전")를 클러스터 허브 단위로 삼는다 — 각 15+글로 실제 깊이 확보.
// 허브는 구매검색어("계절가전 추천") 타겟 + 크롤러가 허브→글로 효율 색인하게 하는 필러 역할.

// 카테고리 경로 2단계("대>중") 추출. 2단계 없으면 null.
export function subPath(category?: string): string | null {
	if (!category) return null;
	const parts = category.split('>').map((s) => s.trim()).filter(Boolean);
	return parts.length >= 2 ? `${parts[0]}>${parts[1]}` : null;
}

// 한글 유지 슬러그 (공백·슬래시·특수문자 → 하이픈). Astro·CF는 한글 URL 정상 처리.
export function topicSlugify(s: string): string {
	return s.replace(/[\/\s]+/g, '-').replace(/[^0-9A-Za-z가-힣-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// (top, sub) → 결정적 고유 슬러그. topicHubs와 hubForPost가 동일하게 계산해야 링크가 맞는다.
export function hubSlug(top: string, sub: string): string {
	return `${CATEGORY_SLUGS[top] ?? ETC_SLUG}-${topicSlugify(sub)}`;
}

export interface TopicHub {
	sub: string;   // 중분류명 (허브 제목)
	top: string;   // 대분류명
	slug: string;
	count: number;
	posts: CollectionEntry<'blog'>[];
}

// 2단계 분류별 허브. minCount 이상만(얇은 허브 방지).
export function topicHubs(posts: CollectionEntry<'blog'>[], minCount = 15): TopicHub[] {
	const map = new Map<string, CollectionEntry<'blog'>[]>();
	for (const p of posts) {
		const key = subPath(p.data.category);
		if (!key) continue;
		if (!map.has(key)) map.set(key, []);
		map.get(key)!.push(p);
	}
	const hubs: TopicHub[] = [];
	for (const [key, items] of map) {
		if (items.length < minCount) continue;
		const [top, sub] = key.split('>');
		hubs.push({
			top, sub, slug: hubSlug(top, sub), count: items.length,
			posts: items.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()),
		});
	}
	return hubs.sort((a, b) => b.count - a.count);
}

// 특정 글이 속한 허브 (내부링크용). 없으면 null.
export function hubForPost(post: CollectionEntry<'blog'>): { sub: string; slug: string } | null {
	const key = subPath(post.data.category);
	if (!key) return null;
	const [top, sub] = key.split('>');
	return { sub, slug: hubSlug(top, sub) };
}
