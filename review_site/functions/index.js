// 홈 — 분류 바로가기 + 리뷰 많은 상품 + 점수 높은 상품
import { sb, getCats, cached, CARD_COLS } from '../lib/db.js';
import { layout, card, catHref, esc, fmtN, html, SITE } from '../lib/render.js';

const ICON = { '패션의류': '👕', '패션잡화': '👜', '화장품/미용': '💄', '디지털/가전': '🔌', '가구/인테리어': '🛋️', '출산/육아': '🍼', '식품': '🥗', '스포츠/레저': '⛺', '생활/건강': '🧴', '여가/생활편의': '🎟️' };

export async function onRequestGet(context) {
  const { env } = context;
  return cached(context, async () => {
    const [cats, popular, best] = await Promise.all([
      getCats(context),
      sb(env, `product_pages?published=eq.true&select=${CARD_COLS}&order=review_count.desc&limit=12`),
      sb(env, `product_pages?published=eq.true&select=${CARD_COLS}&order=score.desc,review_count.desc&limit=12`),
    ]);
    const tops = Object.entries(cats.tree).sort((a, b) => b[1].n - a[1].n);
    const body = `
<section class="hero">
  <h1>사기 전에, 리뷰 데이터로 30초 판단</h1>
  <p>평점·리뷰 수·구매자 응답 비율과 같은 분류 가격을 모아 <b>${fmtN(cats.total)}개</b> 상품의 장단점과 확인할 것을 정리했어요.</p>
  <form class="search big" action="/search" method="get"><input name="q" type="search" placeholder="예: 전기히터, 마그네슘, 캠핑의자" aria-label="상품 검색" maxlength="40"><button>검색</button></form>
</section>
<section class="sec"><h2>분류별로 보기</h2>
  <div class="cats">${tops.map(([c, v]) => `<a href="${catHref([c])}"><span>${ICON[c] || '🛒'}</span>${esc(c)}<small>${fmtN(v.n)}</small></a>`).join('')}</div>
</section>
<section class="sec"><h2>리뷰가 가장 많은 상품</h2><div class="grid">${popular.map((p) => card(p, 'home_pop')).join('')}</div></section>
<section class="sec"><h2>구매 판단 점수가 높은 상품</h2><div class="grid">${best.map((p) => card(p, 'home_best')).join('')}</div></section>`;
    return html(layout({
      title: `${SITE.name} — 상품 후기 장단점·구매 전 체크`,
      description: SITE.desc, canonical: `${SITE.origin}/`, body, env,
      jsonld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: `${SITE.origin}/`, potentialAction: { '@type': 'SearchAction', target: `${SITE.origin}/search?q={q}`, 'query-input': 'required name=q' } }],
    }));
  });
}
