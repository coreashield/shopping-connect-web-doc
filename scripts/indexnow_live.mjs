#!/usr/bin/env node
// 라이브 사이트맵에서 최근 수정된 URL 을 읽어 IndexNow 로 제출한다 (네이버·Bing 등).
//   네이버 수집 로봇은 하루 50~150페이지만 방문한다(서치어드바이저 수집 현황, 2026-10).
//   약 4,900페이지 중 신규·변경분을 먼저 알려야 노출이 앞당겨진다.
//   scripts/indexnow.mjs 는 dist 사이트맵을 읽어 수동 제출용이고, 이쪽은 CI 가 배포 후 매일 돌린다.
//
// 사용법:
//   node scripts/indexnow_live.mjs                      # 3개 호스트, 최근 2일
//   node scripts/indexnow_live.mjs --days 7 --dry       # 목록만 출력
//   node scripts/indexnow_live.mjs --hosts shopping-log.com

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINTS = ['https://api.indexnow.org/indexnow', 'https://searchadvisor.naver.com/indexnow'];
const BATCH = 500;

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const dry = argv.includes('--dry');
const days = Number(flag('--days', '2'));
const hosts = (flag('--hosts', 'shopping-log.com,digital.shopping-log.com,food.shopping-log.com')).split(',');

function findKey() {
	const dir = path.join(ROOT, 'public');
	const f = fs.readdirSync(dir).find((n) => /^[0-9a-f]{32}\.txt$/.test(n));
	if (!f) throw new Error('public/ 에 IndexNow 키 파일이 없다');
	const key = fs.readFileSync(path.join(dir, f), 'utf8').trim();
	if (key !== path.basename(f, '.txt')) throw new Error(`키 파일 이름과 내용이 다르다: ${f}`);
	return key;
}

// KST 기준 N일 전 날짜(YYYY-MM-DD). 사이트맵 lastmod 도 KST 날짜다.
function sinceDate(n) {
	const d = new Date(Date.now() + 9 * 3600e3 - n * 86400e3);
	return d.toISOString().slice(0, 10);
}

async function text(url) {
	const r = await fetch(url);
	if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
	return r.text();
}

async function recentUrls(host, since) {
	const idx = await text(`https://${host}/sitemap-index.xml`);
	const maps = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
	const out = [];
	for (const m of maps) {
		const xml = await text(m);
		for (const u of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)) {
			if (u[2] && u[2].slice(0, 10) >= since && new URL(u[1]).host === host) out.push(u[1]);
		}
	}
	return [...new Set(out)];
}

const key = findKey();
const since = sinceDate(days);
let failed = false;
for (const host of hosts) {
	const urls = await recentUrls(host, since);
	console.log(`${host}: lastmod >= ${since} → ${urls.length}건`);
	if (!urls.length || dry) { if (dry) urls.slice(0, 5).forEach((u) => console.log('  ' + u)); continue; }
	for (const ep of ENDPOINTS) {
		for (let i = 0; i < urls.length; i += BATCH) {
			const res = await fetch(ep, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json; charset=utf-8' },
				body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList: urls.slice(i, i + BATCH) }),
			});
			console.log(`  ${new URL(ep).host} ${i} → ${res.status}`);
			if (res.status >= 400 && res.status !== 429) failed = true; // 429 는 다음 날 재시도
		}
	}
}
if (failed) process.exit(1);
