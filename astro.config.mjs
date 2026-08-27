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
function buildLastmodMap() {
	const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src/content/blog');
	const map = new Map();
	let files = [];
	try {
		files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
	} catch {
		return map; // 콘텐츠 디렉터리가 없으면 lastmod 없이 진행(빌드는 깨뜨리지 않는다)
	}
	for (const file of files) {
		const head = fs.readFileSync(path.join(dir, file), 'utf8').slice(0, 2000);
		const pick = (key) => head.match(new RegExp(`^${key}:\\s*"?([0-9]{4}-[0-9]{2}-[0-9]{2})`, 'm'))?.[1];
		const date = pick('updatedDate') || pick('pubDate');
		if (!date) continue;
		const slug = file.replace(/\.mdx?$/, '');
		map.set(`https://shopping-log.com/blog/${slug}/`, new Date(`${date}T00:00:00Z`).toISOString());
	}
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
				const lastmod = LASTMOD.get(item.url);
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
