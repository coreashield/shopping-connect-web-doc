// @ts-check

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// 사이트맵 <lastmod>용 URL→최종수정일 맵.
// 글이 재발행·수정되는 사이트라 lastmod가 없으면 구글이 재크롤 우선순위를 못 정한다.
// 콘텐츠 컬렉션을 config에서 못 읽으므로 md 프론트매터를 직접 훑는다.
// ⚠️ 아래 슬러그 로직은 src/lib/categories.ts와 반드시 동일해야 한다.
//    config는 astro:content를 못 읽어 부득이 복제했다. 어긋나면 허브 lastmod가 엉뚱한
//    URL에 붙는다 — 빌드 후 scripts/verify_hub_lastmod.mjs가 dist와 대조해 검증한다.
const CATEGORY_SLUGS = {
	'식품': 'food', '디지털/가전': 'digital', '패션잡화': 'fashion-acc',
	'패션의류': 'fashion', '여가/생활편의': 'leisure', '생활/건강': 'living',
	'화장품/미용': 'beauty', '스포츠/레저': 'sports', '가구/인테리어': 'interior',
	'출산/육아': 'baby',
};
const ETC_SLUG = 'etc';
const topCategoryOf = (c) => {
	const top = c?.split('>')[0]?.trim();
	return top && CATEGORY_SLUGS[top] ? top : null;
};
const topicSlugify = (s) =>
	s.replace(/[\/\s]+/g, '-').replace(/[^0-9A-Za-z가-힣-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');

function buildLastmodMap() {
	const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src/content/blog');
	const map = new Map();
	let files = [];
	try {
		files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
	} catch {
		return map; // 콘텐츠 디렉터리가 없으면 lastmod 없이 진행(빌드는 깨뜨리지 않는다)
	}
	const newest = new Map(); // 집계 URL → 최신 글 날짜
	const bump = (url, iso) => {
		const cur = newest.get(url);
		if (!cur || iso > cur) newest.set(url, iso);
	};
	const topicCount = new Map(); // "대>중" → 글 수 (허브는 15건 이상만 생성됨)

	for (const file of files) {
		const head = fs.readFileSync(path.join(dir, file), 'utf8').slice(0, 2000);
		const pick = (key) => head.match(new RegExp(`^${key}:\\s*"?([0-9]{4}-[0-9]{2}-[0-9]{2})`, 'm'))?.[1];
		const date = pick('updatedDate') || pick('pubDate');
		if (!date) continue;
		const iso = new Date(`${date}T00:00:00Z`).toISOString();
		const slug = file.replace(/\.mdx?$/, '');
		map.set(`https://shopping-log.com/blog/${slug}/`, iso);

		// 글이 추가·수정되면 이 글이 실리는 집계 페이지도 함께 바뀐다 → 같은 날짜를 물려준다.
		bump('https://shopping-log.com/', iso);
		bump('https://shopping-log.com/blog/', iso);
		bump('https://shopping-log.com/category/', iso);

		const category = head.match(/^category:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
		const top = topCategoryOf(category);
		bump(`https://shopping-log.com/category/${top ? CATEGORY_SLUGS[top] : ETC_SLUG}/`, iso);

		// categories.ts의 topicHubs는 대분류가 미등록이어도 허브를 만든다(etc로 폴백).
		//   예: '도서>만화>…' → etc-만화. 여기서도 동일하게 처리해야 슬러그가 일치한다.
		const parts = category?.split('>').map((s) => s.trim()).filter(Boolean) ?? [];
		if (parts.length >= 2) {
			const key = `${parts[0]}>${parts[1]}`;
			topicCount.set(key, (topicCount.get(key) ?? 0) + 1);
			bump(`https://shopping-log.com/topic/${CATEGORY_SLUGS[parts[0]] ?? ETC_SLUG}-${topicSlugify(parts[1])}/`, iso);
		}
	}
	// 15건 미만 토픽은 허브가 만들어지지 않으므로 사이트맵에도 없다 — 남겨둬도 매칭되지 않을 뿐이다.
	for (const [url, iso] of newest) map.set(url, iso);
	return map;
}
const LASTMOD = buildLastmodMap();

// https://astro.build/config
export default defineConfig({
	site: 'https://shopping-log.com',
	integrations: [
		mdx(),
		sitemap({
			serialize(item) {
				// 토픽 허브 슬러그는 한글이라 사이트맵에 퍼센트 인코딩되어 들어온다.
				//   맵 키는 디코딩된 한글이므로 양쪽 다 시도해야 매칭된다.
				let lastmod = LASTMOD.get(item.url);
				if (!lastmod) {
					try {
						lastmod = LASTMOD.get(decodeURI(item.url));
					} catch {
						/* 잘못된 인코딩이면 lastmod 없이 통과 */
					}
				}
				if (lastmod) item.lastmod = lastmod;
				return item;
			},
		}),
	],
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
