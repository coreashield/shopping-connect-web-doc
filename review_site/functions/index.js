// 홈 (review101 홈 구조) — 히어로 검색 · 후기가 좋은 추천 상품 1~6위 · 카테고리별 추천 · 리뷰 많은 인기 상품 / 할인율 높은데 리뷰도 좋은 상품
import { sb, getCats, cached, CARD_COLS, ROW_COLS } from '../lib/db.js';
import { layout, card, row, secHead, catHref, esc, fmtN, html, SITE } from '../lib/render.js';

export async function onRequestGet(context) {
  const { env } = context;
  return cached(context, async () => {
    const [cats, best, popular, deals] = await Promise.all([
      getCats(context),
      sb(env, `product_pages?published=eq.true&review_count=gte.300&select=${CARD_COLS}&order=score.desc,review_count.desc&limit=6`),
      sb(env, `product_pages?published=eq.true&select=${ROW_COLS}&order=review_count.desc&limit=5`),
      sb(env, `product_pages?published=eq.true&score=gte.72&review_count=gte.100&data->discount=gte.20&select=${ROW_COLS}&order=data->discount.desc,score.desc&limit=5`),
    ]);
    const tops = Object.entries(cats.tree).sort((a, b) => b[1].n - a[1].n);
    const body = `
<section class="hero">
  <p class="eyebrow">사기 전 1분, 쇼핑로그 리뷰</p>
  <h1>수많은 상품 후기, 1분 만에 살지 말지 확인하세요</h1>
  <p class="hero-sub">평점·리뷰 수·구매자 응답 비율과 같은 분류 가격을 모아, ${fmtN(cats.total)}개 상품이 나에게 맞는지 빠르게 보여드립니다.</p>
  <form class="hero-search" action="/search" method="get" role="search">
    <span class="hs-ic" aria-hidden="true">⌕</span>
    <input name="q" type="search" placeholder="상품명 또는 고민을 입력하세요" aria-label="상품 검색" maxlength="40">
    <button class="btn btn-primary">후기 찾아보기</button>
  </form>
  <p class="hero-ex">예: 전기히터, 마그네슘, 캠핑의자, 아기물티슈, 무선청소기</p>
</section>
<section class="sec">
  ${secHead('한눈에 보는 장단점', '후기가 좋은 추천 상품', '/ranking/')}
  <div class="pgrid" role="list">${best.map((p, i) => card(p, 'home_best', i + 1)).join('')}</div>
</section>
<section class="sec">
  ${secHead('고민별 추천', '카테고리별 추천 상품')}
  <div class="cchips">${tops.map(([c, v]) => `<a href="${catHref([c])}">${esc(c)} <small>${fmtN(v.n)}개</small></a>`).join('')}</div>
</section>
<div class="sec two-col">
  <section>${secHead('리뷰 표본 충분', '리뷰 많은 인기 상품')}<div class="rows">${popular.map((p) => row(p, 'score')).join('')}</div></section>
  <section>${secHead('가격 조건 확인', '할인율 높은데 리뷰도 좋은 상품')}<div class="rows">${deals.map((p) => row(p, 'deal')).join('')}</div></section>
</div>`;
    return html(layout({
      title: `${SITE.name} | 상품 후기 요약·장단점·구매 전 체크`,
      description: SITE.desc, canonical: `${SITE.origin}/`, body, env, nav: 'home',
      jsonld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: `${SITE.origin}/`, potentialAction: { '@type': 'SearchAction', target: `${SITE.origin}/search?q={q}`, 'query-input': 'required name=q' } }],
    }));
  });
}
