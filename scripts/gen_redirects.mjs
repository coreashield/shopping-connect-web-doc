// 본체 빌드 전: 서브도메인으로 분리된 카테고리의 글 URL을 301로 넘기는 public/_redirects 생성.
//   서브 빌드(SITE_CATEGORY 있음)에서는 파일을 비운다. Cloudflare Pages 정적 리다이렉트 한도 2,000줄.
import fs from 'node:fs';
import path from 'node:path';
const SUB = { '디지털/가전': 'https://digital.shopping-log.com', '식품': 'https://food.shopping-log.com' };
const SLUG = { '디지털/가전': 'digital', '식품': 'food' };
const out = 'public/_redirects';
if ((process.env.SITE_CATEGORY || '').trim()) { fs.writeFileSync(out, ''); console.log('[redirects] sub build → empty'); process.exit(0); }
const dir = 'src/content/blog';
// 11/9: 규칙이 2,571줄로 한도를 넘어 초과분(22%)과 맨 끝 분류 규칙이 조용히 무시돼 404가 났다.
//   → 분류 규칙을 맨 앞에 두고 글은 오래된 순으로 채운다. 잘리는 쪽은 9/2 분리 뒤에 쓴 최신 글(본체 주소로 운영된 적 없음).
const MAX_RULES = 1990;
const posts = [];
for (const f of fs.readdirSync(dir)) {
	if (!/\.mdx?$/.test(f)) continue;
	const head = fs.readFileSync(path.join(dir, f), 'utf8').slice(0, 2000);
	const cat = head.match(/^category:\s*"?([^"\n]+)"?/m)?.[1]?.trim().split('>')[0]?.trim();
	if (!cat || !SUB[cat]) continue;
	const slug = f.replace(/\.mdx?$/, '');
	posts.push({ slug, date: slug.match(/-(\d{8})$/)?.[1] ?? '', line: `/blog/${slug}/ ${SUB[cat]}/blog/${slug}/ 301` });
}
posts.sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
const lines = Object.entries(SUB).map(([cat, host]) => `/category/${SLUG[cat]}/ ${host}/ 301`);
const kept = posts.slice(0, MAX_RULES - lines.length);
lines.push(...kept.map((p) => p.line));
if (kept.length < posts.length) console.warn(`[redirects] 한도로 글 규칙 ${posts.length - kept.length}개 제외 (${kept.at(-1).date} 이후 최신 글)`);
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`[redirects] ${lines.length} rules → ${out}`);
