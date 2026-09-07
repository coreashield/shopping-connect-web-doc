// 기존 글 전체에 summary 프론트매터를 채우고 본문의 TL;DR 박스를 제거한다 — GEO 2026-09-07
//   사용: node scripts/backfill_summary.mjs [--dry] [--limit N] [--force]
//   - summary 가 이미 있으면 건너뛴다(--force 로 재생성)
//   - updatedDate 는 건드리지 않는다(요약 추가는 본문 개정이 아니므로 사이트맵 lastmod 를 일괄 갱신하지 않는다)
//   - 본문에서 제거하는 것: "> **TL;DR**" 인용박스, 그리고 도입부의 "---/**라벨:**…/---" 구형 요약 블록
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSummary, classifyTldrLines } from './lib/build_summary.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLOG_DIR = path.join(ROOT, 'src/content/blog');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const FORCE = argv.includes('--force');
const LIMIT = Number((argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;

// 최소 YAML 파서: 이 저장소의 프론트매터는 writer 가 "key: value" 한 줄 형식으로만 쓴다.
function parseFrontmatter(text) {
	const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!m) return null;
	const data = {};
	for (const line of m[1].split(/\r?\n/)) {
		const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
		if (!kv) continue;
		let v = kv[2].trim();
		if (/^".*"$/.test(v)) v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
		else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
		data[kv[1]] = v;
	}
	return { data, raw: m[0], body: text.slice(m[0].length) };
}
const yamlStr = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`;

// TL;DR 박스 추출·제거. 반환: { lines, body }
function extractTldr(body) {
	const lines = body.split(/\r?\n/);
	let found = null;
	// (A) "> **TL;DR**" 로 시작하는 인용 블록
	for (let i = 0; i < Math.min(lines.length, 60); i++) {
		if (/^>\s*\*{0,2}\s*TL;?DR\s*\*{0,2}\s*$/i.test(lines[i])) {
			let j = i + 1;
			while (j < lines.length && /^>/.test(lines[j])) j++;
			found = { start: i, end: j, lines: lines.slice(i + 1, j) };
			break;
		}
	}
	// (B) 구형: "---" 사이에 "**라벨:** …" 줄이 3개 이상 들어간 블록 (도입부 30줄 이내)
	if (!found) {
		for (let i = 0; i < Math.min(lines.length, 30); i++) {
			if (!/^---\s*$/.test(lines[i])) continue;
			let j = i + 1;
			while (j < lines.length && j < i + 12 && !/^---\s*$/.test(lines[j])) j++;
			if (j >= lines.length || !/^---\s*$/.test(lines[j])) continue;
			const inner = lines.slice(i + 1, j);
			const labeled = inner.filter((l) => /^\*\*[^*]{1,14}\*\*\s*[:：]/.test(l.trim()) || /^[^:：]{1,14}[:：]\s*\S/.test(l.trim()) && /\*\*/.test(l)).length;
			if (labeled >= 3) { found = { start: i, end: j + 1, lines: inner }; break; }
		}
	}
	if (!found) return { lines: [], body };
	const rest = [...lines.slice(0, found.start), ...lines.slice(found.end)];
	// 제거 자리의 빈 줄 3개 이상 → 2개
	return { lines: found.lines, body: rest.join('\n').replace(/\n{3,}/g, '\n\n') };
}

const files = (await readdir(BLOG_DIR)).filter((f) => /\.mdx?$/.test(f)).sort();
let done = 0, skipped = 0, failed = 0, tldrRemoved = 0;
const samples = [];
for (const f of files) {
	if (done >= LIMIT) break;
	const p = path.join(BLOG_DIR, f);
	const text = await readFile(p, 'utf8');
	const fm = parseFrontmatter(text);
	if (!fm) { failed++; console.error(`✗ 프론트매터 없음: ${f}`); continue; }
	if (fm.data.summary && !FORCE) { skipped++; continue; }

	const { lines, body } = extractTldr(fm.body);
	const t = classifyTldrLines(lines);
	const summary = buildSummary(fm.data, t);
	if (!summary) { failed++; console.error(`✗ 요약 생성 실패: ${f}`); continue; }

	// 프론트매터: 기존 summary 줄 제거 후 description 다음에 삽입
	let raw = fm.raw.replace(/^summary:.*\r?\n/m, '');
	raw = raw.replace(/^(description:.*\r?\n)/m, `$1summary: ${yamlStr(summary)}\n`);
	if (!/^summary:/m.test(raw)) raw = raw.replace(/\r?\n---\r?\n?$/, `\nsummary: ${yamlStr(summary)}\n---\n`);
	const out = raw + body;
	if (lines.length) tldrRemoved++;
	if (samples.length < 5) samples.push({ f, summary, tldr: lines.length });
	if (!DRY) await writeFile(p, out, 'utf8');
	done++;
}
console.log(`${DRY ? '[DRY] ' : ''}summary 생성 ${done}건, 건너뜀(이미 있음) ${skipped}건, 실패 ${failed}건, TL;DR 박스 제거 ${tldrRemoved}건`);
for (const s of samples) console.log(`\n— ${s.f} (TL;DR ${s.tldr}줄)\n${s.summary}`);
