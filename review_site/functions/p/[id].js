// 상품 데이터 페이지 /p/{product_id}/ — product_pages 한 행을 그린다.
import { getPage, cached } from '../../lib/db.js';
import { layout, esc, won, fmtN, img, stars, scoreRing, card, breadcrumb, breadcrumbLd, notFound, html, SITE } from '../../lib/render.js';

const PART_LABEL = { rating: ['평점', 40], reviews: ['리뷰 수', 25], price: ['같은 분류 가격', 20], attrs: ['리뷰 항목 만족', 15] };

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const id = String(params.id || '').replace(/[^\d]/g, '');
  const url = new URL(request.url);
  if (!url.pathname.endsWith('/')) return Response.redirect(`${url.origin}/p/${id}/`, 301);
  return cached(context, async () => {
    const row = id ? await getPage(env, id) : null;
    if (!row) return notFound(env);
    return html(render(row, env));
  });
}

function render(row, env) {
  const d = row.data;
  const id = row.product_id;
  const canonical = `${SITE.origin}/p/${id}/`;
  const go = (pos) => `/go/${id}/?pos=${pos}`;
  const buy = (pos, label = '네이버에서 현재 가격 보기') => `<a class="buy" href="${go(pos)}" rel="nofollow sponsored noopener" target="_blank">${label}<span aria-hidden="true">→</span></a>`;
  const title = `${row.name} 후기·장단점${d.reviews ? ` — 리뷰 ${fmtN(d.reviews)}개 분석` : ''} | ${SITE.name}`;
  const description = `${d.summary} 맞는 사람·안 맞는 사람과 사기 전 확인할 것까지 정리.`.slice(0, 155);

  const gallery = d.imgs.length ? `<div class="gal">
    <img class="gal-main" src="${esc(img(d.imgs[0], 640))}" alt="${esc(row.name)}" width="640" height="640" fetchpriority="high">
    ${d.imgs.length > 1 ? `<div class="gal-row">${d.imgs.slice(1, 5).map((u) => `<img src="${esc(img(u, 300))}" alt="" loading="lazy" width="150" height="150" onerror="this.remove()">`).join('')}</div>` : ''}
  </div>` : '';

  const priceBlock = `<div class="price">
    ${d.discount ? `<span class="pct">${d.discount}%</span>` : ''}<strong>${won(d.price)}</strong>
    ${d.orig ? `<s>${won(d.orig)}</s>` : ''}
  </div>`;

  const rateBlock = d.rating
    ? `<div class="rate">${stars(d.rating)}<b>${d.rating.toFixed(1)}</b><span>리뷰 ${fmtN(d.reviews)}개 · 판매처 기준</span></div>`
    : `<div class="rate"><span>리뷰 ${fmtN(d.reviews)}개 · 판매처 기준</span></div>`;

  const parts = Object.entries(PART_LABEL).map(([k, [label, max]]) => {
    const v = d.parts[k] ?? 0;
    return `<li><span>${label}</span><span class="bar"><i style="width:${Math.round((v / max) * 100)}%"></i></span><b>${v}<small>/${max}</small></b></li>`;
  }).join('');

  const attrs = d.attrs.length ? `<section class="box">
    <h2>구매자 리뷰 항목 평가</h2>
    <p class="muted">판매처 리뷰에서 구매자가 고른 항목별 응답 비율입니다.</p>
    <ul class="attrs">${d.attrs.map((a) => `<li><span class="a-l">${esc(a.label)}</span><span class="bar"><i style="width:${a.pct}%"></i></span><span class="a-v">"${esc(a.top)}" <b>${a.pct}%</b></span></li>`).join('')}</ul>
  </section>` : '';

  const priceMap = d.pricePct != null ? `<section class="box">
    <h2>같은 분류 안 가격 위치</h2>
    <div class="pmap"><span class="pmap-track"><i style="left:${d.pricePct}%"></i></span>
      <span class="pmap-l">싼 쪽</span><span class="pmap-r">비싼 쪽</span></div>
    <p>${esc(d.leaf)} ${fmtN(d.leafN)}개 중 이 상품은 <b>${d.pricePct <= 50 ? `싼 쪽 하위 ${Math.max(1, d.pricePct)}%` : `비싼 쪽 상위 ${Math.max(1, 100 - d.pricePct)}%`}</b>에 있어요. 중앙값은 ${won(d.leafMedian)}입니다.</p>
  </section>` : '';

  const spec = d.spec.length ? `<section class="box">
    <h2>기본 정보</h2>
    <table class="spec"><tbody>${d.spec.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
  </section>` : '';

  const alts = d.alts?.length ? `<section class="box">
    <h2>같은 ${esc(d.leaf)} 다른 선택지</h2>
    <div class="grid">${d.alts.map((a) => card({ ...a, product_id: a.id, review_count: a.reviews }, 'alt')).join('')}</div>
  </section>` : '';

  const faq = `<section class="box">
    <h2>자주 묻는 질문</h2>
    ${d.faq.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
  </section>`;

  const body = `
${breadcrumb(d.cats)}
<article class="pd">
  <div class="pd-top">
    ${gallery}
    <div class="pd-info">
      <p class="chip">${esc(d.leaf)}${d.brand ? ` · ${esc(d.brand)}` : ''}</p>
      <h1>${esc(row.name)} <span>후기·장단점</span></h1>
      ${rateBlock}
      ${priceBlock}
      <div class="verdict">${scoreRing(d.score)}<div><p class="v-l">구매 판단 점수</p><p class="v-t">${esc(d.label)}</p></div></div>
      ${buy('hero')}
      <p class="fine">가격 기준일 ${esc(d.checkedAt)} · 제휴 링크(수수료를 받을 수 있음)</p>
    </div>
  </div>

  <section class="box sum"><h2>한눈에 보기</h2><p>${esc(d.summary)}</p></section>

  <div class="two">
    <section class="box good"><h2>이런 분께 맞아요</h2><ul>${d.fit.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
    <section class="box bad"><h2>이런 분은 다시 생각해 보세요</h2><ul>${d.unfit.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
  </div>

  ${attrs}

  <section class="box">
    <h2>점수는 이렇게 나왔어요</h2>
    <ul class="parts">${parts}</ul>
    <p class="muted"><a href="/about/">계산 방법 자세히</a> — 평점·리뷰 수·같은 분류 가격·리뷰 항목 응답으로만 계산하며, 판매처나 광고비는 반영하지 않습니다.</p>
  </section>

  ${priceMap}

  <section class="box check"><h2>사기 전에 확인할 것</h2><ol>${d.checks.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    ${buy('check', '판매 페이지에서 확인하기')}
  </section>

  ${spec}
  ${d.keywords?.length ? `<section class="box"><h2>관련 검색어</h2><p class="kw">${d.keywords.map((k) => `<span>#${esc(k)}</span>`).join('')}</p></section>` : ''}
  ${alts}
  ${faq}
</article>
<div class="sticky">${buy('sticky')}</div>`;

  const jsonld = [
    breadcrumbLd(d.cats, row.name, canonical),
    {
      '@context': 'https://schema.org', '@type': 'Article', headline: `${row.name} 후기·장단점`, description,
      image: d.imgs.slice(0, 3).map((u) => img(u, 640)), dateModified: row.built_at, datePublished: row.built_at,
      author: { '@type': 'Organization', name: '쇼핑로그', url: SITE.parent }, publisher: { '@type': 'Organization', name: '쇼핑로그', url: SITE.parent },
      mainEntityOfPage: canonical,
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: d.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ];
  return layout({ title, description, canonical, body, jsonld, env });
}
