// IndexNow 제출 — 공개 상품 페이지·분류 주소를 api.indexnow.org 로 (네이버·빙 공유).
//   node review_site/scripts/indexnow.mjs [--since YYYY-MM-DD]  : built_at 이 since 이후인 공개 페이지만 (기본 전체)
//   키 파일: review_site/public/<key>.txt (scripts/indexnow_key.txt 와 같은 값)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KEY = fs.readFileSync(path.join(HERE, 'indexnow_key.txt'), 'utf8').trim();
const HOST = 'review.shopping-log.com';
const { SUPABASE_URL: SB, SUPABASE_SERVICE_KEY: SK } = process.env;
const i = process.argv.indexOf('--since');
const since = i > 0 ? process.argv[i + 1] : null;

const urls = [`https://${HOST}/`];
for (let from = 0; ; from += 1000) {
  const q = `product_pages?published=eq.true&select=product_id${since ? `&built_at=gte.${since}` : ''}&order=product_id`;
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: { apikey: SK, Authorization: `Bearer ${SK}`, Range: `${from}-${from + 999}` } });
  const rows = await r.json();
  for (const x of rows) urls.push(`https://${HOST}/p/${x.product_id}/`);
  if (rows.length < 1000) break;
}
for (const ep of ['https://api.indexnow.org/indexnow', 'https://searchadvisor.naver.com/indexnow']) for (let j = 0; j < urls.length; j += 10000) {
  const r = await fetch(ep, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls.slice(j, j + 10000) }),
  });
  console.log(`IndexNow ${new URL(ep).host} ${Math.min(j + 10000, urls.length)}/${urls.length} → ${r.status}`);
}
