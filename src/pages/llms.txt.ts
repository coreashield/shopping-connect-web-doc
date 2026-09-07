import type { APIRoute } from 'astro';
import { getGuides, getPosts } from '../lib/site';
import { categoryList, topicHubs } from '../lib/categories';
import { ORGANIZATION_SAME_AS, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '../consts';

// /llms.txt — 비Google AI 크롤러용 사이트 안내 (GEO 2026-09-07).
//   Google 검색은 이 파일을 무시한다고 명시했으므로 순위 레버가 아니라 "사이트 지도 요약"으로만 쓴다.
//   빌드 시 정적 생성되며 토픽 허브·카테고리·최신 글을 실데이터에서 뽑는다(추정치 없음).
const won = (n: number) => n.toLocaleString('ko-KR') + '원';
// 주격 조사 (서브사이트 제목 '쇼핑로그 식품' → '은')
const eunNeun = (w: string) => {
	const c = w.charCodeAt(w.length - 1);
	return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0 ? '은' : '는';
};

export const GET: APIRoute = async () => {
	const posts = (await getPosts()).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
	const hubs = topicHubs(posts, 15);
	const cats = categoryList(posts);
	const guides = await getGuides();
	const today = new Date().toISOString().slice(0, 10);

	const hubLines = hubs.map((h) => {
		const prices = h.posts.map((p) => p.data.productPrice ?? 0).filter((n) => n > 0).sort((a, b) => a - b);
		const range = prices.length ? ` ${won(prices[0])}~${won(prices[prices.length - 1])}, ` : ' ';
		const stores = new Set(h.posts.map((p) => p.data.productStore).filter(Boolean)).size;
		return `- [${h.sub} 추천 ${h.count}선 가격 비교](${SITE_URL}/topic/${encodeURI(h.slug)}/):${range}판매처 ${stores}곳`;
	});
	const catLines = cats.map((c) => `- [${c.name} 추천 모음 (${c.count}개)](${SITE_URL}/category/${c.slug}/)`);
	const recent = posts.slice(0, 20).map((p) => `- [${p.data.title}](${SITE_URL}/blog/${p.id}/): ${p.data.pubDate.toISOString().slice(0, 10)}`);

	const body = [
		`# ${SITE_TITLE} (${SITE_URL.replace('https://', '')})`,
		`> ${SITE_DESCRIPTION}`,
		'',
		`${SITE_TITLE}${eunNeun(SITE_TITLE)} 네이버 스마트스토어 상품을 카테고리·주제별로 가격 비교하고 구매 전 확인할 정보를 정리하는 한국어 쇼핑 정보 사이트다. 동명의 캐시백 앱(shoppinglog.store)과는 관계가 없다.`,
		`글 ${posts.length}개, 주제별 가격 비교 허브 ${hubs.length}개, 비교 가이드 ${guides.length}개, 카테고리 ${cats.length}개. 갱신 ${today}.`,
		'',
		'## 사이트 안내',
		`- [소개·작성 기준](${SITE_URL}/about/): 데이터 출처, 가격 기준, 제휴 고지`,
		`- [전체 글](${SITE_URL}/blog/)`,
		`- [RSS](${SITE_URL}/rss.xml)`,
		`- [사이트맵](${SITE_URL}/sitemap-index.xml)`,
		'',
		'## 주제별 가격 비교 허브',
		...hubLines,
		'',
		'## 카테고리',
		...catLines,
		...(guides.length ? ['', '## 비교 가이드', ...guides.map((g) => `- [${g.data.title}](${SITE_URL}/guide/${g.id}/): ${g.data.query} 상품 ${g.data.products.length}개 비교`)] : []),
		'',
		'## 최근 글',
		...recent,
		'',
		'## 데이터 기준',
		'- 가격·판매처·평점은 각 글 발행 시점의 네이버 스마트스토어 표시값이며 본문에 기준 연월을 적는다.',
		'- 각 글에는 상품 정의·가격·장점·추천 대상을 담은 요약 문단(summary)과 자주 묻는 질문이 있다.',
		'- 구매 링크는 네이버 쇼핑커넥트 제휴 링크이며 모든 글 상단에 대가성을 고지한다.',
		...(ORGANIZATION_SAME_AS.length ? ['', '## 공식 채널', ...ORGANIZATION_SAME_AS.map((u) => `- ${u}`)] : []),
		'',
	].join('\n');

	return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
