#!/usr/bin/env node
// 라이브 사이트맵에서 최근 수정된 URL 을 읽어 IndexNow 로 제출한다 (네이버·Bing 등).
//   네이버 수집 로봇은 하루 50~150페이지만 방문한다(서치어드바이저 수집 현황, 2026-10).
//   약 4,900페이지 중 신규·변경분을 먼저 알려야 노출이 앞당겨진다.
//   scripts/indexnow.mjs 는 dist 사이트맵을 읽어 수동 제출용이고, 이쪽은 CI 가 배포 후 매일 돌린다.
//   2026-11-20 OPS-06: 한 사이트 실패로 전체가 실패하지 않게 격리(아래 "실패 격리" 주석).
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
const hosts = (flag('--hosts', 'shopping-log.com,digital.shopping-log.com,food.shopping-log.com,style.shopping-log.com,family.shopping-log.com,life.shopping-log.com')).split(',');

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

// 실패 격리 (OPS-06, 2026-11-20 PM 결재·dev-engineer 구현):
//   11/11~ style 한 곳의 api.indexnow.org 403 때문에 매일 전체 exit 1 → 네이버 200 인 날도 빨간 불.
//   호스트·요청 단위로 결과를 모으고, 실패는 ::warning:: 으로 남긴다.
//   exit 1 은 (a) searchadvisor.naver.com 제출 실패가 하나라도 있을 때 (b) api.indexnow.org 가 시도한 모든 호스트에서 실패했을 때만.
//   제출 대상 URL·엔드포인트·건수·순서는 이전과 같다(MKT-01 네이버 시험 중이라 바꾸지 않음).
const NAVER_EP_HOST = 'searchadvisor.naver.com';
const INDEXNOW_EP_HOST = 'api.indexnow.org';
const isFail = (status) => status === 'error' || (status >= 400 && status !== 429); // 429 는 다음 날 재시도

// results: [{ host, ep, status }] (ep 는 엔드포인트 호스트 또는 'sitemap', status 는 HTTP 코드 또는 'error')
function judge(results) {
	const failures = results.filter((r) => isFail(r.status));
	const naverFailed = failures.some((r) => r.ep === NAVER_EP_HOST);
	const tried = new Set(results.filter((r) => r.ep === INDEXNOW_EP_HOST).map((r) => r.host));
	const failedHosts = new Set(failures.filter((r) => r.ep === INDEXNOW_EP_HOST).map((r) => r.host));
	const indexnowAllFailed = tried.size > 0 && [...tried].every((h) => failedHosts.has(h));
	return { failures, naverFailed, indexnowAllFailed, exitCode: naverFailed || indexnowAllFailed ? 1 : 0 };
}

function warn(host, ep, status, detail = '') {
	console.log(`::warning::IndexNow ${host} ${ep} → ${status}${detail ? ' ' + detail : ''}`);
}

const key = findKey();
const since = sinceDate(days);
const results = [];
for (const host of hosts) {
	try {
		const urls = await recentUrls(host, since);
		console.log(`${host}: lastmod >= ${since} → ${urls.length}건`);
		if (!urls.length || dry) { if (dry) urls.slice(0, 5).forEach((u) => console.log('  ' + u)); continue; }
		for (const ep of ENDPOINTS) {
			const epHost = new URL(ep).host;
			for (let i = 0; i < urls.length; i += BATCH) {
				// 요청 하나의 예외가 같은 호스트의 다음 엔드포인트(네이버) 제출을 막지 않도록 요청 단위로 잡는다.
				let status;
				try {
					const res = await fetch(ep, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json; charset=utf-8' },
						body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList: urls.slice(i, i + BATCH) }),
					});
					status = res.status;
					console.log(`  ${epHost} ${i} → ${status}`);
				} catch (e) {
					status = 'error';
					console.log(`  ${epHost} ${i} → 예외 ${e.message}`);
				}
				results.push({ host, ep: epHost, status });
				if (isFail(status)) warn(host, epHost, status);
			}
		}
	} catch (e) {
		// 사이트맵 읽기 실패 등: 이 호스트만 건너뛴다.
		results.push({ host, ep: 'sitemap', status: 'error' });
		warn(host, 'sitemap', 'error', e.message);
	}
}

const { failures, naverFailed, indexnowAllFailed, exitCode } = judge(results);
const failList = failures.map((r) => `${r.host}/${r.ep}:${r.status}`).join(', ');
console.log(`요약: 요청 ${results.filter((r) => r.ep !== 'sitemap').length}건, 실패 ${failures.length}건${failList ? ` (${failList})` : ''}`
	+ `${naverFailed ? ' — 네이버 제출 실패' : ''}${indexnowAllFailed ? ' — api.indexnow.org 전 호스트 실패' : ''} → exit ${exitCode}`);
process.exit(exitCode);
