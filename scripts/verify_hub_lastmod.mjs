#!/usr/bin/env node
/**
 * verify_hub_lastmod.mjs — 사이트맵 lastmod 정합성 검증 (빌드 후 실행)
 *
 * astro.config.mjs는 astro:content를 읽을 수 없어 src/lib/categories.ts의 슬러그
 * 로직을 복제하고 있다. 복제본이 원본과 어긋나면 허브 lastmod가 존재하지 않는 URL에
 * 붙거나(무시됨) 엉뚱한 허브에 붙는다. 둘 다 조용히 실패하므로 여기서 잡는다.
 *
 * 검사 항목
 *   1. 사이트맵의 모든 <loc>이 dist에 실제 파일로 존재하는가
 *   2. 집계 페이지(홈·/blog/·/category/*·/topic/*)에 lastmod가 붙었는가
 *   3. lastmod가 미래 날짜가 아닌가
 *
 * Usage: node scripts/verify_hub_lastmod.mjs   (exit 1 = 실패)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const sitemapPath = path.join(dist, 'sitemap-0.xml');

if (!fs.existsSync(sitemapPath)) {
	console.error('✗ dist/sitemap-0.xml 없음 — 먼저 npm run build 실행');
	process.exit(1);
}

const xml = fs.readFileSync(sitemapPath, 'utf8');
const entries = [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)]
	.map((m) => ({ url: m[1], lastmod: m[2] }));

const ORIGIN = 'https://shopping-log.com';
// 한글 슬러그(토픽 허브)는 사이트맵에 퍼센트 인코딩되어 있으나 디스크에는 한글 그대로다.
const toFile = (url) => {
	let p = url.replace(ORIGIN, '').replace(/^\//, '');
	try {
		p = decodeURI(p);
	} catch {
		/* 디코딩 실패 시 원본 경로로 검사 */
	}
	return path.join(dist, p, 'index.html');
};

const missingFile = [];
const hubsNoLastmod = [];
const future = [];
const tomorrow = new Date(Date.now() + 86400000).toISOString();

for (const e of entries) {
	if (!fs.existsSync(toFile(e.url))) missingFile.push(e.url);

	const p = e.url.replace(ORIGIN, '');
	const isAggregate = p === '/' || p === '/blog/' || /^\/(category|topic)\//.test(p);
	if (isAggregate && !e.lastmod) hubsNoLastmod.push(e.url);

	if (e.lastmod && e.lastmod > tomorrow) future.push(`${e.url} (${e.lastmod})`);
}

const withLastmod = entries.filter((e) => e.lastmod).length;
console.log(`사이트맵 URL:      ${entries.length}`);
console.log(`lastmod 보유:      ${withLastmod}`);
console.log(`lastmod 없음:      ${entries.length - withLastmod}`);

let failed = false;
const report = (label, list, limit = 10) => {
	if (!list.length) return;
	failed = true;
	console.error(`\n✗ ${label}: ${list.length}건`);
	for (const x of list.slice(0, limit)) console.error(`    ${x}`);
	if (list.length > limit) console.error(`    ... 외 ${list.length - limit}건`);
};

report('사이트맵에 있으나 dist에 파일 없음', missingFile);
report('집계 페이지인데 lastmod 누락 (슬러그 복제본 불일치 의심)', hubsNoLastmod);
report('미래 날짜 lastmod', future);

if (failed) process.exit(1);
console.log('\n✓ 정합성 통과 — 모든 URL이 dist에 존재하고 집계 페이지에 lastmod가 붙었다');
