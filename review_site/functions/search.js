// 상품 찾기 /search?q=&sort= (review101 상품 찾기) — 상품명 단어 AND 검색 + 정렬, 옆 목록(리뷰 신뢰 TOP·할인+리뷰·인기 카테고리). 색인 제외.
import { sb, getCats, CARD_COLS, ROW_COLS } from '../lib/db.js';
import { layout, card, catHref, esc, fmtN, SITE } from '../lib/render.js';

const SORTS = {
  score: ['관련도순', 'score.desc,review_count.desc'],
  rating: ['평점순', 'data->rating.desc.nullslast,review_count.desc'],
  reviews: ['리뷰순', 'review_count.desc'],
  low: ['낮은가격', 'data->price.asc'],
  high: ['높은가격', 'data->price.desc'],
  discount: ['할인률', 'data->discount.desc.nullslast,score.desc'],
};

export async function onRequestGet(context) {
  const { env, request } = context;
  const sp = new URL(request.url).searchParams;
  const q = (sp.get('q') || '').trim().slice(0, 40);
  const sortKey = SORTS[sp.get('sort')] ? sp.get('sort') : 'score';
  const words = q.replace(/[,()*%\\"'.:]/g, ' ').split(/\s+/).filter((w) => w.length >= 1).slice(0, 4);
  const [rows, trustTop, deals, cats] = await Promise.all([
    words.length
      ? sb(env, `product_pages?published=eq.true&and=(${encodeURIComponent(words.map((w) => `name.ilike.*${w}*`).join(','))})&select=${CARD_COLS}&order=${SORTS[sortKey][1]}&limit=48`).catch(() => [])
      : Promise.resolve([]),
    sb(env, `product_pages?published=eq.true&review_count=gte.1000&select=${ROW_COLS},rating:data->rating&order=data->rating.desc.nullslast,review_count.desc&limit=5`).catch(() => []),
    sb(env, `product_pages?published=eq.true&score=gte.72&review_count=gte.100&data->discount=gte.20&select=${ROW_COLS}&order=data->discount.desc&limit=5`).catch(() => []),
    getCats(context),
  ]);
  const sortLink = (k) => `<a href="/search?q=${encodeURIComponent(q)}&sort=${k}"${k === sortKey ? ' aria-current="page"' : ''}>${SORTS[k][0]}</a>`;
  const side = (title, items) => `<section class="kcard side-list"><h2>${title}</h2>${items}</section>`;
  const body = `
<section class="page-head">
  <p class="eyebrow">쇼핑로그 리뷰 상품 검색</p>
  <h1>리뷰가 검증한 상품 찾기</h1>
  <p class="muted">상품명, 브랜드, 품목으로 검색하면 구매 점수와 리뷰 분석을 함께 확인할 수 있습니다.</p>
  <form class="hero-search" action="/search" method="get" role="search">
    <span class="hs-ic" aria-hidden="true">⌕</span>
    <input name="q" type="search" value="${esc(q)}" placeholder="상품명이나 품목" aria-label="검색어 입력" maxlength="40">
    <button class="btn btn-primary">검색</button>
  </form>
  <p class="hero-ex">예: 조용한 가습기, 대용량 샴푸, 아기물티슈</p>
</section>
<div class="search-layout">
  <div>
    <div class="result-bar"><span>검색 결과 <b>${fmtN(rows.length)}${rows.length === 48 ? '+' : ''}</b>개</span><nav class="sorts">${Object.keys(SORTS).map(sortLink).join('')}</nav></div>
    ${rows.length ? `<div class="pgrid">${rows.map((p) => card(p, 'search')).join('')}</div>`
      : `<p class="empty-note">${q ? '맞는 상품이 없어요. 단어를 줄이거나 브랜드명 대신 품목명(예: 히터, 마그네슘)으로 찾아보세요.' : '검색어를 입력하거나 오른쪽 목록에서 골라 보세요.'}</p>`}
  </div>
  <aside class="search-side">
    ${side('리뷰 신뢰 TOP', trustTop.map((p) => `<a href="/p/${p.product_id}/"><span>${esc(p.name)}</span><b>★ ${p.rating ? Number(p.rating).toFixed(1) : '-'}</b></a>`).join(''))}
    ${side('할인+리뷰', deals.map((p) => `<a href="/p/${p.product_id}/"><span>${esc(p.name)}</span><b class="off">${p.discount}%↓</b></a>`).join(''))}
    ${side('인기 카테고리', `<div class="cchips sm">${Object.entries(cats.tree).sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([c]) => `<a href="${catHref([c])}">${esc(c)}</a>`).join('')}</div>`)}
  </aside>
</div>`;
  return new Response(layout({ title: `${q ? q + ' 검색 | ' : ''}상품 후기 검색 | 장단점·구매 전 체크 - ${SITE.name}`, description: SITE.desc, body, noindex: true, env, nav: 'search' }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}
