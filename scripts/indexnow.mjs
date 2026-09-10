#!/usr/bin/env node
// IndexNow 제출 — Bing/Yandex/Seznam 계열 색인에 URL 변경을 즉시 알린다.
//   구글은 IndexNow를 쓰지 않는다(서치콘솔 URL 검사로 따로 요청해야 한다).
//   빙 색인은 마이크로소프트 코파일럿 답변의 인용 원천이라 AI 검색 노출에 직접 걸린다.
//
// 키 파일은 public/<key>.txt 로 이미 배포돼 있어야 한다(내용 = 키 문자열).
//   https://shopping-log.com/6e8c8bd49d205bc3313c63ef65025147.txt
//
// 사용법:
//   node scripts/indexnow.mjs <url> [<url> ...]     특정 URL만 제출
//   node scripts/indexnow.mjs --travel              /travel/ 전체 제출
//   node scripts/indexnow.mjs --since 2026-09-10    sitemap 에서 lastmod 이후 것만 제출
//   옵션: --host <도메인> (기본 shopping-log.com), --dry (전송 없이 목록만 출력)
//
// IndexNow 는 1회 요청에 최대 10,000 URL 을 받는다. 여기서는 안전하게 500개씩 끊는다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const BATCH = 500;

function findKey() {
	const dir = path.join(ROOT, 'public');
	const f = fs.readdirSync(dir).find((n) => /^[0-9a-f]{32}\.txt$/.test(n));
	if (!f) throw new Error('public/ 에 IndexNow 키 파일(<32자리 hex>.txt)이 없다');
	const key = fs.readFileSync(path.join(dir, f), 'utf8').trim();
	if (key !== path.basename(f, '.txt')) throw new Error(`키 파일 이름과 내용이 다르다: ${f}`);
	return key;
}

// dist/sitemap-*.xml 에서 URL 을 읽는다(빌드 후 실행 전제).
function sitemapUrls(host) {
	const dist = path.join(ROOT, 'dist');
	const files = fs.existsSync(dist) ? fs.readdirSync(dist).filter((f) => /^sitemap-\d+\.xml$/.test(f)) : [];
	if (!files.length) throw new Error('dist/sitemap-N.xml 이 없다 — 먼저 astro build 를 돌려라');
	const out = [];
	for (const f of files) {
		const xml = fs.readFileSync(path.join(dist, f), 'utf8');
		for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)) {
			out.push({ url: m[1], lastmod: m[2] ?? null });
		}
	}
	return out.filter((u) => u.url.includes(host));
}

async function submit(host, key, urls, dry) {
	console.log(`host=${host} key=${key.slice(0, 8)}… urls=${urls.length}`);
	for (const u of urls) console.log('  ' + u);
	if (dry) return console.log('(--dry: 전송하지 않음)');

	for (let i = 0; i < urls.length; i += BATCH) {
		const slice = urls.slice(i, i + BATCH);
		const body = {
			host,
			key,
			keyLocation: `https://${host}/${key}.txt`,
			urlList: slice,
		};
		const res = await fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=utf-8' },
			body: JSON.stringify(body),
		});
		const text = await res.text();
		// 200/202 = 접수. 400 형식오류, 403 키 불일치, 422 host 불일치, 429 과다요청.
		console.log(`  → ${res.status} ${res.statusText} ${text ? text.slice(0, 200) : ''}`.trimEnd());
		if (res.status >= 400) process.exitCode = 1;
	}
}

const argv = process.argv.slice(2);
const flag = (name, def = null) => {
	const i = argv.indexOf(name);
	return i >= 0 ? (argv[i + 1] ?? true) : def;
};
const host = flag('--host', 'shopping-log.com');
const dry = argv.includes('--dry');
const key = findKey();

let urls;
if (argv.includes('--travel')) {
	urls = sitemapUrls(host).map((u) => u.url).filter((u) => /\/travel\//.test(u) || u.endsWith('/travel/'));
} else if (flag('--since')) {
	const since = String(flag('--since'));
	urls = sitemapUrls(host).filter((u) => u.lastmod && u.lastmod.slice(0, 10) >= since).map((u) => u.url);
} else {
	urls = argv.filter((a) => a.startsWith('http'));
}

if (!urls.length) {
	console.error('제출할 URL 이 없다. 사용법은 파일 상단 주석 참고.');
	process.exit(1);
}
await submit(host, key, urls, dry);
