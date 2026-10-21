// HTML 렌더러 — 상품 페이지·분류·홈 공용 레이아웃. 외부 JS 없음, CSS 한 장(/style.css).
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
// pstatic 원본 경로만 ?type= 리사이즈. dthumb(?src=) 같은 프록시 주소는 그대로 둔다.
export const img = (u, w = 640) => (!u ? '' : /\/dthumb\/|\?src=/.test(u) ? u : `${u.replace(/\?.*$/, '')}?type=f${w}_${w}`);

export function layout({ title, description, canonical, body, jsonld = [], noindex = false, env = {} }) {
  // 서치어드바이저 HTML 태그 인증값(공개 메타, 2026-10-21 등록). env 가 있으면 그것이 우선.
  const verify = `<meta name="naver-site-verification" content="${esc(env.NAVER_SITE_VERIFICATION || '28bde2c3123ad3727a8e48d27e786e8d85d2250b')}">`;
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('');
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
<link rel="stylesheet" href="/style.css?v=5">
${ld}
</head><body>
<header class="top"><div class="wrap top-in">
  <a class="logo" href="/"><span class="logo-mark">R</span>쇼핑로그 <b>리뷰</b></a>
  <form class="search" action="/search" method="get" role="search">
    <input name="q" type="search" placeholder="상품명이나 고민 검색" aria-label="상품 검색" maxlength="40">
  </form>
</div></header>
<main class="wrap">${body}</main>
<footer class="foot"><div class="wrap">
  <p class="disc">이 사이트의 구매 버튼은 네이버 쇼핑 커넥트 제휴 링크이며, 구매 시 운영자가 판매처로부터 일정 수수료를 받습니다. 가격·재고는 판매처에서 수시로 바뀌니 구매 전 판매 페이지에서 확인하세요.</p>
  <p>평점·리뷰 수·리뷰 항목 비율은 판매처 공개 정보를 기준으로 하며, 점수는 아래 공개된 계산식으로 산출합니다. 리뷰 원문은 싣지 않습니다.</p>
  <p class="foot-links"><a href="/">홈</a> · <a href="/about/">점수 계산 방법</a> · <a href="${SITE.parent}/about/">운영자 소개</a> · <a href="${SITE.parent}/">쇼핑로그 본사이트</a></p>
  <p class="copy">© 2026 쇼핑로그</p>
</div></footer>
</body></html>`;
}

export function stars(r) {
  if (!r) return '';
  const pct = Math.max(0, Math.min(100, (r / 5) * 100));
  return `<span class="stars" aria-label="평점 ${r.toFixed(1)}점"><span style="width:${pct}%"></span></span>`;
}

export function scoreRing(score, size = 'lg') {
  const tone = score >= 85 ? 'g' : score >= 72 ? 'b' : score >= 58 ? 'y' : 'r';
  return `<span class="ring ring-${size} tone-${tone}" style="--p:${score}"><b>${score}</b></span>`;
}

export function card(p, pos = 'list') {
  const r = p.rating ? `<span class="c-rate">★ ${Number(p.rating).toFixed(1)}</span>` : '';
  return `<a class="card" href="/p/${esc(p.product_id || p.id)}/" data-pos="${pos}">
  <span class="c-img">${p.img ? `<img src="${esc(img(p.img, 300))}" alt="" loading="lazy" decoding="async" width="150" height="150" onerror="this.remove()">` : ''}</span>
  <span class="c-body">
    <span class="c-name">${esc(p.name)}</span>
    <span class="c-meta">${r}<span class="c-rev">리뷰 ${fmtN(p.review_count ?? p.reviews)}</span></span>
    <span class="c-foot"><span class="c-price">${won(p.price)}</span>${scoreRing(p.score, 'sm')}</span>
  </span>
</a>`;
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
    body: `<section class="empty"><h1>판매가 끝났거나 없는 상품이에요</h1><p>판매 종료된 상품은 페이지를 내립니다.</p><p><a class="btn" href="/">다른 상품 보기</a></p></section>`,
  }), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export const html = (body, maxAge = 3600) => new Response(body, {
  headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': `public, max-age=${maxAge}, s-maxage=86400` },
});
