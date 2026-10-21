// 네이버 스마트스토어 "상품 사진" 판별 (2026-10-21).
//   판매자가 올린 상품 대표·추가 이미지는 {숫자8+}_{숫자}.jpg 형식 파일명을 받는다(예: 16411783432469977_121355606.jpg).
//   판매처 상단 배너·로고는 올린 이름 그대로 남는다(12.jpg, M1.jpg, pc.jpg, 모바일.jpg, uuid.png).
//   src/lib/snippet.ts isProductPhoto 와 같은 규칙.
export const PRODUCT_PHOTO_RE = /^https:\/\/shop-phinf\.pstatic\.net\/.+\/\d{8,}_\d+\.(jpe?g|png)$/i;
export const isProductPhoto = (u) => PRODUCT_PHOTO_RE.test(String(u || '').replace(/\?.*$/, ''));
