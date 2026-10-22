// HTML 렌더러 — 상품 페이지·분류·랭킹·검색·홈 공용 레이아웃. 외부 JS 없음, CSS 한 장(/style.css).
// 2026-10-21 review101.kr 구조로 개편(분석: claudedocs/REVIEW101_ANALYSIS_20261021.md) — 상단 메뉴 홈·랭킹·카테고리·상품 찾기,
//   상품 카드 = 썸네일+순위 · [구매 점수][판정] · 평점·리뷰·리뷰 신뢰도 · 가격·할인 · [많이 만족한 점][구매 전 확인할 점] · 후기 요약 보기
export const SITE = {
  name: '쇼핑로그 리뷰',
  origin: 'https://review.shopping-log.com',
  parent: 'https://shopping-log.com',
  desc: '구매자 평점·리뷰 수·리뷰 항목 비율과 같은 분류 가격을 모아 상품별 장단점과 구매 전 확인할 것을 정리합니다.',
};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const won = (n) => (n ? `${Math.round(n).toLocaleString('ko-KR')}원` : '');
export const fmtN = (n) => Number(n || 0).toLocaleString('ko-KR');
// 분류 경로 ↔ URL 조각: 분류명 안의 '/'(디지털/가전) 는 '·' 로
export const catSeg = (c) => encodeURIComponent(String(c).replace(/\//g, '·'));
export const catHref = (cats) => `/c/${cats.map(catSeg).join('/')}/`;
// pstatic 원본 경로만 ?type= 리사이즈(f300·f640 만 된다, f150 은 404). dthumb(?src=) 같은 프록시 주소는 그대로 둔다.
export const img = (u, w = 640) => (!u ? '' : /\/dthumb\/|\?src=/.test(u) ? u : `${u.replace(/\?.*$/, '')}?type=f${w >= 640 ? 640 : 300}_${w >= 640 ? 640 : 300}`);

// ── 판정 보조값 (DB 숫자로만 계산, 지어내지 않음) ─────────────────────────────
// 리뷰 신뢰도: 리뷰 수가 평점을 얼마나 믿게 해 주는가
export const trustOf = (reviews) => (reviews >= 1000 ? '높음' : reviews >= 100 ? '보통' : '낮음');
// 리스크: 점수 구간
export const riskOf = (score) => (score >= 85 ? '낮음' : score >= 72 ? '보통' : '높음');
export const tone = (score) => (score >= 85 ? 'g' : score >= 72 ? 'b' : score >= 58 ? 'y' : 'r');
// 사도 되는 이유: 데이터가 받쳐 주는 문장만
export function reasonsOf(d) {
  const r = [];
  if (d.reviews >= 1000) r.push(`리뷰가 ${fmtN(d.reviews)}개로 충분해 구매 판단 근거가 넓습니다.`);
  else if (d.reviews >= 100) r.push(`리뷰 ${fmtN(d.reviews)}개로 기본적인 표본이 있습니다.`);
  if (d.rating >= 4.7) r.push(`평점 ${d.rating.toFixed(1)}점으로 만족도 신호가 안정적입니다.`);
  else if (d.rating >= 4.5) r.push(`평점 ${d.rating.toFixed(1)}점으로 대체로 만족하는 편입니다.`);
  for (const a of d.attrs || []) if (a.pct >= 70 && r.length < 4) r.push(`구매자 ${a.pct}%가 ${a.label} "${a.top}"라고 답했습니다.`);
  if (d.pricePct != null && d.pricePct <= 33 && r.length < 4) r.push(`같은 ${d.leaf} ${fmtN(d.leafN)}개 중 가격이 낮은 쪽입니다.`);
  if (d.discount >= 20 && r.length < 4) r.push(`표시 정가 대비 ${d.discount}% 낮은 가격입니다.`);
  if (!r.length) r.push(`${d.leaf}을(를) 찾는다면 비교 후보로 볼 만합니다.`);
  return r.slice(0, 3);
}
// 판정 한 줄 (review101 "구매 후보로 검토하기 좋지만…")
export function verdictLine(score) {
  if (score >= 85) return '리뷰 근거가 탄탄해 구매 후보로 먼저 검토하기 좋습니다.';
  if (score >= 72) return '구매 후보로 검토하기 좋지만 일부 조건은 스토어에서 확인하는 것이 좋습니다.';
  if (score >= 58) return '장단점이 갈려 같은 분류의 다른 상품과 비교한 뒤 정하는 것이 좋습니다.';
  return '근거가 아직 부족해 후기와 조건을 꼼꼼히 확인한 뒤 결정하세요.';
}

export function layout({ title, description, canonical, body, jsonld = [], noindex = false, env = {}, nav = '' }) {
  // 서치어드바이저 HTML 태그 인증값(공개 메타, 2026-10-21 등록). env 가 있으면 그것이 우선.
  const verify = `<meta name="naver-site-verification" content="${esc(env.NAVER_SITE_VERIFICATION || '28bde2c3123ad3727a8e48d27e786e8d85d2250b')}">`;
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('');
  const navItem = (key, href, label) => `<a href="${href}"${nav === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
${noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
${verify}
<meta name="msvalidate.01" content="0B8330D49C48EBA9B38483BA506C108E">
<meta property="og:type" content="website"><meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="/style.css?v=7">
${ld}
</head><body>
<header class="top"><div class="wrap top-in">
  <a class="logo" href="/">shopping<b>log</b> <span>리뷰</span></a>
  <nav class="gnb" aria-label="주 메뉴">${navItem('home', '/', '홈')}${navItem('ranking', '/ranking/', '랭킹')}${navItem('category', '/category/', '카테고리')}${navItem('search', '/search', '상품 찾기')}</nav>
</div></header>
<main class="wrap">${body}</main>
<footer class="foot"><div class="wrap">
  <p class="disc">이 사이트의 구매 버튼은 네이버 쇼핑 커넥트 제휴 링크이며, 구매 시 운영자가 판매처로부터 일정 수수료를 받습니다. 가격·재고는 판매처에서 수시로 바뀌니 구매 전 판매 페이지에서 확인하세요.</p>
  <p>평점·리뷰 수·리뷰 항목 비율은 판매처 공개 정보를 기준으로 하며, 점수는 공개된 계산식으로 산출합니다. 리뷰 원문은 싣지 않습니다.</p>
  <p class="foot-links"><a href="/about/">점수 계산 방법</a> · <a href="${SITE.parent}/about/">운영자 소개</a> · <a href="${SITE.parent}/contact/">광고 및 게시물 문의</a> · <a href="${SITE.parent}/">쇼핑로그 본사이트</a></p>
  <p class="copy">2026 © 쇼핑로그 리뷰</p>
</div></footer>
</body></html>`;
}

export function stars(r) {
  if (!r) return '';
  const pct = Math.max(0, Math.min(100, (r / 5) * 100));
  return `<span class="stars" aria-label="평점 ${r.toFixed(1)}점"><span style="width:${pct}%"></span></span>`;
}

export function scoreRing(score, size = 'lg') {
  return `<span class="ring ring-${size} tone-${tone(score)}" style="--p:${score}"><b>${score}</b></span>`;
}

// 상품 카드 (review101 product-card). p = CARD_COLS 행. rank 가 있으면 썸네일에 "N위"
export function card(p, pos = 'list', rank = null) {
  const href = `/p/${esc(p.product_id || p.id)}/`;
  const reviews = p.review_count ?? p.reviews ?? 0;
  const rating = p.rating ? Number(p.rating) : null;
  return `<article class="pcard" data-pos="${pos}">
  <div class="pc-top">
    <a class="pc-img" href="${href}" aria-label="${esc(p.name)} 상세 보기">${rank ? `<span class="pc-rank">${rank}위</span>` : ''}${p.img ? `<img src="${esc(img(p.img, 300))}" alt="${esc(p.name)} 이미지" loading="lazy" decoding="async" width="96" height="96" onerror="this.remove()">` : ''}</a>
    <div class="pc-info">
      <div class="badges"><span class="badge badge-primary">구매 점수 ${p.score}점</span>${p.label ? `<span class="badge badge-outline">${esc(p.label)}</span>` : ''}</div>
      <h3><a href="${href}">${esc(p.name)}</a></h3>
      <div class="pc-meta">${rating ? `<span><i class="star">★</i> ${rating.toFixed(1)}</span>` : ''}<span>리뷰 ${fmtN(reviews)}개</span><span>리뷰 신뢰도 ${trustOf(reviews)}</span></div>
      <div class="pc-price"><strong>${won(p.price)}</strong>${p.discount ? `<span class="off">${p.discount}% 할인</span>` : ''}</div>
    </div>
  </div>
  ${p.pro || p.con ? `<div class="verdict2">
    ${p.pro ? `<div class="vi vi-pro"><span class="vi-ic" aria-hidden="true">✓</span><div><strong>많이 만족한 점</strong><p>${esc(String(p.pro).split(' — ')[1] || p.pro)}</p></div></div>` : ''}
    ${p.con ? `<div class="vi vi-con"><span class="vi-ic" aria-hidden="true">!</span><div><strong>구매 전 확인할 점</strong><p>${esc(p.con)}</p></div></div>` : ''}
  </div>` : ''}
  <div class="pc-foot"><a class="btn btn-primary btn-sm" href="${href}">후기 요약 보기</a></div>
</article>`;
}

// 한 줄 목록 행 (홈 "리뷰 많은 인기 상품" / "할인율 높은데 리뷰도 좋은 상품")
export function row(p, kind = 'score') {
  const lead = kind === 'deal' ? `<span class="rw-pct">${p.discount}%</span>` : `<span class="rw-score tone-${tone(p.score)}">${p.score}</span>`;
  const tail = kind === 'deal' ? `리뷰 신뢰도 ${trustOf(p.review_count)}` : `리뷰 ${fmtN(p.review_count)}개`;
  return `<a class="rw" href="/p/${esc(p.product_id)}/">${lead}<span class="rw-name">${esc(p.name)}</span><span class="rw-tail">${tail}</span></a>`;
}

export function secHead(eyebrow, title, more = '') {
  return `<div class="sec-head"><div><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2></div>${more ? `<a class="btn btn-light btn-sm" href="${more}">더 보기</a>` : ''}</div>`;
}

export function breadcrumb(cats, last) {
  const items = [`<a href="/">홈</a>`];
  cats.forEach((c, i) => items.push(`<a href="${catHref(cats.slice(0, i + 1))}">${esc(c)}</a>`));
  if (last) items.push(`<span aria-current="page">${esc(last)}</span>`);
  return `<nav class="crumb" aria-label="분류 경로">${items.join('<i>›</i>')}</nav>`;
}

export function breadcrumbLd(cats, last, lastUrl) {
  const list = [{ name: '홈', item: `${SITE.origin}/` }];
  cats.forEach((c, i) => list.push({ name: c, item: SITE.origin + catHref(cats.slice(0, i + 1)) }));
  if (last) list.push({ name: last, item: lastUrl });
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: list.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: x.item })) };
}

export function notFound(env) {
  return new Response(layout({
    title: `페이지를 찾을 수 없어요 | ${SITE.name}`, description: SITE.desc, noindex: true, env,
    body: `<section class="empty"><h1>판매가 끝났거나 없는 상품이에요</h1><p>판매 종료된 상품은 페이지를 내립니다.</p><p><a class="btn btn-primary" href="/">다른 상품 보기</a></p></section>`,
  }), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export const html = (body, maxAge = 3600) => new Response(body, {
  headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': `public, max-age=${maxAge}, s-maxage=86400` },
});
