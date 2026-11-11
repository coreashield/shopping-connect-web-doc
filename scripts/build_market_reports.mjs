// 분류별 가격·리뷰 데이터 리포트 생성기 (2026-11-11, 구글 색인 시험)
//   구글이 상품 소개 글·가이드를 "크롤링됨 – 색인 안 됨"으로 탈락시키는 상태라,
//   우리만 가진 집계 데이터(상품 3.7만 개의 가격·리뷰 + 실제 판매 기록)로 만든 페이지가 색인되는지 본다.
//   숫자는 전부 이 스크립트가 계산한다(AI 가 숫자를 만들지 않는다). 해석 문단만 src/data/market_notes.json 에 사람이 쓴다.
//
//   node --env-file=<SUPABASE_URL·SUPABASE_SERVICE_KEY 있는 .env> scripts/build_market_reports.mjs [--list] [--since 2026-09-01]
//     --list : 후보 분류만 출력하고 끝낸다
//   출력: src/data/market_reports.json  (src/pages/data/ 가 읽는다)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'src', 'data', 'market_reports.json');
const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SB || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SINCE = arg('--since', '2026-09-01');   // 이 날짜 이후 가격을 확인한 상품만 쓴다
const LIST_ONLY = process.argv.includes('--list');
const MIN_N = 40;
const PER_TOP = 4;      // 대분류당 최대 리포트 수
const TOTAL = 24;

// 리포트로 만들 분류(상품 수·판매 기록·대분류 고른 분포로 고른 뒤 고정). 비어 있으면 자동 선택.
const NOTES = (() => { try { return JSON.parse(fs.readFileSync(path.join(HERE, '..', 'src', 'data', 'market_notes.json'), 'utf8')); } catch { return {}; } })();
const PINNED = NOTES.order || [];
const NAMES = NOTES.names || {};

