// 가이드 내부 링크 (2026-11-10). 가이드 페이지에 메뉴 말고는 링크가 없었고, 상품 글은 같은 분류 가이드 중 최신 1개만 가리켜 세부 가이드 대부분이 글에서 받는 링크가 0이었다.
//   최신 글에만 링크가 몰리지 않도록, 같은 조건의 후보 안에서는 id 해시로 고르게 나눈다(빌드마다 결과가 같다).
import type { CollectionEntry } from 'astro:content';
import { getGuides, getPosts } from './site';
import { listed } from './pruned';
import { subPath, topCategory } from './categories';

type Guide = CollectionEntry<'guides'>;
type Post = CollectionEntry<'blog'>;

const RELATED_LIMIT = 6;
const compact = (s: unknown) => String(s ?? '').replace(/\s+/g, '');
const hash = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.codePointAt(0)!) >>> 0; return h; };
const byPairHash = <T extends { id: string }>(seed: string, items: T[]) => [...items].sort((a, b) => hash(seed + a.id) - hash(seed + b.id));
const pidOf = (p: Post): string | undefined => p.data.productId ?? p.id.match(/-(\d{6,})-\d{8}$/)?.[1];
const leafOf = (category: string) => compact(category.split('>').pop());

function buildIndex(guides: Guide[], posts: Post[]) {
	const postByPid = new Map<string, Post>();
	const postsByCat = new Map<string, Post[]>();
	for (const p of listed(posts)) {
		const pid = pidOf(p);
		if (pid && !postByPid.has(pid)) postByPid.set(pid, p);
		const parts = String(p.data.category || '').split('>').map((x) => x.trim()).filter(Boolean);
		for (let i = 1; i <= parts.length; i++) {
			const key = parts.slice(0, i).join('>');
			const list = postsByCat.get(key) ?? [];
			list.push(p);
			postsByCat.set(key, list);
		}
	}
	return { guides, postByPid, postsByCat };
}

let indexPromise: Promise<ReturnType<typeof buildIndex>> | null = null;
const getIndex = () => (indexPromise ??= Promise.all([getGuides(), getPosts()]).then(([g, p]) => buildIndex(g, p)));

/** 상품 글에서 가리킬 가이드 1개. 상품명에 세부 검색어의 수식어가 있으면 그 가이드를 우선한다. */
export async function guideForPost(post: Post): Promise<Guide | null> {
	const { guides } = await getIndex();
	const cat = String(post.data.category || '');
	const matches = guides.filter((g) => cat === g.data.category || cat.startsWith(g.data.category + '>'));
	if (!matches.length) return null;
	const name = compact(post.data.productName || post.data.title);
	const specific = matches.filter((g) => {
		const q = compact(g.data.query);
		const leaf = leafOf(g.data.category);
		const mod = q.replace(leaf, '');
		return q !== leaf && q.includes(leaf) && mod.length >= 2 && name.includes(mod);
	});
	const pool = specific.length ? specific : matches;
	return pool[hash(post.id) % pool.length];
}

/** 가이드 아래에 보여 줄 다른 가이드: 같은 세부 분류 → 같은 2단계 분류 → 같은 대분류 */
export async function relatedGuides(guide: Guide): Promise<Guide[]> {
	const { guides } = await getIndex();
	const others = guides.filter((g) => g.id !== guide.id);
	const sub = subPath(guide.data.category);
	const top = topCategory(guide.data.category);
	const tier = (g: Guide) => (g.data.category === guide.data.category ? 0 : sub && subPath(g.data.category) === sub ? 1 : topCategory(g.data.category) === top ? 2 : 3);
	return byPairHash(guide.id, others.filter((g) => tier(g) < 3)).sort((a, b) => tier(a) - tier(b)).slice(0, RELATED_LIMIT);
}

/** 가이드 아래에 보여 줄 상품 글: 가이드에 실린 상품의 글 → 같은 분류의 다른 글 */
export async function postsForGuide(guide: Guide): Promise<Post[]> {
	const { postByPid, postsByCat } = await getIndex();
	const own = guide.data.products.map((p) => postByPid.get(String(p.productId))).filter((p): p is Post => !!p);
	const seen = new Set(own.map((p) => p.id));
	const rest = byPairHash(guide.id, (postsByCat.get(guide.data.category) ?? []).filter((p) => !seen.has(p.id)));
	return [...new Map([...own, ...rest].map((p) => [p.id, p])).values()].slice(0, RELATED_LIMIT);
}
