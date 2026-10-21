// 카테고리 /category/ (review101 카테고리) — 대분류별 세부 분류 목록
import { getCats, cached } from '../lib/db.js';
import { layout, catHref, esc, fmtN, html, SITE } from '../lib/render.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  if (!url.pathname.endsWith('/')) return Response.redirect(`${url.origin}/category/`, 301);
  return cached(context, async () => {
    const cats = await getCats(context);
    const tops = Object.entries(cats.tree).sort((a, b) => b[1].n - a[1].n);
    const body = `
<section class="page-head">
  <p class="eyebrow">고민별 추천</p>
  <h1>카테고리별 추천 상품</h1>
  <p class="muted">${fmtN(cats.total)}개 상품을 분류별로 모았습니다. 분류 안에서는 구매 점수가 높은 순으로 보여드려요.</p>
</section>
<div class="catgrid">${tops.map(([c, v]) => `<section class="kcard catbox">
  <h2><a href="${catHref([c])}">${esc(c)}</a> <small>${fmtN(v.n)}개</small></h2>
  <div class="cchips sm">${Object.entries(v.k || {}).sort((a, b) => b[1].n - a[1].n).slice(0, 14).map(([s, w]) => `<a href="${catHref([c, s])}">${esc(s)} <small>${fmtN(w.n)}</small></a>`).join('')}</div>
</section>`).join('')}</div>`;
    return html(layout({ title: `카테고리별 상품 추천 | 후기·장단점 비교 - ${SITE.name}`, description: '분류별 상품의 구매 점수·장단점·구매 전 확인할 것을 비교합니다.', canonical: `${SITE.origin}/category/`, body, env: context.env, nav: 'category' }));
  });
}
