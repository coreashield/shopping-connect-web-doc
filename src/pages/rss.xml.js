import { getPosts } from '../lib/site';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

// 네이버 서치어드바이저는 RSS 를 "중요한 콘텐츠만, 본문 크기에 따라 제한"으로 받는다(RSS 제출 도움말).
// 전체 글(3천여 개, 1.2MB)을 정렬 없이 담으면 새 글이 뒤에 묻혀 수집되지 않는다 → 최신 수정순 150개만 담는다.
const MAX_ITEMS = 150;

export async function GET(context) {
	const posts = await getPosts();
	const stamp = (p) => (p.data.updatedDate ?? p.data.pubDate).valueOf();
	const newest = posts.sort((a, b) => stamp(b) - stamp(a)).slice(0, MAX_ITEMS);
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: newest.map((post) => ({
			...post.data,
			link: `/blog/${post.id}/`,
		})),
	});
}
