// Cloudflare 함수(Workers·Pages Functions) 오늘 사용량 확인 — 무료 한도 하루 10만(계정 전체 공유, UTC 0시=한국 9시 초기화).
//   사용량이 경고선(기본 9만)을 넘으면 텔레그램 보고 봇으로 알린다. 하루 한 번만 알린다(같은 날 중복 방지 파일).
//   필요 권한: API 토큰에 "Account Analytics: Read". 없으면 권한 없음으로 끝난다.
//   실행: node review_site/scripts/cf_usage_check.mjs [--warn 90000] [--print]
//   env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID (packages/.env), TELEGRAM_TOKEN_REPORT|TELEGRAM_TOKEN, TELEGRAM_CHAT_ID (라이브 클론 .env)
import fs from 'node:fs';
import path from 'node:path';

const LIMIT = 100000;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const WARN = Number(arg('--warn', 90000));
const PRINT = process.argv.includes('--print');

// .env 두 곳에서 필요한 값만 읽는다(이미 있는 환경변수가 우선)
for (const f of ['D:/shopping_connect/packages/.env', 'F:/기타/새 폴더/shopping_connect/.env']) {
	if (!fs.existsSync(f)) continue;
	for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
		const m = line.match(/^(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|TELEGRAM_TOKEN_REPORT|TELEGRAM_TOKEN|TELEGRAM_CHAT_ID)=(.*)$/);
		if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
	}
}
const { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT } = process.env;

const day = new Date().toISOString().slice(0, 10);   // UTC 날짜 = 한도 기준일
const query = `{viewer{accounts(filter:{accountTag:"${ACCOUNT}"}){workersInvocationsAdaptive(limit:100,filter:{date:"${day}"}){sum{requests} dimensions{scriptName}}}}}`;
const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
	method: 'POST',
	headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
	body: JSON.stringify({ query }),
});
const j = await res.json();
if (j.errors?.length) {
	console.error(`[cf_usage] 조회 실패: ${j.errors[0].message}`);
	process.exit(1);
}
const rows = j.data.viewer.accounts[0]?.workersInvocationsAdaptive ?? [];
const by = {};
for (const r of rows) by[r.dimensions.scriptName] = (by[r.dimensions.scriptName] ?? 0) + r.sum.requests;
const total = Object.values(by).reduce((a, b) => a + b, 0);
const detail = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toLocaleString()}`).join(', ');
const line = `[cf_usage] ${day}(UTC) ${total.toLocaleString()} / ${LIMIT.toLocaleString()} (${Math.round((total / LIMIT) * 100)}%) — ${detail || '사용 없음'}`;
console.log(line);
if (PRINT || total < WARN) process.exit(0);

const flag = path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), `.cf_usage_alerted_${day}`);
if (fs.existsSync(flag)) process.exit(0);
const TG = process.env.TELEGRAM_TOKEN_REPORT || process.env.TELEGRAM_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
if (!TG || !CHAT) { console.error('[cf_usage] 텔레그램 설정 없음'); process.exit(1); }
const text = `⚠️ Cloudflare 함수 하루 한도 ${Math.round((total / LIMIT) * 100)}% 사용 (${total.toLocaleString()} / 10만)\n`
	+ `한도가 차면 한국시간 오전 9시까지 리뷰 사이트(review.shopping-log.com)가 안 열립니다. 구매 버튼은 영향 없음.\n${detail}`;
const tr = await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ chat_id: CHAT, text }),
});
if (tr.ok) fs.writeFileSync(flag, line);
else console.error(`[cf_usage] 텔레그램 실패 ${tr.status}`);
