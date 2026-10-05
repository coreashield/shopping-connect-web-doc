// @ts-check

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import remarkDiscontinued from './src/lib/remark-discontinued.mjs';
import remarkFaq from './src/lib/remark-faq.mjs';
import remarkBuyLinkRel from './src/lib/remark-buy-link-rel.mjs';
import remarkAltLink from './src/lib/remark-alt-link.mjs';
import remarkFitBox from './src/lib/remark-fit-box.mjs';
import remarkDisclosure from './src/lib/remark-disclosure.mjs';
import remarkImagePerf from './src/lib/remark-image-perf.mjs';

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
	const B = SITE_BASE;
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
		map.set(`${B}/blog/${slug}/`, iso);

		// 글이 추가·수정되면 이 글이 실리는 집계 페이지도 함께 바뀐다 → 같은 날짜를 물려준다.
		bump(`${B}/`, iso);
		bump(`${B}/blog/`, iso);
		bump(`${B}/category/`, iso);

		const category = head.match(/^category:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
		const top = topCategoryOf(category);
		// 호스트 필터: 서브 빌드는 해당 카테고리만, 본체는 분리 카테고리 제외
		if (SITE_CATEGORY_ENV ? top !== SITE_CATEGORY_ENV : SUB_CATEGORIES.includes(top)) continue;
		bump(`${B}/category/${top ? CATEGORY_SLUGS[top] : ETC_SLUG}/`, iso);

		// categories.ts의 topicHubs는 대분류가 미등록이어도 허브를 만든다(etc로 폴백).
		//   예: '도서>만화>…' → etc-만화. 여기서도 동일하게 처리해야 슬러그가 일치한다.
		const parts = category?.split('>').map((s) => s.trim()).filter(Boolean) ?? [];
		if (parts.length >= 2) {
			const key = `${parts[0]}>${parts[1]}`;
			topicCount.set(key, (topicCount.get(key) ?? 0) + 1);
			bump(`${B}/topic/${CATEGORY_SLUGS[parts[0]] ?? ETC_SLUG}-${topicSlugify(parts[1])}/`, iso);
		}
	}
	// 15건 미만 토픽은 허브가 만들어지지 않으므로 사이트맵에도 없다 — 남겨둬도 매칭되지 않을 뿐이다.
	for (const [url, iso] of newest) map.set(url, iso);
	return map;
}
// 같은 상품 중복 글 사이트맵 제외 (2026-10-05 기술 진단: 표본 60개 중 22%가 최신 형제 글을 canonical 로
//   가리키는데 사이트맵엔 그대로 남아 "색인해라/하지 마라" 신호가 엇갈렸다. 약 600+ URL).
//   src/pages/blog/[...slug].astro 의 대표 글 선택과 **같은 규칙**: productId(없으면 파일명 cat-pid-YYYYMMDD) 묶음에서
//   pubDate 최신 → 동률이면 id 사전순 첫 번째. 대표가 아닌 글만 뺀다(페이지·canonical 은 그대로).
//   301 은 _redirects 가 Pages 한도(2,000줄) 직전(1,872)이라 하지 않는다.
function buildNonCanonicalSet() {
	const B = SITE_BASE;
	const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src/content/blog');
	const groups = new Map();
	let files = [];
	try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') || f.endsWith('.mdx')); } catch { return new Set(); }
	for (const file of files) {
		const head = fs.readFileSync(path.join(dir, file), 'utf8').slice(0, 2000);
		const id = file.replace(/\.mdx?$/, '');
		const category = head.match(/^category:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
		const top = topCategoryOf(category);
		if (SITE_CATEGORY_ENV ? top !== SITE_CATEGORY_ENV : SUB_CATEGORIES.includes(top)) continue;
		const pid = head.match(/^productId:\s*"?([^"\n]+)"?/m)?.[1]?.trim() || id.match(/-(\d{6,})-\d{8}$/)?.[1];
		const pub = Date.parse(head.match(/^pubDate:\s*"?([^"\n]+)"?/m)?.[1]?.trim() || '');
		if (!pid || !Number.isFinite(pub)) continue;
		if (!groups.has(pid)) groups.set(pid, []);
		groups.get(pid).push({ id, pub });
	}
	const out = new Set();
	for (const list of groups.values()) {
		if (list.length < 2) continue;
		list.sort((a, b) => (b.pub - a.pub) || a.id.localeCompare(b.id));
		for (const x of list.slice(1)) out.add(`${B}/blog/${x.id}/`);
	}
	return out;
}
const SITE_URL_ENV = (process.env.SITE_URL || '').trim();
const SITE_CATEGORY_ENV = (process.env.SITE_CATEGORY || '').trim();
const SUB_CATEGORIES = ['디지털/가전', '식품'];   // src/lib/site.ts SUB_SITES 와 동일하게 유지
const SUB_HOSTS = { '디지털/가전': 'https://digital.shopping-log.com', '식품': 'https://food.shopping-log.com' };
const SITE_BASE = SITE_URL_ENV || (SITE_CATEGORY_ENV ? SUB_HOSTS[SITE_CATEGORY_ENV] : 'https://shopping-log.com');
const LASTMOD = buildLastmodMap();
const NON_CANONICAL = buildNonCanonicalSet();

// https://astro.build/config
export default defineConfig({
	site: SITE_BASE,
	markdown: {
		// 대가성 고지에서 쓰지 않는 쿠팡파트너스 언급 정정 (src/lib/remark-disclosure.mjs, 10/5)
		// 판매 종료 글의 본문 구매 링크 제거 (src/lib/remark-discontinued.mjs)
		// FAQ 섹션을 H2 + 질문별 H3 로 (src/lib/remark-faq.mjs)
		// 본문 구매 링크에 rel=nofollow sponsored (src/lib/remark-buy-link-rel.mjs)
		remarkPlugins: [remarkDisclosure, remarkImagePerf, remarkDiscontinued, remarkFaq, remarkBuyLinkRel, remarkAltLink, remarkFitBox],
	},
	integrations: [
		mdx(),
		sitemap({
			// /blog/2/ 이후 페이지네이션은 2026-09-10부터 noindex 다. 색인하지 말라고
			//   해놓고 사이트맵으로 제출하면 서로 어긋난 신호라 여기서도 뺀다.
			//   /blog/ 1페이지는 슬러그에 숫자가 없어 그대로 남는다.
			filter: (page) => !/\/blog\/\d+\/?$/.test(page) && !NON_CANONICAL.has(page),
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
