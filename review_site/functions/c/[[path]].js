// 분류 페이지 /c/{대}/{중}/.../?page=N — 점수 순 목록 30개씩
import { sb, getCats, cached, CARD_COLS } from '../../lib/db.js';
import { layout, card, catHref, breadcrumb, breadcrumbLd, esc, fmtN, html, notFound, SITE } from '../../lib/render.js';

const PER = 30;

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const url = new URL(request.url);
  const segs = (Array.isArray(params.path) ? params.path : [params.path]).filter(Boolean).map((s) => decodeURIComponent(s).replace(/·/g, '/'));
  if (!segs.length) return Response.redirect(`${url.origin}/`, 301);
  if (!url.pathname.endsWith('/')) return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301);
  const page = Math.max(1, Math.min(200, Number(url.searchParams.get('page')) || 1));
  return cached(context, async () => {
    const cats = await getCats(context);
    let node = { k: cats.tree };
    for (const s of segs) { node = node.k?.[s]; if (!node) return notFound(env); }
    const path = segs.join('>');
    const filter = Object.keys(node.k || {}).length ? `cat_path=like.${encodeURIComponent(path + '>*')}` : `cat_path=eq.${encodeURIComponent(path)}`;
    const { rows, total } = await sb(env, `product_pages?published=eq.true&${filter}&select=${CARD_COLS}&order=score.desc,review_count.desc&offset=${(page - 1) * PER}&limit=${PER}`, { count: true });
    if (!rows.length) return notFound(env);
    const last = segs[segs.length - 1];
    const subs = Object.entries(node.k || {}).sort((a, b) => b[1].n - a[1].n);
    const pages = Math.ceil(total / PER);
    const canonical = `${SITE.origin}${catHref(segs)}${page > 1 ? `?page=${page}` : ''}`;
    const nav = pages > 1 ? `<nav class="pager">${page > 1 ? `<a href="?page=${page - 1}" rel="prev">이전</a>` : ''}<span>${page} / ${pages}</span>${page < pages ? `<a href="?page=${page + 1}" rel="next">다음</a>` : ''}</nav>` : '';
    const body = `
${breadcrumb(segs.slice(0, -1), last)}
<section class="page-head">
  <p class="eyebrow">카테고리별 추천</p>
  <h1>${esc(last)} 추천·후기 비교 <small>${fmtN(total)}개</small></h1>
  <p class="muted">평점·리뷰 수·같은 분류 가격·리뷰 항목 응답으로 계산한 구매 점수 순입니다.</p>
  ${subs.length ? `<div class="cchips sm">${subs.map(([c, v]) => `<a href="${catHref([...segs, c])}">${esc(c)} <small>${fmtN(v.n)}</small></a>`).join('')}</div>` : ''}
</section>
<div class="pgrid" role="list">${rows.map((p, i) => card(p, 'cat', page === 1 ? i + 1 : (page - 1) * PER + i + 1)).join('')}</div>
${nav}`;
    return html(layout({
      title: `${last} 추천 순위·후기 비교 ${fmtN(total)}개${page > 1 ? ` (${page}쪽)` : ''} | ${SITE.name}`,
      description: `${last} ${fmtN(total)}개를 평점·리뷰 수·가격 위치로 계산한 점수 순으로 비교했어요. 상품마다 장단점과 사기 전 확인할 것을 정리합니다.`,
      canonical, body, env, noindex: total < 5, nav: 'category',
      jsonld: [breadcrumbLd(segs.slice(0, -1), last, `${SITE.origin}${catHref(segs)}`)],
    }));
  });
}
