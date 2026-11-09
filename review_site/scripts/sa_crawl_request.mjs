// 네이버 서치어드바이저 웹 페이지 수집 요청 — review.shopping-log.com (하루 한도 50).
//   대표가 Aside 에 직접 로그인한 세션을 쓴다(자동 로그인 없음). 라이브 repo tools/naver_sa_aside.mjs 와 같은 방식.
//   순서: 분류(2단계까지·상품 5+) → 상품(리뷰 많은 순). 제출 기록 review_site/sa_submitted.json.
//   node --env-file=<.env> review_site/scripts/sa_crawl_request.mjs [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = 'review.shopping-log.com';
const DONE_PATH = path.join(HERE, '../sa_submitted.json');
const CATS_PATH = path.join(HERE, '../public/_data/cats.json');
const DAILY_LIMIT = 50;
const MAX_CALLS = 8;
const DRY = process.argv.includes('--dry-run');
const ASIDE = process.env.ASIDE_CLI || path.join(process.env.LOCALAPPDATA || '', 'Aside', 'CLI', 'current', 'aside.exe');
const { SUPABASE_URL: SB, SUPABASE_SERVICE_KEY: SK } = process.env;
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const seg = (c) => encodeURIComponent(String(c).replace(/\//g, '·'));

async function queueAll(done) {
  // 11/9: 하루 50건 한도로 3.6만 상품을 다 못 보낸다(약 2년) → 돈이 될 상품부터.
  //   순서 = 홈 → 판매 이력 상품(누적 수익 큰 순) → 수수료 1,000원+ 상품(수수료 × 리뷰 수 로그) → 분류 → 나머지(리뷰 많은 순).
  //   분류 페이지를 뒤로 뺀 이유: 30일 노출 40,520·클릭 33(CTR 0.08%)로 상품 페이지(0.34%)보다 클릭이 안 난다.
  const { tree } = JSON.parse(fs.readFileSync(CATS_PATH, 'utf8'));
  const cats = [];
  for (const [c1, v1] of Object.entries(tree).sort((a, b) => b[1].n - a[1].n)) {
    if (v1.n >= 5) cats.push(`https://${SITE}/c/${seg(c1)}/`);
    for (const [c2, v2] of Object.entries(v1.k).sort((a, b) => b[1].n - a[1].n)) if (v2.n >= 5) cats.push(`https://${SITE}/c/${seg(c1)}/${seg(c2)}/`);
  }
  const pages = await sbAll('product_pages', 'published=eq.true&select=product_id,review_count&order=product_id');
  const sold = new Map();
  for (const x of await sbAll('sales', 'select=product_id,expected_profit&order=id')) sold.set(String(x.product_id), (sold.get(String(x.product_id)) || 0) + (Number(x.expected_profit) || 0));
  const fee = new Map();
  for (const x of await sbAll('products', 'status=eq.ON&select=product_id,price_numeric,commission_numeric&order=product_id')) {
    fee.set(String(x.product_id), (Number(x.price_numeric) || 0) * (x.commission_numeric == null ? 5 : Number(x.commission_numeric)) / 100);
  }
  const url = (id) => `https://${SITE}/p/${id}/`;
  const scored = pages.map((x) => ({ id: String(x.product_id), reviews: Number(x.review_count) || 0, fee: fee.get(String(x.product_id)) || 0, profit: sold.get(String(x.product_id)) }));
  const tierSold = scored.filter((x) => x.profit !== undefined).sort((a, b) => b.profit - a.profit);
  const tierFee = scored.filter((x) => x.profit === undefined && x.fee >= 1000).sort((a, b) => b.fee * Math.log1p(b.reviews) - a.fee * Math.log1p(a.reviews));
  const tierRest = scored.filter((x) => x.profit === undefined && x.fee < 1000).sort((a, b) => b.reviews - a.reviews);
  const urls = [`https://${SITE}/`, ...tierSold.map((x) => url(x.id)), ...tierFee.map((x) => url(x.id)), ...cats, ...tierRest.map((x) => url(x.id))];
  return urls.filter((u) => !done[u]);
}

/** Supabase REST 전체 페이지 조회 — 실패하면 빈 결과로 넘어가지 않고 멈춘다(순서가 조용히 틀어지는 것 방지) */
async function sbAll(table, query) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SB}/rest/v1/${table}?${query}`, { headers: { apikey: SK, Authorization: `Bearer ${SK}`, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`${table} 조회 실패 HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

function runAside(code) {
  return new Promise((resolve) => {
    const p = spawn(ASIDE, ['repl', code], { windowsHide: true });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('error', (e) => resolve({ out: `spawn error: ${e.message}`, code: -1 }));
    p.on('close', (c) => resolve({ out, code: c }));
  });
}

// aside repl 안에서 도는 코드 — 제출 판정은 "수집 요청 내역" 맨 위 행이 바뀌었는지로(경고창 없음 = 성공 오판 방지).
//   이 화면은 내역 표가 제출 직후 갱신되지 않을 때가 있어, 판정이 안 나면 새로고침해 한 번 더 본다.
function replCode(queue, budgetMs) {
  return `
const QUEUE = ${JSON.stringify(queue)};
const res = { results: [], state: 'ok' };
const top = async (pg) => (await pg.evaluate(() => (document.body.innerText.match(/수집 요청 내역[\\s\\S]*?\\n(\\/[^\\n]*)\\n/) || [])[1] || null));
const pg = await openTab('https://searchadvisor.naver.com/console/site/request/crawl?site=' + encodeURIComponent('https://${SITE}'));
const arm = () => pg.evaluate(() => { window.__m = []; window.alert = (m) => window.__m.push(String(m)); window.confirm = (m) => { window.__m.push(String(m)); return true; }; });
try {
  await sleep(3000);
  // 11/8: 세션 만료 때 주소는 그대로, 제목 "로그인 - …"·본문 "접근권한이 없습니다"만 뜬다 → 로그인 풀림으로 본다.
  const outPage = await pg.evaluate(() => /^로그인/.test(document.title) || /접근권한이 없습니다/.test(document.body.innerText)).catch(() => false);
  if (!pg.url().includes('searchadvisor.naver.com/console') || outPage) {
    res.state = 'not_logged_in';
    res.url = '서치어드바이저 로그인 풀림 → 대표가 Aside에서 네이버 직접 로그인 필요';
  }
  else {
    await snapshot(pg, { interactive: true });
    await arm();
    const t0 = Date.now();
    for (const url of QUEUE) {
      if (Date.now() - t0 > ${budgetMs}) { res.state = 'budget'; break; }
      const p = new URL(url).pathname;
      const before = await top(pg);
      const inp = pg.locator('main input[type=text], main input:not([type])').first();
      await inp.click(); await inp.press('Control+A'); await inp.press('Backspace');
      await inp.pressSequentially(url, { delay: 5 });
      await pg.locator('button:has-text("확인")').first().click();
      let r = { url, status: 'unknown' };
      for (let t = 0; t < 8; t++) {
        await sleep(600);
        const msgs = await pg.evaluate(() => window.__m || []);
        if (msgs.length) { r = { url, status: /한도|초과/.test(msgs[0]) ? 'limit' : /이미|중복/.test(msgs[0]) ? 'dup' : 'msg', msg: msgs[0] }; break; }
        const now = await top(pg);
        if (now && now !== before && decodeURIComponent(p) === decodeURIComponent(now)) { r = { url, status: 'ok' }; break; }
      }
      if (r.status === 'unknown') {
        await pg.reload(); await sleep(3000); await snapshot(pg, { interactive: true }); await arm();
        const now = await top(pg);
        if (now && decodeURIComponent(now) === decodeURIComponent(p)) r = { url, status: 'ok' };
      }
      res.results.push(r);
      if (r.status === 'limit') { res.state = 'limit'; break; }
      if (r.status !== 'ok' && r.status !== 'dup') { res.state = 'error'; break; }
      await pg.evaluate(() => { window.__m = []; });
      await sleep(1200);
    }
  }
} catch (e) { res.state = 'exception'; res.error = String(e && e.message || e).slice(0, 300); }
await closeTab(pg).catch(() => {});
console.log('__SA_RESULT__' + JSON.stringify(res));
`;
}

const done = JSON.parse(fs.existsSync(DONE_PATH) ? fs.readFileSync(DONE_PATH, 'utf8') : '{}');
const doneToday = Object.values(done).filter((d) => d === today).length;
let queue = await queueAll(done);
let budget = Math.max(0, DAILY_LIMIT - doneToday);
console.log(`📋 ${SITE}: 미요청 대기 ${queue.length}+ · 오늘 남은 한도 ${budget}`);
if (DRY) { queue.slice(0, budget || DAILY_LIMIT).forEach((u) => console.log('  - ' + u)); process.exit(0); }

let ok = 0, state = 'ok', note = '';
for (let call = 0; call < MAX_CALLS && budget > 0 && queue.length; call++) {
  const { out, code } = await runAside(replCode(queue.slice(0, budget), 80000));
  const line = out.split(/\r?\n/).find((l) => l.startsWith('__SA_RESULT__'));
  if (!line) { state = 'aside_fail'; note = `Aside 실행 실패(exit ${code}): ${out.trim().slice(0, 200)}`; break; }
  const res = JSON.parse(line.slice('__SA_RESULT__'.length));
  for (const r of res.results) if (r.status === 'ok' || r.status === 'dup') { done[r.url] = today; if (r.status === 'ok') { ok++; budget--; } }
  fs.writeFileSync(DONE_PATH, JSON.stringify(done, null, 1));
  const handled = new Set(res.results.filter((r) => r.status === 'ok' || r.status === 'dup').map((r) => r.url));
  queue = queue.filter((u) => !handled.has(u));
  state = res.state;
  console.log(`  call ${call + 1}: state=${res.state} 제출 ${ok} 남은 한도 ${budget}`);
  if (['not_logged_in', 'limit', 'error', 'exception'].includes(res.state)) { note = res.error || res.results.at(-1)?.msg || res.url || ''; break; }
}
console.log(`📨 ${today} review 수집 요청 ${ok}건 · 상태 ${state}${note ? ' — ' + note : ''} · 누적 ${Object.keys(done).length}`);
process.exit(state === 'not_logged_in' || state === 'aside_fail' ? 2 : 0);
