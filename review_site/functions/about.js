// 점수 계산 방법·운영 원칙 /about/
import { layout, html, SITE } from '../lib/render.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  if (!url.pathname.endsWith('/')) return Response.redirect(`${url.origin}/about/`, 301);
  const body = `
<article class="sec prose">
  <h1>구매 판단 점수는 이렇게 계산해요</h1>
  <p>${SITE.name}는 판매처가 공개한 숫자만으로 상품을 비교합니다. 리뷰 원문을 옮기거나 써 보지 않은 경험을 지어내지 않습니다.</p>
  <h2>100점 = 4가지 합</h2>
  <table class="spec"><tbody>
    <tr><th>평점 (40점)</th><td>평점 3.5점 이하 0점, 5.0점 40점, 그 사이는 비례. 정수 평점(4.0·5.0)은 판매처 기본값일 수 있어 점수에 쓰지 않고 16점으로 둡니다.</td></tr>
    <tr><th>리뷰 수 (25점)</th><td>리뷰가 많을수록 평점을 믿을 수 있어 로그 비례. 리뷰 1만 개 이상이면 만점.</td></tr>
    <tr><th>같은 분류 가격 (20점)</th><td>같은 세부 분류 상품(5개 이상) 중 가격 순위. 가장 싸면 20점, 가장 비싸면 0점. 비교 대상이 적으면 10점.</td></tr>
    <tr><th>리뷰 항목 만족 (15점)</th><td>구매자가 고른 항목별 응답("아주 넉넉해요" 등)의 평균 비율. 항목 정보가 없으면 평점으로 대신합니다.</td></tr>
  </tbody></table>
  <h2>점수 구간</h2>
  <ul><li>85점 이상: 구매 고려 추천</li><li>72~84점: 조건이 맞으면 추천</li><li>58~71점: 다른 상품과 비교 후 결정</li><li>57점 이하: 신중히 검토</li></ul>
  <h2>지키는 원칙</h2>
  <ul>
    <li>판매처·광고비·수수료율은 점수에 넣지 않습니다.</li>
    <li>구매 버튼은 네이버 쇼핑 커넥트 제휴 링크입니다. 구매 시 운영자가 수수료를 받을 수 있습니다.</li>
    <li>판매가 끝난 상품은 다음 갱신 때 페이지를 내립니다. 가격은 매일 갱신하지만 실시간이 아니니 구매 전 판매 페이지에서 확인하세요.</li>
  </ul>
  <p>운영: <a href="${SITE.parent}/about/">쇼핑로그</a></p>
</article>`;
  return html(layout({ title: `점수 계산 방법 | ${SITE.name}`, description: '구매 판단 점수의 계산식(평점·리뷰 수·가격 위치·리뷰 항목)과 운영 원칙', canonical: `${SITE.origin}/about/`, body, env: context.env }));
}
