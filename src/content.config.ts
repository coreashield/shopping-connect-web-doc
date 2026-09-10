import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// GEO(2026-09-07): 정의문+숫자로 된 자기완결 요약 문단. 본문 최상단·BlogPosting.abstract 에 노출
			summary: z.string().optional(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.union([image(), z.string().url()]).optional(),
			// 쇼핑 리뷰 전용 필드 (모두 optional)
			productName: z.string().optional(),
			productPrice: z.number().optional(),
			productStore: z.string().optional(),
			affiliateUrl: z.string().url().optional(),
			naverUrl: z.string().url().optional(),
			productId: z.string().optional(),  // 클릭 귀속 추적용 (/go/{productId})
			category: z.string().optional(),
			rating: z.number().min(0).max(5).optional(),
			reviewCount: z.number().int().optional(),        // 가격 갱신 스크립트(web_doc_price_sync)가 채움
			priceCheckedAt: z.string().optional(),            // 가격·평점 자료 시점(YYYY-MM-DD). 렌더 문장의 기준 연월에 사용
			saleStatus: z.enum(['on_sale', 'discontinued']).optional(), // 직접 확인 결과. discontinued = 판매처 상품 페이지 삭제
			tags: z.array(z.string()).optional(),
		}),
});

// 질문·비교형 가이드(카테고리 분리 실험 2026-09-02): 소분류 하나 = 페이지 하나, 상품 5~7개 묶음
const guides = defineCollection({
	loader: glob({ base: './src/content/guides', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		category: z.string(),          // "디지털/가전>계절가전>제습기"
		query: z.string(),             // 검색어 핵심 (소분류명)
		related: z.array(z.string()).optional(),
		heroImage: z.string().url().optional(),
		products: z.array(z.object({
			productId: z.string(), name: z.string(), price: z.number(), image: z.string().url(),
			affiliateUrl: z.string().url(), naverUrl: z.string().url().optional(),
			rating: z.number().optional(), reviewCount: z.number().optional(), store: z.string().optional(),
		})),
		faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
	}),
});


// 여행 커넥트 패키지(2026-09-10). 본체 사이트에만 생성한다.
//   인스타 캡션은 URL을 링크로 만들지 않는다 — 클릭 가능한 목적지를 사이트에 두기 위한 컬렉션.
//   가격·출발일은 판매처(네이버 티켓·패키지) 표시값이며 priceCheckedAt 시점 기준이다.
const travel = defineCollection({
	loader: glob({ base: './src/content/travel', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		// 첫 화면에 그대로 노출되는 자기완결 요약. 정의문 + 숫자로 134~167단어 권장(AI 인용 최적 길이).
		summary: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImage: z.string().url().optional(),

		// ── 상품 ──
		productName: z.string(),                 // 판매처 표기 그대로
		agency: z.string(),                      // 롯데관광 / 하나투어 …
		destination: z.string(),                 // "영국 에든버러"
		price: z.number(),                       // 성인 1인 정가(원)
		salePrice: z.number().optional(),        // 할인 적용가
		nights: z.string(),                      // "8박 10일"
		departureDate: z.string(),               // YYYY-MM-DD
		returnDate: z.string().optional(),
		airline: z.string().optional(),
		departureAirport: z.string().optional(),
		status: z.enum(['available', 'confirmed', 'urgent', 'sold_out']),
		seats: z.number().int().optional(),      // 한정 좌석 상품만
		highlights: z.array(z.string()).default([]),

		// ── 링크·측정 ──
		// affiliateUrl 은 브랜드커넥트가 발급한 주소 그대로 둔다(운영정책: 링크 변조 금지).
		// 클릭 귀속은 /go/{connectId}?u={affiliateUrl} 302 로 처리한다 — 주소 자체는 바뀌지 않는다.
		affiliateUrl: z.string().url(),
		connectId: z.string(),
		productUrl: z.string().url().optional(), // 판매처 원본(참고 표기용)
		reelUrl: z.string().url().optional(),    // 인스타 릴스 — VideoObject + 임베드
		reelId: z.string().optional(),
		reelUploadDate: z.string().optional(),   // YYYY-MM-DD
		reelDuration: z.string().optional(),     // ISO8601 (PT33S)

		priceCheckedAt: z.string(),              // YYYY-MM-DD — 가격 확인 시점
		faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
	}),
});

export const collections = { blog, guides, travel };
