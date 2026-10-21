# review.shopping-log.com — 상품 데이터 페이지 (2026-10-21)

review101.kr 벤치마크: 상품 1개 = 데이터 페이지 1개. 판매중 상품 전부(블로그 글 있는 상품 제외)를 물결로 공개한다.

- 데이터: Supabase `product_pages` (생성기 `scripts/build_product_pages.mjs`)
- 화면: Cloudflare Pages Functions (`functions/`) — 파일 2만 개 한도 때문에 정적으로 굽지 않고 요청 때 그려 엣지 캐시(하루)
- 배포: Cloudflare Pages 프로젝트 `shopping-log-review` (`.github/workflows/review-site.yml`)
- 물결: 1=리뷰 수 상위 5,000 · 2=리뷰 100+ · 3=나머지. `--publish-wave N` 으로 공개 범위.
  다음 물결 기준(공개 2주 뒤): 노출 받은 페이지 5%+, 본체 shopping-log 노출 유지.

```
node --env-file=<.env> review_site/scripts/build_product_pages.mjs --publish-wave 1
cd review_site && npx wrangler pages deploy public --project-name shopping-log-review --branch main
```
