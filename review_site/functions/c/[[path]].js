// 분류 페이지 /c/{대}/{중}/.../?page=N — 점수 순 목록 30개씩
// 11/8: 1쪽 맨 위 TOP 5 한눈에 비교표(pos=cat_table, 상품명 칸 고정) + ItemList 스키마
//       세그먼트 /c/{…세부}/{under-100k|100k-300k|reviews-1k|on-sale}/ — lib/segments.js PILOT 분류만
import { sb, getCats, cached, CARD_COLS } from '../../lib/db.js';
import { layout, img, card, catHref, breadcrumb, breadcrumbLd, esc, fmtN, won, wonShort, cntShort, html, notFound, SITE } from '../../lib/render.js';
import { SEGMENTS, pilotTabs, REDUNDANT_SHARE } from '../../lib/segments.js';

const PER = 30;

function compareTable(rows, title, pos) {
  if (rows.length < 2) return '';
  return `<section class="kcard cmp" aria-labelledby="cmp-h"><h2 class="kh" id="cmp-h">${esc(title)}</h2>
  <div class="cmp-wrap"><table class="cmp-tbl">
    <thead><tr><th scope="col" class="stick">상품</th><th scope="col">점수</th><th scope="col">가격</th><th scope="col" class="opt">평점</th><th scope="col">리뷰</th><th scope="col"><span class="sr">구매</span></th></tr></thead>
    <tbody>${rows.map((p, i) => `<tr>
      <th scope="row" class="stick"><a href="/p/${esc(p.product_id)}/">${i + 1}. ${esc(p.name)}</a></th>
      <td class="n">${p.score}</td><td class="n">${wonShort(p.price)}</td><td class="n opt">${p.rating ? Number(p.rating).toFixed(1) : '-'}</td><td class="n">${cntShort(p.review_count)}</td>
      <td><a class="cmp-buy" href="/go/${esc(p.product_id)}/?pos=${pos}" rel="nofollow sponsored noopener" target="_blank">확인</a></td></tr>`).join('')}</tbody>
  </table></div>
  <p class="fine">점수 = 평점·리뷰 수·같은 분류 가격·리뷰 항목 응답 · 확인 버튼은 네이버 쇼핑 커넥트 제휴 링크</p>
</section>`;
}

const itemListLd = (name, rows) => ({ '@context': 'https://schema.org', '@type': 'ItemList', name, itemListElement: rows.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE.origin}/p/${p.product_id}/`, name: p.name })) });

const segTabs = (segs, tabs, current) => `<nav class="seg-tabs" aria-label="조건별 보기"><a href="${catHref(segs)}"${current ? '' : ' aria-current="page"'}>전체</a>${tabs.map((t) => `<a href="${catHref(segs)}${t}/"${t === current ? ' aria-current="page"' : ''}>${esc(SEGMENTS[t].label)}</a>`).join('')}</nav>`;

const median = (a) => { const s = a.filter(Boolean).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const url = new URL(request.url);
  let raw = (Array.isArray(params.path) ? params.path : [params.path]).filter(Boolean);
  const segKey = SEGMENTS[raw[raw.length - 1]] ? raw[raw.length - 1] : null;
  if (segKey) raw = raw.slice(0, -1);
  const segs = raw.map((s) => decodeURIComponent(s).replace(/·/g, '/'));
  if (!segs.length) return Response.redirect(`${url.origin}/`, 301);
  if (!url.pathname.endsWith('/')) return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301);
  const page = segKey ? 1 : Math.max(1, Math.min(200, Number(url.searchParams.get('page')) || 1));
  return cached(context, async () => {
    const cats = await getCats(context);
    let node = { k: cats.tree };
    for (const s of segs) { node = node.k?.[s]; if (!node) return notFound(env); }
    const path = segs.join('>');
    const isLeaf = !Object.keys(node.k || {}).length;
    const tabs = pilotTabs(segs);
    if (segKey && !(tabs || []).includes(segKey)) return notFound(env);
    const last = segs[segs.length - 1];
    // 11/8 수정: 하위 분류가 있어도 그 분류에 직접 붙은 상품을 함께 센다(전엔 like 'X>*' 만 → 크림 297개 중 7개만 보이는 식, 78개 분류 3,977개 누락)
    const q = (s) => `"${s.replace(/"/g, '\\"')}"`;
    const filter = isLeaf ? `cat_path=eq.${encodeURIComponent(path)}` : `or=${encodeURIComponent(`(cat_path.eq.${q(path)},cat_path.like.${q(path + '>*')})`)}`;

    if (segKey) return html(await renderSegment({ env, segs, last, filter, tabs, segKey, leafN: node.n }));

    const { rows, total } = await sb(env, `product_pages?published=eq.true&${filter}&select=${CARD_COLS}&order=score.desc,review_count.desc&offset=${(page - 1) * PER}&limit=${PER}`, { count: true });
    if (!rows.length) return notFound(env);
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
  ${tabs ? segTabs(segs, tabs, null) : ''}
