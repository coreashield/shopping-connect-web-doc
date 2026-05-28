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
			heroImage: z.optional(image()),
			// 쇼핑 리뷰 전용 필드 (모두 optional)
			productName: z.string().optional(),
			productPrice: z.number().optional(),
			productStore: z.string().optional(),
			affiliateUrl: z.string().url().optional(),
			naverUrl: z.string().url().optional(),
			category: z.string().optional(),
			rating: z.number().min(0).max(5).optional(),
			tags: z.array(z.string()).optional(),
		}),
});

export const collections = { blog };
