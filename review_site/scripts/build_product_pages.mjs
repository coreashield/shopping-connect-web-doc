// review.shopping-log.com 상품 데이터 페이지 생성기 (2026-10-21).
//   판매중(products.status='ON') 상품 → product_pages 한 행씩. 페이지 HTML 은 Pages Function 이 이 행으로 그린다.
//   글을 지어내지 않는다: 가격·평점·리뷰 수·리뷰 속성 비율·스펙·같은 분류 가격 위치만으로 문장을 만든다.
//   블로그 글(web_doc src/content/blog)이 이미 있는 상품은 만들지 않는다 — 같은 상품 문서 두 개는 8/17 재발행 붕괴와 같은 중복.
//
//   node --env-file=<SUPABASE_URL·SUPABASE_SERVICE_KEY 있는 .env> review_site/scripts/build_product_pages.mjs [--publish-wave N] [--dry]
//     --publish-wave N : wave <= N 인 행을 published=true (기본 1). 물결 1=리뷰 1,000+, 2=100~999, 3=나머지.
//     --dry            : DB 쓰지 않고 집계만.
//   끝나면 review_site/public/_data/cats.json(분류 트리·개수)을 쓴다 → 배포해야 홈·분류 화면에 반영.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(HERE, '..');
const BLOG_DIR = path.resolve(SITE_DIR, '../src/content/blog');
const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const PUBLISH_WAVE = Number(argv[argv.indexOf('--publish-wave') + 1]) || 1;
if (!SB || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function fetchAllProducts() {
  const cols = 'product_id,name,store,brand,features,price_numeric,original_price,category,rating,review_count,images,detail_spec,affiliate_link,updated_at';
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SB}/rest/v1/products?select=${cols}&status=eq.ON&affiliate_link=not.is.null&order=product_id`, {
      headers: { ...H, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`products ${r.status} ${await r.text()}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

function blogProductIds() {
  const ids = new Set();
  for (const f of fs.readdirSync(BLOG_DIR)) {
    const head = fs.readFileSync(path.join(BLOG_DIR, f), 'utf8').slice(0, 3000);
    const m = head.match(/^productId:\s*"?(\d+)"?/m);
    if (m) ids.add(m[1]);
  }
  return ids;
}

// ── 정리 ────────────────────────────────────────────────
const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };

export function cleanName(name) {
  return String(name || '')
    .replace(/\[[^\]]{0,20}\]/g, ' ')          // [N배송] [공식] 같은 판매 태그
    .replace(/[★☆◆◇■□●○▶▷♥♡✔✅]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,/+-]+|[\s,/+-]+$/g, '')
    .trim();
}
// 제목용 짧은 이름: 쉼표 뒤 옵션(", 1개") 제거, 40자 이내 단어 경계
export function shortName(name) {
  let s = cleanName(name).replace(/,\s*\d+\s*(개|팩|박스|세트|입)\s*$/u, '').trim();
  if (s.length <= 40) return s;
  const cut = s.slice(0, 40);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 24)).trim();
}

// detail_spec: "키: 값" 스펙 줄 + "속성 :평가 NN%" 리뷰 속성 줄. 붙어버린 요약 줄("유통기한아주 넉넉해요포장…")은 버린다.
export function parseDetailSpec(text) {
  const spec = [], attrs = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const a = line.match(/^(.{1,12}?)\s*:\s*(.{1,20}?)\s+(\d{1,3})%$/u);
    if (a) {
      const pct = Number(a[3]);
      if (pct > 0 && pct <= 100 && !attrs.some((x) => x.label === a[1].trim())) attrs.push({ label: a[1].trim(), top: a[2].trim(), pct });
      continue;
    }
    const s = line.match(/^([^:]{1,20}):\s*(.{1,80})$/u);
    if (s && !/상세설명|상세페이지|참조|별도 표기/.test(s[2])) spec.push([s[1].trim(), s[2].trim()]);
  }
  return { spec: spec.slice(0, 12), attrs: attrs.slice(0, 6) };
}