</section>
${page === 1 ? compareTable(rows.slice(0, 5), `${last} TOP 5 한눈에 비교`, 'cat_table') : ''}
<div class="pgrid" role="list">${rows.map((p, i) => card(p, 'cat', page === 1 ? i + 1 : (page - 1) * PER + i + 1)).join('')}</div>
${nav}`;
    return html(layout({
      title: `${last} 추천 순위·후기 비교 ${fmtN(total)}개${page > 1 ? ` (${page}쪽)` : ''} | ${SITE.name}`,
      description: `${last} ${fmtN(total)}개를 평점·리뷰 수·가격 위치로 계산한 점수 순으로 비교했어요. 상품마다 장단점과 사기 전 확인할 것을 정리합니다.`,
      canonical, body, env, noindex: total < 5, nav: 'category', image: rows.find((r) => r.img) ? img(rows.find((r) => r.img).img, 640) : '',
      jsonld: [breadcrumbLd(segs.slice(0, -1), last, `${SITE.origin}${catHref(segs)}`), itemListLd(`${last} 추천 순위`, rows)],
    }));
  });
}

async function renderSegment({ env, segs, last, filter, tabs, segKey, leafN }) {
  const seg = SEGMENTS[segKey];
  const { rows, total } = await sb(env, `product_pages?published=eq.true&${filter}&${seg.q}&select=${CARD_COLS}&order=${seg.order}&limit=20`, { count: true });
  if (!rows.length) return notFound(env);
  const canonical = `${SITE.origin}${catHref(segs)}${segKey}/`;
  const title = `${seg.label} ${last} 추천 TOP ${Math.min(20, rows.length)}`;
  // 탭마다 다른 숫자 문단 — 숫자만 바뀐 판박이 페이지가 되지 않게 이 세그먼트 실측값으로만 쓴다
  const prices = rows.map((r) => r.price).filter(Boolean);
  const disc = rows.map((r) => r.discount).filter(Boolean);
  const rated = rows.filter((r) => r.rating);
  const facts = [
    `${last} ${fmtN(leafN)}개 중 ${seg.label} 조건에 맞는 상품은 ${fmtN(total)}개이고, ${seg.sortNote}으로 ${rows.length}개를 골랐습니다.`,
    prices.length ? `아래 상위 ${rows.length}개의 가격은 ${won(Math.min(...prices))}~${won(Math.max(...prices))}, 가운데 값은 ${won(median(prices))}입니다.` : '',
    rated.length ? `평균 평점 ${(rated.reduce((a, r) => a + Number(r.rating), 0) / rated.length).toFixed(2)}점, 리뷰가 가장 많은 상품은 ${cntShort(Math.max(...rows.map((r) => r.review_count || 0)))}개입니다.` : '',
    disc.length ? `${disc.length}개가 할인 중이고 할인율 가운데 값은 ${median(disc)}%입니다.` : '',
  ].filter(Boolean);
  const best = rows.reduce((a, r) => (r.score > a.score ? r : a), rows[0]);
  const faq = [
    { q: `${seg.label} ${last} 중 점수가 가장 높은 상품은?`, a: `${best.name}이(가) 구매 점수 ${best.score}점으로 가장 높습니다(${won(best.price)}${best.review_count ? `, 리뷰 ${fmtN(best.review_count)}개` : ''}).` },
    { q: `${seg.label} ${last}는 몇 개를 비교했나요?`, a: `판매 중인 ${last} ${fmtN(leafN)}개 중 조건에 맞는 ${fmtN(total)}개를 ${seg.sortNote}으로 정렬해 상위 ${rows.length}개를 보여줍니다. 가격·재고는 판매처에서 바뀔 수 있습니다.` },
  ];
  const body = `
${breadcrumb(segs, seg.label)}
<section class="page-head">
  <p class="eyebrow">${esc(last)} · 조건별 추천</p>
  <h1>${esc(title)} <small>${fmtN(total)}개 중</small></h1>
  <ul class="seg-facts">${facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
  ${segTabs(segs, tabs, segKey)}
</section>
${compareTable(rows.slice(0, 5), `${seg.label} ${last} TOP 5 한눈에 비교`, 'seg_table')}
<div class="pgrid" role="list">${rows.map((p, i) => card(p, `seg_${segKey}`, i + 1)).join('')}</div>
<section class="kcard" style="margin:16px 0"><h2 class="kh">자주 묻는 질문</h2>${faq.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</section>`;
  return layout({
    title: `${title} | ${SITE.name}`,
    description: `${last} ${fmtN(leafN)}개 중 ${seg.label} ${fmtN(total)}개를 평점·리뷰 수·가격 위치로 계산한 점수 순으로 비교했어요.`.slice(0, 155),
    // 점수순 탭이 분류의 80% 이상을 덮으면 전체 목록과 같은 페이지 → noindex(탭에서도 빠져 있음)
    canonical, body, env, noindex: total < 5 || (seg.order.startsWith('score') && total / leafN >= REDUNDANT_SHARE), nav: 'category', image: rows.find((r) => r.img) ? img(rows.find((r) => r.img).img, 640) : '',
    jsonld: [
      breadcrumbLd(segs, seg.label, canonical),
      itemListLd(title, rows),
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  });
}
