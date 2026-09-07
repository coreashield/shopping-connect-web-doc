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
			tags: z.array(z.string()).optional(),
		}),
});

export const collections = { blog };
