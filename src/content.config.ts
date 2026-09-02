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

export const collections = { blog, guides };
