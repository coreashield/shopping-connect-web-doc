// 노출 판정용 표본 검사 — 공개 상품 N개를 "상품명 앞 4단어 + 후기"로 네이버 모바일 통합검색(로그인 없음)해서
//   review.shopping-log.com / review101.kr / shopping-log.com 이 결과 화면에 있는지 센다. (10/21 review101 실측: 12개 중 9개)
//   node --env-file=<.env> review_site/scripts/exposure_probe.mjs [--n 30]
//   8~12초 간격·실행당 60회 상한 (10/6 대표 PC IP 403 교훈). 결과는 review_site/exposure_log.csv 에 누적.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { SUPABASE_URL: SB, SUPABASE_SERVICE_KEY: SK } = process.env;
const ni = process.argv.indexOf('--n');
const N = Math.min(60, Number(ni > 0 ? process.argv[ni + 1] : 30) || 30);
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const { headers } = await fetch(`${SB}/rest/v1/product_pages?published=eq.true&select=product_id&limit=1`, { headers: { apikey: SK, Authorization: `Bearer ${SK}`, Prefer: 'count=exact' } });
const total = Number(headers.get('content-range').split('/')[1]);
const picks = [];
for (let k = 0; k < N; k++) {
  const off = Math.floor(Math.random() * total);
  const [row] = await (await fetch(`${SB}/rest/v1/product_pages?published=eq.true&select=product_id,name&order=product_id&offset=${off}&limit=1`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } })).json();
  if (row) picks.push(row);
}

const hits = { review: 0, review101: 0, main: 0 };
for (const [k, p] of picks.entries()) {
  const q = `${p.name.split(/\s+/).slice(0, 4).join(' ')} 후기`;
  const r = await fetch(`https://m.search.naver.com/search.naver?query=${encodeURIComponent(q)}`, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR' } });
  if (r.status !== 200) { console.log(`중단: 네이버 ${r.status}`); break; }
  const h = await r.text();
  const has = { review: h.includes('review.shopping-log.com'), review101: h.includes('review101.kr'), main: /[^.]shopping-log\.com/.test(h.replace(/review\.shopping-log\.com/g, '')) };
  for (const key of Object.keys(hits)) if (has[key]) hits[key]++;
  console.log(`${has.review ? 'O' : '-'} ${has.review101 ? 'R' : '-'} ${q}`);
  if (k < picks.length - 1) await new Promise((res) => setTimeout(res, 8000 + Math.random() * 4000));
}
const line = `${new Date().toISOString().slice(0, 10)},${picks.length},${hits.review},${hits.review101},${hits.main}`;
console.log(`표본 ${picks.length}: 우리 리뷰 ${hits.review} · review101 ${hits.review101} · 본사이트 ${hits.main}`);
const csv = path.join(HERE, '../exposure_log.csv');
if (!fs.existsSync(csv)) fs.writeFileSync(csv, 'date,n,review_site,review101,shopping_log\n');
fs.appendFileSync(csv, line + '\n');
