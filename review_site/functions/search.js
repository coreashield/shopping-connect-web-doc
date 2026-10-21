// 검색 /search?q= — 상품명 단어 AND 포함 (색인 제외 페이지)
import { sb, CARD_COLS } from '../lib/db.js';
import { layout, card, esc, fmtN, SITE } from '../lib/render.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 40);
  const words = q.replace(/[,()*%\\"'.:]/g, ' ').split(/\s+/).filter((w) => w.length >= 1).slice(0, 4);
  let rows = [];
  if (words.length) {
    const and = words.map((w) => `name.ilike.*${w}*`).join(',');
    rows = await sb(env, `product_pages?published=eq.true&and=(${encodeURIComponent(and)})&select=${CARD_COLS}&order=score.desc,review_count.desc&limit=48`).catch(() => []);
  }
  const body = `
<section class="sec">
  <h1 class="h-search">${q ? `"${esc(q)}" 검색 결과 <small>${fmtN(rows.length)}${rows.length === 48 ? '+' : ''}개</small>` : '상품 검색'}</h1>
  <form class="search big" action="/search" method="get"><input name="q" type="search" value="${esc(q)}" placeholder="상품명이나 브랜드" aria-label="상품 검색" maxlength="40"><button>검색</button></form>
  ${q && !rows.length ? '<p class="muted">맞는 상품이 없어요. 단어를 줄이거나 브랜드명 대신 품목명(예: 히터, 마그네슘)으로 찾아보세요.</p>' : ''}
</section>
<div class="grid">${rows.map((p) => card(p, 'search')).join('')}</div>`;
  return new Response(layout({ title: `${q ? q + ' 검색' : '검색'} | ${SITE.name}`, description: SITE.desc, body, noindex: true, env }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}
