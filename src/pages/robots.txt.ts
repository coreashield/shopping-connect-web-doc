import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site';
export const GET: APIRoute = () => new Response(`User-agent: *\nAllow: /\n\nUser-agent: Yeti\nAllow: /\n\nUser-agent: Googlebot\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap-index.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
