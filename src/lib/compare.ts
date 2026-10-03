// 같은 분류 가격 비교 — 렌더 시점 생성 (2026-09-28)
//   글 본문은 판매 페이지를 풀어 쓴 내용이라 페이지마다 고유한 사실이 없었다(구글 "크롤링됨-미색인", AI 인용 0).
//   사이트가 이미 가진 실데이터(같은 분류 상품들의 판매가·판매처·평점·가격 확인일)로
//   "이 상품이 같은 분류에서 어느 가격대인가"를 계산해 요약 문장과 비교표로 보여 준다.
//   추정·보정 없음. 가격 없는 글·판매 종료 글은 비교에서 뺀다.
import type { CollectionEntry } from 'astro:content';

type Post = CollectionEntry<'blog'>;

export interface CompareRow {
	id: string;
	name: string;
	store?: string;
	price: number;
	rating?: number;
	checkedAt?: string;
	current: boolean;
	buyHref?: string;     // 다른 상품 행의 구매 링크(/go/ 추적) — "이 상품이 안 맞으면" 다른 선택지로 바로 (10/3)
}

export interface Comparison {
	label: string;        // 비교 기준 분류명 (카테고리 경로 마지막 단계)
	groupSize: number;    // 그 분류의 비교 가능한 상품 수
	rank: number;         // 판매가 낮은 순 순위 (1 = 최저가)
	median: number;
	min: number;
	max: number;
	rows: CompareRow[];   // 이 글 + 가격이 가까운 상품들, 가격 오름차순
	sentence: string;
}

const MIN_GROUP = 4;   // 이보다 작은 분류는 한 단계 위로 올린다
const TABLE_ROWS = 5;

const pidOf = (p: Post): string => p.data.productId ?? p.id.match(/-(\d{6,})-\d{8}$/)?.[1] ?? p.id;
const priced = (p: Post) => (p.data.productPrice ?? 0) > 0 && p.data.saleStatus !== 'discontinued';
const levels = (category?: string) => (category || '').split('>').map((s) => s.trim()).filter(Boolean);
const keyAt = (category: string | undefined, depth: number) => levels(category).slice(0, depth).join('>');
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

// 빌드 한 번에 글 목록은 같으므로 분류별 묶음을 캐시한다 (글 수² 순회 방지)
let cacheKey = '';
let groups = new Map<string, Post[]>();

function buildGroups(posts: Post[]) {
	// getPosts() 는 호출마다 새 배열을 돌려주므로 배열 동일성 대신 내용 요약으로 캐시를 판정한다
	const key = `${posts.length}:${posts[0]?.id}:${posts[posts.length - 1]?.id}`;
	if (cacheKey === key) return;
	cacheKey = key;
	groups = new Map();
	// 같은 상품 글이 여러 개면 최신 글 하나만 남긴다 (canonical 과 같은 기준)
	const latest = new Map<string, Post>();
	for (const p of posts) {
		if (!priced(p)) continue;
		const k = pidOf(p);
		const prev = latest.get(k);
		if (!prev || p.data.pubDate.valueOf() > prev.data.pubDate.valueOf()) latest.set(k, p);
	}
	for (const p of latest.values()) {
		const lv = levels(p.data.category);
		for (let d = 2; d <= lv.length; d++) {
			const k = keyAt(p.data.category, d);
			if (!groups.has(k)) groups.set(k, []);
			groups.get(k)!.push(p);
		}
	}
}

function shortName(p: Post): string {
	const raw = (p.data.productName || p.data.title).replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
	return raw.length > 42 ? `${raw.slice(0, 40).trim()}…` : raw;
}

/** 이 글의 같은 분류 가격 비교. 비교할 상품이 부족하면 null */
export function compareForPost(post: Post, posts: Post[]): Comparison | null {
	if (!priced(post)) return null;
	buildGroups(posts);
	const lv = levels(post.data.category);
	const myPid = pidOf(post);
	// 가장 좁은 분류부터 올라가며 비교 대상이 MIN_GROUP 개 이상인 곳을 쓴다
	for (let d = lv.length; d >= 2; d--) {
		const members = (groups.get(keyAt(post.data.category, d)) ?? []).filter((p) => pidOf(p) !== myPid);
		if (members.length + 1 < MIN_GROUP) continue;

		const price = post.data.productPrice!;
		const all = [...members.map((p) => p.data.productPrice!), price].sort((a, b) => a - b);
		const rank = all.indexOf(price) + 1;
		const median = all[Math.floor(all.length / 2)];
		const label = lv[d - 1];

		// 표에 넣을 상품: 세부 분류가 더 많이 겹치는 상품 우선(행거 글이면 같은 "수납가구" 안에서도 행거 먼저),
		//   같으면 가격이 가까운 순(로그 비율 — 1만원대와 100만원대가 섞인 분류에서도 비슷한 가격대끼리 묶인다)
		const shared = (p: Post) => {
			const o = levels(p.data.category);
			let i = 0;
			while (i < lv.length && i < o.length && lv[i] === o[i]) i++;
			return i;
		};
		const dist = (p: Post) => Math.abs(Math.log(p.data.productPrice! / price));
		const near = [...members]
			.sort((a, b) => shared(b) - shared(a) || dist(a) - dist(b))
			.slice(0, TABLE_ROWS - 1);
		const toRow = (p: Post, current: boolean): CompareRow => ({
			id: p.id, name: shortName(p), store: p.data.productStore, price: p.data.productPrice!,
			// 가격 확인일이 없으면 가격을 가져온 시점인 수정일·발행일 (요약 문장의 기준 연월과 같은 규칙)
			rating: p.data.rating, checkedAt: p.data.priceCheckedAt ?? isoDay(p.data.updatedDate ?? p.data.pubDate), current,
			buyHref: !current && p.data.affiliateUrl
				? `/go/${encodeURIComponent(pidOf(p))}?u=${encodeURIComponent(p.data.affiliateUrl)}`
				: undefined,
		});
		const rows = [toRow(post, true), ...near.map((p) => toRow(p, false))].sort((a, b) => a.price - b.price);

		const diff = median ? Math.round(((price - median) / median) * 100) : 0;
		const vsMedian = diff === 0 ? '중간값과 같다' : `중간값 ${won(median)}보다 ${Math.abs(diff)}% ${diff < 0 ? '낮다' : '높다'}`;
		const sentence = `쇼핑로그가 정리한 ${label} 상품 ${all.length}개 중 판매가가 ${rank}번째로 낮고, ${vsMedian}(최저 ${won(all[0])}, 최고 ${won(all[all.length - 1])}).`;

		return { label, groupSize: all.length, rank, median, min: all[0], max: all[all.length - 1], rows, sentence };
	}
	return null;
}