// 사진: 스토어 로고·배너(파일명에 로고/logo/banner, 240x40 같은 크기 표기)는 뺀다. 사진 대부분이 JPEG 라 JPEG 먼저.
export function cleanImages(list) {
  const ok = (Array.isArray(list) ? list : []).filter((u) => /^https:\/\/[a-z0-9.-]*pstatic\.net\//.test(u)).filter((u) => {
    let d = u; try { d = decodeURIComponent(u); } catch { /* EUC-KR 퍼센트 인코딩 */ }
    return !/로고|logo|banner|배너|_pc[_.(]|모바일|\/\d{2,4}x\d{2,4}\./i.test(d) && !/%B7%CE%B0%ED/i.test(u);
  });
  const base = (u) => (/\/dthumb\/|\?src=/.test(u) ? u : u.replace(/\?.*$/, ''));
  const uniq = [...new Map(ok.map((u) => [base(u), base(u)])).values()];
  return [...uniq.filter((u) => /\.jpe?g$/i.test(u)), ...uniq.filter((u) => !/\.jpe?g$/i.test(u))].slice(0, 6);
}

function pctRank(sorted, v) {
  // v 보다 싼 상품 비율 (0=가장 쌈, 1=가장 비쌈)
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < v) lo = m + 1; else hi = m; }
  return sorted.length > 1 ? lo / (sorted.length - 1) : 0.5;
}
const median = (s) => (s.length ? s[Math.floor(s.length / 2)] : null);
const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const fmtN = (n) => Number(n).toLocaleString('ko-KR');

// 구매 판단 점수 (100점) — 계산식은 페이지에 그대로 공개한다
export function scoreOf({ rating, reviews, pricePct, attrs }) {
  // 평점을 모르면(정수 평점 숨김 포함) 벌점 대신 중간값 24점(60%)
  const r = rating ? Math.max(0, Math.min(1, (rating - 3.5) / 1.5)) * 40 : 24;
  const v = Math.min(1, Math.log10((reviews || 0) + 1) / 4) * 25;
  const p = pricePct == null ? 10 : (1 - pricePct) * 20;
  const a = attrs.length ? (attrs.reduce((s, x) => s + x.pct, 0) / attrs.length / 100) * 15 : (rating ? (rating / 5) * 12 : 8);
  const parts = { rating: Math.round(r), reviews: Math.round(v), price: Math.round(p), attrs: Math.round(a) };
  return { total: Math.min(100, parts.rating + parts.reviews + parts.price + parts.attrs), parts };
}
export function verdictLabel(s) {
  if (s >= 85) return '구매 고려 추천';
  if (s >= 72) return '조건이 맞으면 추천';
  if (s >= 58) return '다른 상품과 비교 후 결정';
  return '신중히 검토';
}

const CHECKS = {
  '패션의류': ['사이즈표의 실측(가슴·총장)을 갖고 있는 옷과 비교', '소재 혼용률과 세탁 방법(손세탁·드라이 여부)', '교환·반품 배송비와 가능 기간'],
  '패션잡화': ['실측 크기와 무게', '소재(천연·합성)와 관리 방법', '교환·반품 조건'],
  '화장품/미용': ['내 피부 타입과 전성분(향료·알코올 등)', '용량과 사용기한(개봉 후 기간)', '용량 1ml·1g당 가격'],
  '식품': ['소비기한과 보관 방법(냉장·냉동·실온)', '원재료·원산지와 알레르기 성분', '1개·100g당 가격'],
  '디지털/가전': ['정격 전압·소비전력과 설치 공간', 'A/S 기간과 서비스 센터', '모델명·출시 연도(구형 재고 여부)'],
  '가구/인테리어': ['실측 크기와 놓을 자리의 치수', '조립 필요 여부와 배송 방식', '소재와 마감(원목·MDF 등)'],
  '출산/육아': ['사용 가능 연령·체중', 'KC 인증과 소재', '세척·소독 방법'],
  '스포츠/레저': ['사이즈·무게와 사용 환경', '소재와 내구성', '교환·반품 조건'],
  '생활/건강': ['용량·구성(낱개 수)', '사용 방법과 주의사항', '교체·재구매 주기'],
  '여가/생활편의': ['이용 조건과 유효기간', '취소·환불 규정', '추가 비용 여부'],
};
const DEFAULT_CHECKS = ['구성(수량·옵션)이 내가 찾는 것과 같은지', '배송 방식과 도착 예정일', '교환·반품 조건'];

