// 랭킹 /ranking/{tab}/ (review101 랭킹) — 구매 확신도 · 리뷰 신뢰도 · 리뷰 많은 상품 · 할인+리뷰, 각 TOP 100
import { sb, cached, CARD_COLS } from '../../lib/db.js';
import { layout, card, esc, html, notFound, SITE } from '../../lib/render.js';

export const TABS = {
  '': { label: '구매 확신도', desc: '평점·리뷰 수·같은 분류 가격·리뷰 항목 응답으로 계산한 구매 점수 순', q: 'review_count=gte.100&order=score.desc,review_count.desc' },
  trust: { label: '리뷰 신뢰도', desc: '리뷰 1,000개 이상 상품 중 평점이 높은 순', q: 'review_count=gte.1000&order=data->rating.desc.nullslast,review_count.desc' },
  reviews: { label: '리뷰 많은 상품', desc: '판매처 리뷰 수가 많은 순', q: 'order=review_count.desc' },
  'deal-review': { label: '할인+리뷰', desc: '구매 점수 72점 이상·리뷰 100개 이상 중 표시 정가 대비 할인율이 큰 순', q: 'score=gte.72&review_count=gte.100&data->discount=gte.10&order=data->discount.desc,score.desc' },
};

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const url = new URL(request.url);
  const key = (Array.isArray(params.tab) ? params.tab[0] : params.tab) || '';
  const tab = TABS[key];
  if (!tab) return notFound(env);
  if (!url.pathname.endsWith('/')) return Response.redirect(`${url.origin}${url.pathname}/`, 301);
  return cached(context, async () => {
    const rows = await sb(env, `product_pages?published=eq.true&${tab.q}&select=${CARD_COLS}&limit=100`);
    const title = key ? `${tab.label} TOP 100 | 후기·단점 비교` : '리뷰 좋은 상품 TOP 100 | 후기·단점 비교';
    const body = `
<section class="page-head">
  <p class="eyebrow">쇼핑로그 리뷰 랭킹</p>
  <h1>${esc(title)}</h1>
  <p class="muted">${esc(tab.desc)}입니다. 후기와 단점을 비교해 보세요.</p>
  <nav class="tabs" aria-label="랭킹 기준">${Object.entries(TABS).map(([k, t]) => `<a href="/ranking/${k ? k + '/' : ''}"${k === key ? ' aria-current="page"' : ''}>${t.label}</a>`).join('')}</nav>
</section>
<div class="pgrid" role="list">${rows.map((p, i) => card(p, `rank_${key || 'confidence'}`, i + 1)).join('')}</div>`;
    return html(layout({
      title: `${title} - ${SITE.name}`,
      description: `${tab.desc}으로 고른 상품 100개. 상품마다 구매 점수·많이 만족한 점·구매 전 확인할 점을 정리했습니다.`,
      canonical: `${SITE.origin}/ranking/${key ? key + '/' : ''}`, body, env, nav: 'ranking',
      jsonld: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: title, itemListElement: rows.slice(0, 30).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE.origin}/p/${p.product_id}/`, name: p.name })) }],
    }));
  });
}
