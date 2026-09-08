// 기존 summary 프론트매터에서 가격·평점 문장을 제거한다 (2026-09-08, 렌더 시점 생성으로 이전).
//   대상 문장: "YYYY년 M월 기준 … 원이다." / "… 원이고 구매자 평점은 … 점이다." / "YYYY년 M월 기준 구매자 평점은 … 점이다."
//   사용: node scripts/strip_summary_price.mjs [--dry]
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLOG_DIR = path.join(ROOT, 'src/content/blog');
const DRY = process.argv.includes('--dry');
const PRICE_RE = /\s?\d{4}년 \d{1,2}월 기준 .*?(?:원이다|점이다)\./;

const files = (await readdir(BLOG_DIR)).filter((f) => /\.mdx?$/.test(f)).sort();
let changed = 0, untouched = 0;
const samples = [];
for (const f of files) {
	const p = path.join(BLOG_DIR, f);
	const text = await readFile(p, 'utf8');
	const m = text.match(/^summary: "(.*)"\r?$/m);
	if (!m) { untouched++; continue; }
	const before = m[1];
	const after = before.replace(PRICE_RE, '').replace(/\s{2,}/g, ' ').trim();
	if (after === before) { untouched++; continue; }
	if (samples.length < 3) samples.push({ f, before, after });
	if (!DRY) await writeFile(p, text.replace(m[0], `summary: "${after}"`), 'utf8');
	changed++;
}
console.log(`${DRY ? '[DRY] ' : ''}가격 문장 제거 ${changed}건, 변경 없음 ${untouched}건`);
for (const s of samples) console.log(`\n— ${s.f}\n  전: ${s.before.slice(0, 220)}\n  후: ${s.after.slice(0, 220)}`);