function buildPage(p, ctx) {
  const name = cleanName(p.name);
  const sname = shortName(p.name);
  const cats = String(p.category || '').split('>').map((s) => s.trim()).filter(Boolean);
  const leaf = cats[cats.length - 1] || '기타';
  const catPath = cats.join('>');
  const price = num(p.price_numeric);
  const orig = num(p.original_price);
  const discount = price && orig && orig > price && orig < price * 5 ? Math.round((1 - price / orig) * 100) : null;
  // 정수 평점(5·4)은 판매처 기본값 의심이 커서(10/3 실측 88%) 숨긴다 — shopping-log 카드와 같은 규칙
  const rating = p.rating && !Number.isInteger(Number(p.rating)) ? Number(p.rating) : null;
  const reviews = p.review_count ? Number(p.review_count) : 0;
  const { spec, attrs } = parseDetailSpec(p.detail_spec);
  const leafPrices = ctx.leafPrices.get(catPath) || [];
  const pricePct = price && leafPrices.length >= 5 ? pctRank(leafPrices, price) : null;
  const leafMedian = leafPrices.length >= 5 ? median(leafPrices) : null;
  const { total: score, parts } = scoreOf({ rating, reviews, pricePct, attrs });
  const brand = (p.brand || p.store || '').trim();

  const fit = [], unfit = [];
  if (pricePct != null && pricePct <= 0.33) fit.push(`가격을 먼저 보는 분 — 같은 ${leaf} ${fmtN(leafPrices.length)}개 중 싼 쪽 하위 ${Math.max(1, Math.round(pricePct * 100))}%`);
  if (rating >= 4.7 && reviews >= 300) fit.push(`검증된 상품을 원하는 분 — 리뷰 ${fmtN(reviews)}개에 평점 ${rating.toFixed(1)}`);
  for (const a of attrs) if (a.pct >= 70 && fit.length < 4) fit.push(`${a.label}을(를) 중요하게 보는 분 — 구매자 ${a.pct}%가 "${a.top}"`);
  if (discount >= 20 && fit.length < 4) fit.push(`할인 시점을 노리던 분 — 표시 정가 대비 ${discount}% 낮음`);
  if (!(rating >= 4.7) && reviews >= 1000 && fit.length < 4) fit.push(`많이 팔린 상품을 원하는 분 — 리뷰 ${fmtN(reviews)}개`);
  if (pricePct != null && pricePct > 0.33 && pricePct < 0.67 && fit.length < 4) fit.push(`가격과 평가의 균형을 보는 분 — 같은 ${leaf} 중 중간 가격대`);
  if (pricePct != null && pricePct >= 0.67) unfit.push(`가성비가 1순위인 분 — 같은 ${leaf} ${fmtN(leafPrices.length)}개 중 비싼 쪽 상위 ${Math.round((1 - pricePct) * 100) || 1}%`);
  if (reviews < 100) unfit.push(`후기가 많은 상품을 원하는 분 — 리뷰 ${fmtN(reviews)}개로 아직 적음`);
  if (rating && rating < 4.5) unfit.push(`평점을 중시하는 분 — ${rating.toFixed(1)}점이라 낮은 별점 후기를 먼저 확인`);
  for (const a of attrs) if (a.pct < 60 && unfit.length < 4) unfit.push(`${a.label}에 민감한 분 — "${a.top}" 응답이 ${a.pct}%로 평가가 갈림`);
  if (discount >= 50) unfit.push(`할인율만 보고 고르는 분 — ${discount}%는 표시 정가 기준이라 실제 시세와 다를 수 있음`);
  if (!unfit.length && pricePct != null && pricePct > 0.33) unfit.push(`최저가만 찾는 분 — 같은 분류에 더 싼 상품이 있음`);
  if (unfit.length < 2) unfit.push(`구성·옵션이 다른 제품을 찾는 분 — 아래 같은 분류 대안과 비교`);
  if (!fit.length) fit.push(`${leaf}을(를) 찾으면서 ${brand ? brand + ' 제품을' : '이 구성을'} 고려 중인 분`);

  const checks = [...(CHECKS[cats[0]] || DEFAULT_CHECKS)];
  if (price >= 100000) checks.push('10만 원 이상 — 교환·반품·A/S 조건을 결제 전에 확인');

  const pricePhrase = pricePct == null ? null
    : pricePct <= 0.33 ? `같은 분류에서 가격이 낮은 편` : pricePct >= 0.67 ? `같은 분류에서 가격이 높은 편` : `같은 분류에서 중간 가격대`;
  const summary = [
    `${brand && !sname.toLowerCase().startsWith(brand.toLowerCase()) ? brand + '의 ' : ''}${sname}.`,
    rating ? `리뷰 ${fmtN(reviews)}개 기준 평점 ${rating.toFixed(1)}점.` : null,
    pricePhrase ? `${pricePhrase}(${leaf} ${fmtN(leafPrices.length)}개 중앙값 ${won(leafMedian)}).` : null,
    attrs[0] ? `구매자 ${attrs[0].pct}%가 ${attrs[0].label} "${attrs[0].top}".` : null,
  ].filter(Boolean).join(' ');

  const faq = [];
  if (rating) faq.push({ q: `${sname} 후기 평점은 어떤가요?`, a: `판매처 기준 리뷰 ${fmtN(reviews)}개, 평점 ${rating.toFixed(1)}점입니다.${attrs.length ? ' 리뷰 항목별로는 ' + attrs.map((a) => `${a.label} "${a.top}" ${a.pct}%`).join(', ') + '입니다.' : ''}` });
  if (price && leafMedian) faq.push({ q: `${sname} 가격은 비싼 편인가요?`, a: `${won(price)}으로, 같은 ${leaf} ${fmtN(leafPrices.length)}개의 중앙값 ${won(leafMedian)} 대비 ${price <= leafMedian ? '낮거나 같은' : '높은'} 가격입니다. 가격은 판매처에서 수시로 바뀌니 구매 전 확인하세요.` });
  faq.push({ q: `사기 전에 무엇을 확인해야 하나요?`, a: checks.join(' / ') + '.' });

  const imgs = cleanImages(p.images);
  // 관련 검색어: 판매처 키워드(features) — 중복·영문 소문자 중복·브랜드 단독 제외, 12개
  const seenKw = new Set([brand.toLowerCase()]);
  const keywords = (Array.isArray(p.features) ? p.features : []).map((k) => String(k).trim())
    .filter((k) => k.length >= 2 && k.length <= 20 && !/협력사|공식|정품/.test(k) && !seenKw.has(k.toLowerCase()) && seenKw.add(k.toLowerCase())).slice(0, 12);
  return {
    product_id: String(p.product_id),
    cat1: cats[0] || '기타',
    cat_path: catPath || '기타',
    name: sname,
    score,
    review_count: reviews,
    affiliate_link: p.affiliate_link,
    wave: reviews >= ctx.wave1Min ? 1 : reviews >= 100 ? 2 : 3,
    data: {
      fullName: name, brand, store: p.store || null, cats, leaf,
      price, orig: discount ? orig : null, discount, rating, reviews,
      pricePct: pricePct == null ? null : Math.round(pricePct * 100), leafN: leafPrices.length, leafMedian,
      score, parts, label: verdictLabel(score),
      keywords, summary, fit: fit.slice(0, 4), unfit: unfit.slice(0, 4), checks, spec, attrs, faq, imgs,
      checkedAt: (p.updated_at || '').slice(0, 10),
    },
  };
}

