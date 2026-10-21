// 상품 데이터 페이지 /p/{product_id}/ — product_pages 한 행을 review101 상세 구조로 그린다.
//   히어로(갤러리·칩·판정 문장·가격·평점·구매 확신도·해시태그·버튼) → 사도 되는 이유/구매 전 확인 → 추천/신중/리뷰 키워드
//   → 가격·배송 체크/스토어 정보 → 리뷰 기반 구매 판단(카드 묶음) + 옆(다른 후기 제품·제품 상세 정보)
//   리뷰 원문·사진(review101 "스토어 구매자 리뷰")은 수집하지 않으므로 없다.
import { getPage, cached } from '../../lib/db.js';
import { layout, esc, won, fmtN, img, stars, scoreRing, breadcrumbLd, notFound, html, SITE, catHref, trustOf, riskOf, reasonsOf, verdictLine } from '../../lib/render.js';

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
  const buy = (pos, label = '네이버에서 현재 가격 확인하기', cls = 'btn btn-primary btn-buy') => `<a class="${cls}" href="${go(pos)}" rel="nofollow sponsored noopener" target="_blank">${label}</a>`;
  const title = `${row.name} 후기·장단점${d.reviews ? ` — 리뷰 ${fmtN(d.reviews)}개 분석` : ''} | ${SITE.name}`;
  const description = `${d.summary} 맞는 사람·안 맞는 사람과 사기 전 확인할 것까지 정리.`.slice(0, 155);
  const trust = trustOf(d.reviews);
  const reasons = reasonsOf(d);
  const shortLabel = (s) => String(s).split(' — ')[0].replace(/ 분$/, ' 사람').replace(/분$/, '사람');
  const detail = (s) => String(s).split(' — ')[1] || '';

  const gallery = d.imgs.length ? `<div class="gal">
    <div class="gal-main-wrap"><img class="gal-main" id="gal-main" src="${esc(img(d.imgs[0], 640))}" alt="${esc(row.name)}" width="640" height="640" fetchpriority="high"><span class="gal-count" id="gal-count">1 / ${d.imgs.length}</span></div>
    ${d.imgs.length > 1 ? `<div class="gal-row">${d.imgs.slice(0, 5).map((u, i) => `<button type="button" class="gal-th${i === 0 ? ' on' : ''}" data-src="${esc(img(u, 640))}" data-i="${i + 1}" aria-label="사진 ${i + 1}"><img src="${esc(img(u, 300))}" alt="" loading="lazy" width="64" height="64" onerror="this.parentNode.remove()"></button>`).join('')}</div>` : ''}
  </div>` : '<div class="gal"><div class="gal-main-wrap gal-empty">상품 사진</div></div>';

  const hero = `<section class="kcard pd-hero">
  ${gallery}
  <div class="pd-info">
    <div class="badges">${d.cats[0] ? `<a class="badge badge-primary" href="${catHref([d.cats[0]])}">${esc(d.cats[0])}</a>` : ''}<a class="badge badge-light" href="${catHref(d.cats)}">${esc(d.leaf)}</a>${d.store ? `<span class="badge badge-violet">${esc(d.store)}</span>` : ''}<span class="badge badge-green">판매중</span></div>
    <h1>${esc(d.fullName || row.name)}</h1>
    ${d.brand ? `<p class="pd-brand">${esc(d.brand)}</p>` : ''}
    <p class="pd-kind">${esc(d.leaf)} 리뷰</p>
    <p class="pd-line">${esc(verdictLine(d.score))}</p>
    <div class="pd-price"><strong>${won(d.price)}</strong>${d.orig ? `<s>${won(d.orig)}</s>` : ''}${d.discount ? `<span class="off">${d.discount}% 할인</span>` : ''}</div>
    <div class="pd-rate">${d.rating ? `${stars(d.rating)}<b>${d.rating.toFixed(1)}</b>` : ''}<span>(${fmtN(d.reviews)}개 리뷰 · 스토어 기준)</span></div>
    <div class="conf"><div class="conf-score"><small>구매 확신도</small><b>${d.score}<em>점</em></b></div><div><span class="badge badge-primary">${esc(d.label)}</span><p>리뷰 신뢰도 ${trust} · 리스크 ${riskOf(d.score)}</p></div></div>
    ${d.keywords?.length ? `<p class="tags">${[d.brand, ...d.keywords].filter(Boolean).map((k) => `<span>#${esc(k)}</span>`).join('')}</p>` : ''}
    ${buy('hero')}
    <p class="fine">가격 기준일 ${esc(d.checkedAt)} · 제휴 링크(구매 시 수수료를 받을 수 있음)</p>
  </div>
</section>`;

  const decision = `<div class="g2">
  <section class="kcard tint-green"><h2 class="kh"><span class="kh-ic ic-green">✓</span>사도 되는 이유</h2>
    <ul class="dot-list">${reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    ${buy('reason', '할인 적용가 확인하기', 'btn btn-light btn-sm')}</section>
  <section class="kcard tint-orange"><h2 class="kh"><span class="kh-ic ic-orange">!</span>구매 전 확인하세요</h2>
    <ul class="dot-list">${d.checks.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <p class="mini-chips">${d.checks.slice(0, 3).map((x) => `<span>${esc(x.split(/[와과(·,]/)[0].trim())}</span>`).join('')}</p></section>
</div>`;

  const posKw = [d.brand, ...(d.keywords || [])].filter(Boolean).slice(0, 5);
  const cautionKw = [...(d.attrs || []).filter((a) => a.pct < 70).map((a) => a.label), ...d.unfit.map((x) => shortLabel(x).replace(/(을\(를\)|에|이|가)? ?(중요하게 보는|민감한|중시하는|원하는|찾는|보고 고르는)?\s*사람$/, '').trim())].filter((x) => x && x.length <= 12).slice(0, 4);
  const fitGrid = `<div class="g3">
  <section class="kcard tint-blue"><h2 class="kh"><span class="kh-ic ic-blue">👍</span>이런 분께 추천</h2><ul class="dot-list">${d.fit.map((x) => `<li>${esc(shortLabel(x))}${detail(x) ? `<small>${esc(detail(x))}</small>` : ''}</li>`).join('')}</ul></section>
  <section class="kcard tint-red"><h2 class="kh"><span class="kh-ic ic-red">✋</span>이런 분은 신중하게</h2><ul class="dot-list">${d.unfit.map((x) => `<li>${esc(shortLabel(x))}${detail(x) ? `<small>${esc(detail(x))}</small>` : ''}</li>`).join('')}</ul></section>
  <section class="kcard tint-violet"><h2 class="kh"><span class="kh-ic ic-violet">#</span>리뷰 키워드</h2>
    <p class="kw-label kw-pos">긍정</p><p class="kw-chips pos">${(d.attrs || []).filter((a) => a.pct >= 70).map((a) => `<span>${esc(a.top)}</span>`).concat(posKw.map((k) => `<span>${esc(k)}</span>`)).slice(0, 6).join('') || '<span>평점 기준</span>'}</p>
    ${cautionKw.length ? `<p class="kw-label kw-neg">주의</p><p class="kw-chips neg">${cautionKw.map((k) => `<span>${esc(k)}</span>`).join('')}</p>` : ''}
  </section>
</div>`;

  const checkGrid = `<div class="g2">
  <section class="kcard"><h2 class="kh">가격·배송 체크</h2><dl class="kv">
    ${d.orig ? `<div><dt>상품가</dt><dd>${won(d.orig)}</dd></div>` : ''}
    <div><dt>${d.orig ? '할인가' : '판매가'}</dt><dd>${won(d.price)}</dd></div>
    ${d.leafMedian ? `<div><dt>같은 분류 중앙값</dt><dd>${won(d.leafMedian)}</dd></div>` : ''}
    <div><dt>배송비·무료배송 기준</dt><dd>스토어 확인</dd></div>
  </dl></section>
  <section class="kcard"><h2 class="kh">스토어 정보</h2><dl class="kv">
    <div><dt>스토어</dt><dd>${esc(d.store || d.brand || '-')}</dd></div>
    <div><dt>리뷰 신뢰도</dt><dd>리뷰 신뢰도 ${trust}</dd></div>
    <div><dt>총 리뷰</dt><dd>${fmtN(d.reviews)}개</dd></div>
    <div><dt>평균 평점</dt><dd>${d.rating ? d.rating.toFixed(1) : '정수 평점(표시 안 함)'}</dd></div>
  </dl></section>
</div>`;

  // 리뷰 기반 구매 판단 — review101 은 9개 카드(한 줄 정리·스펙·장점·단점·활용·배송·기준·결론·FAQ). 우리 데이터로 채울 수 있는 것만.
  const parts = Object.entries(PART_LABEL).map(([k, [label, max]]) => {
    const v = d.parts[k] ?? 0;
    return `<li><span>${label}</span><span class="bar"><i style="width:${Math.round((v / max) * 100)}%"></i></span><b>${v}<small>/${max}</small></b></li>`;
  }).join('');
  const jcards = [
    ['📋', `${esc(row.name)} 한 줄 정리`, `<p>${esc(d.summary)}</p>`],
    d.attrs.length ? ['💬', '구매자 리뷰 항목 평가', `<ul class="attrs">${d.attrs.map((a) => `<li><span class="a-l">${esc(a.label)}</span><span class="bar"><i style="width:${a.pct}%"></i></span><span class="a-v">"${esc(a.top)}" <b>${a.pct}%</b></span></li>`).join('')}</ul>`] : null,
    ['👍', '리뷰 기반 장점', `<ul class="dot-list">${reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`],
    ['⚠️', '단점 및 주의사항', `<ul class="dot-list">${d.unfit.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`],
    d.pricePct != null ? ['💰', '같은 분류 안 가격 위치', `<div class="pmap"><span class="pmap-track"><i style="left:${d.pricePct}%"></i></span><span class="pmap-l">싼 쪽</span><span class="pmap-r">비싼 쪽</span></div>
      <p>${esc(d.leaf)} ${fmtN(d.leafN)}개 중 <b>${d.pricePct <= 50 ? `싼 쪽 하위 ${Math.max(1, d.pricePct)}%` : `비싼 쪽 상위 ${Math.max(1, 100 - d.pricePct)}%`}</b>, 중앙값 ${won(d.leafMedian)}.</p>`] : null,
    ['🧮', '구매 점수 계산', `<ul class="parts">${parts}</ul><p class="muted"><a href="/about/">계산 방법</a> — 판매처·광고비는 반영하지 않습니다.</p>`],
    ['✅', '현명한 선택 기준', `<ol class="num-list">${d.checks.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`],
    ['🏁', '최종 결론', `<p><b>${esc(d.label)}</b> — ${esc(verdictLine(d.score))}</p>${buy('verdict', '판매 페이지에서 확인하기', 'btn btn-primary btn-sm')}`],
    ['❓', '자주 묻는 질문 (FAQ)', d.faq.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')],
  ].filter(Boolean);
  const judge = `<section class="kcard"><h2 class="kh">리뷰 기반 구매 판단</h2>
    <div class="jgrid">${jcards.map(([ic, h, b]) => `<section class="jcard"><h3><span aria-hidden="true">${ic}</span>${h}</h3>${b}</section>`).join('')}</div>
  </section>`;

  const others = d.alts?.length ? `<section class="kcard side-list"><h2 class="kh">같은 ${esc(d.leaf)} 다른 후기 제품</h2>
    ${d.alts.map((a) => `<a class="oth" href="/p/${esc(a.id)}/" data-pos="alt">${a.img ? `<img src="${esc(img(a.img, 300))}" alt="" loading="lazy" width="44" height="44" onerror="this.remove()">` : '<span class="oth-ph"></span>'}<span><b>${esc(a.name)}</b><small>구매 점수 ${a.score}점 · ${won(a.price)}</small></span></a>`).join('')}
  </section>` : '';
  const specSide = d.spec.length ? `<section class="kcard side-list"><h2 class="kh">제품 상세 정보</h2><dl class="kv kv-sm">${d.spec.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>` : '';

  const body = `
<div class="detail-bar"><h2>상품 및 리뷰 분석 상세</h2><a class="btn btn-light btn-sm" href="${catHref(d.cats)}">← 목록으로</a></div>
<p class="disc-line">* 이 페이지의 구매 버튼은 네이버 쇼핑 커넥트 제휴 링크이며, 구매 시 일정액의 수수료를 받습니다.</p>
${hero}
${decision}
${fitGrid}
${checkGrid}
<div class="detail-cols">
  <div>${judge}</div>
  <aside class="detail-side">${others}${specSide}</aside>
</div>
<p class="back"><a class="btn btn-light" href="${catHref(d.cats)}">← 목록으로 돌아가기</a></p>
<div class="sticky">${buy('sticky')}</div>
<script>(function(){var m=document.getElementById('gal-main'),c=document.getElementById('gal-count');document.querySelectorAll('.gal-th').forEach(function(b){b.addEventListener('click',function(){m.src=b.dataset.src;if(c)c.textContent=b.dataset.i+' / '+c.textContent.split('/')[1].trim();document.querySelectorAll('.gal-th.on').forEach(function(x){x.classList.remove('on')});b.classList.add('on')})})})();</script>`;

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
  return layout({ title, description, canonical, body, jsonld, env, nav: 'category' });
}
