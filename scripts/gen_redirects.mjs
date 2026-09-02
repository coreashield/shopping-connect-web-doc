// 본체 빌드 전: 서브도메인으로 분리된 카테고리의 글 URL을 301로 넘기는 public/_redirects 생성.
//   서브 빌드(SITE_CATEGORY 있음)에서는 파일을 비운다. Cloudflare Pages 정적 리다이렉트 한도 2,000줄.
import fs from 'node:fs';
import path from 'node:path';
const SUB = { '디지털/가전': 'https://digital.shopping-log.com', '식품': 'https://food.shopping-log.com' };
const SLUG = { '디지털/가전': 'digital', '식품': 'food' };
const out = 'public/_redirects';
if ((process.env.SITE_CATEGORY || '').trim()) { fs.writeFileSync(out, ''); console.log('[redirects] sub build → empty'); process.exit(0); }
const dir = 'src/content/blog';
const lines = [];
for (const f of fs.readdirSync(dir)) {
	if (!/\.mdx?$/.test(f)) continue;
	const head = fs.readFileSync(path.join(dir, f), 'utf8').slice(0, 2000);
	const cat = head.match(/^category:\s*"?([^"\n]+)"?/m)?.[1]?.trim().split('>')[0]?.trim();
	if (!cat || !SUB[cat]) continue;
	const slug = f.replace(/\.mdx?$/, '');
	lines.push(`/blog/${slug}/ ${SUB[cat]}/blog/${slug}/ 301`);
}
for (const [cat, host] of Object.entries(SUB)) lines.push(`/category/${SLUG[cat]}/ ${host}/ 301`);
if (lines.length > 1990) console.warn(`[redirects] ${lines.length}줄 — Pages 한도(2,000) 임박, 서브별 사이트맵/규칙 통합 검토 필요`);
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`[redirects] ${lines.length} rules → ${out}`);