async function upsert(rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const r = await fetch(`${SB}/rest/v1/product_pages?on_conflict=product_id`, {
      method: 'POST',
      headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!r.ok) throw new Error(`upsert ${r.status} ${await r.text()}`);
    process.stdout.write(`\r  upsert ${Math.min(i + 500, rows.length)}/${rows.length}`);
  }
  process.stdout.write('\n');
}

async function main() {
  const products = await fetchAllProducts();
  const blog = blogProductIds();
  console.log(`판매중+제휴링크 ${products.length} · 블로그 글 있는 상품 ${blog.size}`);

  // 물결 1 = 리뷰 수 상위 5,000개(계획 10/21). 문턱은 매 실행 다시 잰다.
  const rcs = products.filter((p) => !blog.has(String(p.product_id))).map((p) => Number(p.review_count) || 0).sort((a, b) => b - a);
  const wave1Min = Math.max(100, rcs[Math.min(4999, rcs.length - 1)] || 100);
  const leafPrices = new Map();
  for (const p of products) {
    const k = String(p.category || '').split('>').map((s) => s.trim()).filter(Boolean).join('>');
    const v = num(p.price_numeric);
    if (k && v) (leafPrices.get(k) || leafPrices.set(k, []).get(k)).push(v);
  }
  for (const a of leafPrices.values()) a.sort((x, y) => x - y);

  const seen = new Set();
  const pages = [];
  for (const p of products) {
    const id = String(p.product_id);
    if (blog.has(id) || seen.has(id) || !p.name) continue;
    seen.add(id);
    pages.push(buildPage(p, { leafPrices, wave1Min }));
  }

  // 대안: 같은 세부 분류에서 점수 높은 순, 같은 물결 이하(공개 범위 안), 브랜드 겹침 최소
  const byCat = new Map();
  for (const pg of pages) (byCat.get(pg.cat_path) || byCat.set(pg.cat_path, []).get(pg.cat_path)).push(pg);
  for (const list of byCat.values()) list.sort((a, b) => b.score - a.score || b.review_count - a.review_count);
  for (const pg of pages) {
    const alts = [];
    const brands = new Set([pg.data.brand]);
    for (const c of byCat.get(pg.cat_path) || []) {
      if (alts.length >= 4) break;
      if (c === pg || c.wave > Math.max(pg.wave, PUBLISH_WAVE)) continue;
      if (brands.has(c.data.brand) && alts.length < 2) continue;
      brands.add(c.data.brand);
      alts.push({ id: c.product_id, name: c.name, price: c.data.price, rating: c.data.rating, reviews: c.review_count, score: c.score, img: c.data.imgs[0] || null });
    }
    pg.data.alts = alts;
    pg.published = pg.wave <= PUBLISH_WAVE;
  }

  const waves = [1, 2, 3].map((w) => pages.filter((x) => x.wave === w).length);
  console.log(`물결 1 문턱 리뷰 ${wave1Min}+`);
  console.log(`페이지 ${pages.length} · 물결 1/2/3 = ${waves.join('/')} · 공개(물결 ≤${PUBLISH_WAVE}) ${pages.filter((x) => x.published).length}`);

  // 분류 트리(공개분만) — 홈·분류 화면용 정적 데이터
  const tree = {};
  for (const pg of pages) {
    if (!pg.published) continue;
    let node = tree;
    for (const c of pg.data.cats) { node[c] ??= { n: 0, k: {} }; node[c].n++; node = node[c].k; }
  }
  const outDir = path.join(SITE_DIR, 'public/_data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'cats.json'), JSON.stringify({ builtAt: new Date().toISOString(), total: pages.filter((x) => x.published).length, tree }));

  if (DRY) { console.log('DRY — DB 쓰지 않음'); console.log(JSON.stringify(pages.find((x) => x.wave === 1)?.data, null, 1).slice(0, 3000)); return; }
  await upsert(pages);
  // 이번 실행에서 빠진 상품(판매 종료·블로그로 이동) 은 비공개로
  const ids = new Set(pages.map((x) => x.product_id));
  const stale = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SB}/rest/v1/product_pages?select=product_id&published=eq.true&order=product_id`, { headers: { ...H, Range: `${from}-${from + 999}` } });
    const rows = await r.json();
    for (const x of rows) if (!ids.has(x.product_id)) stale.push(x.product_id);
    if (rows.length < 1000) break;
  }
  for (let i = 0; i < stale.length; i += 200) {
    await fetch(`${SB}/rest/v1/product_pages?product_id=in.(${stale.slice(i, i + 200).join(',')})`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ published: false }) });
  }
  console.log(`비공개 전환(판매 종료 등) ${stale.length}`);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('build_product_pages.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