async function page(table, cols, order) {
	let all = [];
	for (let i = 0; ; i += 1000) {
		const r = await fetch(`${SB}/rest/v1/${table}?select=${cols}&order=${order}&offset=${i}&limit=1000`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
		if (!r.ok) throw new Error(`${table} ${r.status} ${await r.text()}`);
		const d = await r.json();
		all = all.concat(d);
		if (d.length < 1000) break;
	}
	return all;
}

const q = (sorted, p) => { if (!sorted.length) return null; const i = (sorted.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)); };
const med = (a) => q([...a].sort((x, y) => x - y), 0.5);
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const rank = (a) => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = avg; i = j + 1; } return r; };
const spearman = (x, y) => { const rx = rank(x), ry = rank(y); const n = x.length; const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; } return sxx && syy ? Math.round((sxy / Math.sqrt(sxx * syy)) * 100) / 100 : 0; };
const nice = (v) => { if (!(v > 0)) return 1; const p = 10 ** Math.floor(Math.log10(v)); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
const slugify = (s) => s.replace(/[\/\s]+/g, '-').replace(/[^0-9A-Za-z가-힣-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');

const SKIP_SPEC = /원산지|모델명|제조사|수량|품명|인증|문의|A\/S|전화|주의|제조연월|제조일|유통기한|사용기한|소비기한|수입자|판매자|책임자|보증|출시|상품번호|브랜드|상세|참조|KC|식품의 유형|보관|반품|배송/;
const normSpec = (v) => String(v).replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();

function build(cat, items, sales) {
	const rows = items.map((p) => ({ id: p.product_id, name: p.name, price: p.data.price, orig: p.data.orig, rating: p.data.rating, reviews: p.data.reviews ?? p.review_count ?? 0, store: p.data.store || '', spec: p.data.spec || [], checkedAt: p.data.checkedAt }));
	const prices = rows.map((r) => r.price).sort((a, b) => a - b);
	const n = rows.length;
	const st = { n, min: prices[0], p25: q(prices, 0.25), median: q(prices, 0.5), p75: q(prices, 0.75), max: prices[n - 1], mean: Math.round(prices.reduce((a, b) => a + b, 0) / n) };

	// 가격 분포: 최저 ~ 95% 지점을 7칸으로, 그 위는 한 칸
	const p95 = q(prices, 0.95);
	const step = nice((p95 - st.min) / 6) || 1;
	const base = Math.floor(st.min / step) * step;
	const bins = [];
	const NB = Math.min(9, Math.max(3, Math.ceil((p95 - base) / step)));
	for (let i = 0; i < NB; i++) bins.push({ from: base + step * i, to: base + step * (i + 1), n: 0 });
	const over = { from: base + step * NB, to: null, n: 0 };
	for (const v of prices) { const i = Math.floor((v - base) / step); if (i >= NB) over.n++; else bins[Math.max(0, i)].n++; }
	if (over.n) bins.push(over);

	// 할인 표시
	const disc = rows.filter((r) => r.orig && r.orig > r.price).map((r) => Math.round((1 - r.price / r.orig) * 100));
	const discount = { share: pct(disc.length, n), median: disc.length ? med(disc) : null, over30: pct(disc.filter((d) => d >= 30).length, n) };

	// 평점·리뷰
	const rated = rows.filter((r) => typeof r.rating === 'number' && r.rating > 0);
	const revs = rows.map((r) => r.reviews).sort((a, b) => b - a);
	const totalRev = revs.reduce((a, b) => a + b, 0);
	const topK = Math.max(1, Math.round(n * 0.1));
	const review = { total: totalRev, median: med(revs), top10Share: pct(revs.slice(0, topK).reduce((a, b) => a + b, 0), totalRev), top10N: topK, under10: pct(rows.filter((r) => r.reviews < 10).length, n) };
	const rating = { n: rated.length, median: rated.length ? Math.round(med(rated.map((r) => r.rating * 10)) ) / 10 : null, share48: pct(rated.filter((r) => r.rating >= 4.8).length, rated.length) };

	// 가격대 3등분(상품 수 기준)별 리뷰·평점
	const byPrice = [...rows].sort((a, b) => a.price - b.price);
	const third = Math.floor(n / 3);
	const tierOf = new Map();
	const tiers = [['저가', 0, third], ['중간', third, n - third], ['고가', n - third, n]].map(([label, a, b]) => {
		const part = byPrice.slice(a, b);
		for (const r of part) tierOf.set(r.id, label);
		const rr = part.filter((r) => typeof r.rating === 'number' && r.rating > 0);
		return { label, n: part.length, from: part[0].price, to: part[part.length - 1].price, medianReviews: med(part.map((r) => r.reviews)), reviewShare: pct(part.reduce((s, r) => s + r.reviews, 0), totalRev), medianRating: rr.length ? Math.round(med(rr.map((r) => r.rating * 10))) / 10 : null, sold: 0 };
	});
	const corr = spearman(rows.map((r) => r.price), rows.map((r) => r.reviews));

	// 판매처 집중도
	const stores = new Map();
	for (const r of rows) { const s = stores.get(r.store) || { store: r.store, n: 0, reviews: 0 }; s.n++; s.reviews += r.reviews; stores.set(r.store, s); }
	const storeTop = [...stores.values()].filter((s) => s.store).sort((a, b) => b.reviews - a.reviews).slice(0, 5).map((s) => ({ ...s, reviewShare: pct(s.reviews, totalRev) }));

	// 규격 항목별 가격(같은 항목이 상품의 35% 이상에 있고, 값이 2~6종으로 모일 때만)
	const specKeys = new Map();
	for (const r of rows) { const seen = new Set(); for (const [k, v] of r.spec) { if (!k || !v || SKIP_SPEC.test(k) || seen.has(k)) continue; seen.add(k); const val = normSpec(v); if (!val || val.length > 14) continue; if (!specKeys.has(k)) specKeys.set(k, new Map()); const m = specKeys.get(k); if (!m.has(val)) m.set(val, []); m.get(val).push(r.price); } }
	const specs = [];
	for (const [k, m] of specKeys) {
		const have = [...m.values()].reduce((a, b) => a + b.length, 0);
		if (have < n * 0.35) continue;
		const vals = [...m.entries()].filter(([, a]) => a.length >= Math.max(4, n * 0.05)).sort((a, b) => b[1].length - a[1].length).slice(0, 6);
		const covered = vals.reduce((a, [, b]) => a + b.length, 0);
		if (vals.length < 2 || covered < have * 0.6) continue;
		specs.push({ key: k, have, values: vals.map(([v, a]) => ({ value: v, n: a.length, share: pct(a.length, have), median: med(a) })) });
	}
	specs.sort((a, b) => b.have - a.have);

	// 실제 판매(우리 링크 경유) — 수량만 쓴다. 금액은 싣지 않는다.
	const ids = new Set(rows.map((r) => r.id));
	const my = sales.filter((s) => ids.has(String(s.product_id)));
	let sold = null;
	const units = my.reduce((a, s) => a + (s.sales_qty || 0), 0);
	if (units >= 8) {
		const soldBy = new Map();
		for (const s of my) { const t = tierOf.get(String(s.product_id)); const tr = tiers.find((x) => x.label === t); if (tr) tr.sold += s.sales_qty || 0; soldBy.set(String(s.product_id), (soldBy.get(String(s.product_id)) || 0) + (s.sales_qty || 0)); }
		const days = my.map((s) => s.sale_date).sort();
		const soldPrices = []; for (const [id, u] of soldBy) { const r = rows.find((x) => x.id === id); for (let i = 0; i < u; i++) soldPrices.push(r.price); }
		sold = { units, items: soldBy.size, from: days[0], to: days[days.length - 1], medianPrice: med(soldPrices), belowMedianShare: pct(soldPrices.filter((v) => v <= st.median).length, soldPrices.length),
			top: [...soldBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, u]) => { const r = rows.find((x) => x.id === id); return { id, name: r.name, price: r.price, reviews: r.reviews, rating: r.rating ?? null, tier: tierOf.get(id), share: pct(u, units) }; }) };
	}

	const top = [...rows].sort((a, b) => b.reviews - a.reviews).slice(0, 10).map((r) => ({ id: r.id, name: r.name, price: r.price, orig: r.orig && r.orig > r.price ? r.orig : null, rating: r.rating ?? null, reviews: r.reviews, store: r.store, tier: tierOf.get(r.id), pricePct: Math.round((prices.filter((v) => v < r.price).length / n) * 100) }));
	const checked = rows.map((r) => r.checkedAt).filter(Boolean).sort();
	const parts = cat.split('>').map((s) => s.trim());
	const leaf = NAMES[cat] || parts[parts.length - 1];
	return { slug: `${slugify(leaf)}-가격`, leaf, category: cat, top: parts[0], checkedFrom: checked[0], checkedTo: checked[checked.length - 1], price: st, bins, binStep: step, discount, rating, review, tiers, corr, stores: storeTop, storeCount: stores.size, specs: specs.slice(0, 2), sold, products: top };
}

const pages = (await page('product_pages', 'product_id,published,cat_path,name,review_count,data', 'product_id')).filter((p) => p.published && p.data && p.data.price > 0 && (p.data.checkedAt || '') >= SINCE);
const sales = await page('sales', 'sale_date,product_id,sales_qty', 'id');
const byPid = new Map(pages.map((p) => [p.product_id, p]));
const byCat = new Map();
for (const p of pages) { if (!byCat.has(p.cat_path)) byCat.set(p.cat_path, []); byCat.get(p.cat_path).push(p); }
const soldByCat = new Map();
for (const s of sales) { const p = byPid.get(String(s.product_id)); if (p) soldByCat.set(p.cat_path, (soldByCat.get(p.cat_path) || 0) + (s.sales_qty || 0)); }

let chosen;
if (PINNED.length && !LIST_ONLY) {
	chosen = PINNED.filter((c) => byCat.has(c));
} else {
	const cand = [...byCat.entries()].filter(([c, a]) => a.length >= MIN_N && !/기타|여가\/생활편의|도서/.test(c)).map(([c, a]) => ({ c, n: a.length, sold: soldByCat.get(c) || 0 })).sort((a, b) => (b.sold - a.sold) || (b.n - a.n));
	const perTop = new Map(); chosen = [];
	for (const x of cand) { const t = x.c.split('>')[0]; if ((perTop.get(t) || 0) >= PER_TOP) continue; perTop.set(t, (perTop.get(t) || 0) + 1); chosen.push(x.c); if (chosen.length >= TOTAL) break; }
	if (LIST_ONLY) { console.log(`대상 상품 ${pages.length} (가격 확인 ${SINCE} 이후) · 분류 ${byCat.size} · 상품 ${MIN_N}+ 분류 ${cand.length}`); for (const c of chosen) console.log(`${c} | 상품 ${byCat.get(c).length} · 판매 ${soldByCat.get(c) || 0}`); process.exit(0); }
}

const reports = chosen.map((c) => build(c, byCat.get(c), sales));
fs.writeFileSync(OUT, JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), since: SINCE, universe: pages.length, reports }, null, '\t'));
console.log(`리포트 ${reports.length}개 → ${path.relative(process.cwd(), OUT)}`);
for (const r of reports) console.log(`${r.slug} | n ${r.price.n} · 중앙 ${r.price.median} · 상관 ${r.corr} · 상위10% 리뷰 ${r.review.top10Share}% · 판매 ${r.sold ? r.sold.units : '-'} · 규격 ${r.specs.map((s) => s.key).join(',') || '-'}`);
