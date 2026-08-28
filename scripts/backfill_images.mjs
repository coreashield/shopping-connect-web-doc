#!/usr/bin/env node
/**
 * backfill_images.mjs — 기존 글의 중복 이미지 제거 + alt 맥락화
 *
 * 배경(실측 2026-08-28, 글 3,707건):
 *   - 1,225건(33%)이 고유 이미지 1장뿐이고, 그중 611건은 같은 이미지를 2~5회 반복한다.
 *     tools/web_doc_writer.js가 이미지가 1장일 때 의도적으로 2회 더 삽입했기 때문
 *     (주석: "시각 효과 + SEO"). 동일 이미지 반복은 SEO 이득이 없고 분량 채우기로 읽힌다.
 *   - alt가 한 글 안에서 전부 동일하다(전부 상품명). 300건 표본 중 298건.
 *
 * 처리
 *   1. heroImage와 URL이 같은 본문 이미지 제거 (쿼리스트링 무시하고 비교)
 *   2. 본문 안에서 중복되는 이미지 제거 (첫 개만 유지)
 *   3. 남은 본문 이미지의 alt를 직전 ## 소제목으로 맥락화
 *
 * 안전장치
 *   - 기본은 dry-run. 실제 기록은 --apply 필요
 *   - 프론트매터는 건드리지 않는다(heroImage 유지)
 *   - 본문 이미지가 0개가 되는 것은 허용(heroImage는 남아 있으므로 이미지 없는 글이 되지 않는다)
 *
 * Usage:
 *   node scripts/backfill_images.mjs            # dry-run, 요약만
 *   node scripts/backfill_images.mjs --sample 3 # 변경 예시 3건 출력
 *   node scripts/backfill_images.mjs --apply    # 실제 기록
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APPLY = process.argv.includes('--apply');
const sampleIdx = process.argv.indexOf('--sample');
const SAMPLE = sampleIdx >= 0 ? Number(process.argv[sampleIdx + 1] || 3) : 0;

const BLOG = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/content/blog');
const norm = (u) => (u || '').split('?')[0].trim();

const stripBrackets = (s) => (s || '').replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();

function buildAlt(productName, header, index) {
	const base = stripBrackets(productName);
	const ctx = stripBrackets((header || '').replace(/^#+\s*/, ''));
	if (ctx && ctx.length <= 40) return `${base} — ${ctx}`;
	return `${base} 상세 이미지 ${index + 2}`; // heroImage가 1번
}

// --only <파일명>: 한 글만 처리(검증용)
const onlyIdx = process.argv.indexOf('--only');
const ONLY = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;

let files = fs.readdirSync(BLOG).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
if (ONLY) files = files.filter((f) => f === ONLY);
let changed = 0, imgsRemoved = 0, altsRewritten = 0, skipped = 0;
const samples = [];

for (const file of files) {
	const full = path.join(BLOG, file);
	const src = fs.readFileSync(full, 'utf8');

	// 콘텐츠 파일은 CRLF다. JS 정규식에서 \r은 줄 종결자라 /(.*)$/가 헤더 매칭에 실패한다
	//   (이미지 정규식은 \s*가 \r을 흡수해 통과 → 이미지만 처리되고 소제목은 전부 null이 된다).
	//   LF로 정규화해 처리하고, 원본이 CRLF였으면 기록할 때 되돌린다.
	const hadCRLF = src.includes('\r\n');
	const text = hadCRLF ? src.replace(/\r\n/g, '\n') : src;

	const fmEnd = text.indexOf('\n---', 4);
	if (!text.startsWith('---') || fmEnd < 0) { skipped++; continue; }
	const fm = text.slice(0, fmEnd + 4);
	let body = text.slice(fmEnd + 4);

	const hero = norm(fm.match(/^heroImage:\s*"([^"]+)"/m)?.[1]);
	const productName = fm.match(/^productName:\s*"([^"]+)"/m)?.[1]
		?? fm.match(/^title:\s*"([^"]+)"/m)?.[1] ?? '';

	// 본문을 줄 단위로 훑으며 직전 ## 소제목을 추적한다.
	const lines = body.split('\n');
	const seen = new Set(hero ? [hero] : []);
	let removedHere = 0, altsHere = 0, kept = 0, header = null;
	const out = [];

	for (const line of lines) {
		const h = line.match(/^##\s+(.*)$/);
		if (h) header = h[1];

		// 이미지만 있는 줄만 대상으로 한다(문장 중간 인라인 이미지는 건드리지 않는다).
		const m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
		if (!m) { out.push(line); continue; }

		const url = norm(m[2]);
		if (seen.has(url)) { removedHere++; continue; } // heroImage 또는 앞선 본문 이미지와 중복
		seen.add(url);

		const alt = buildAlt(productName, header, kept);
		if (alt !== m[1]) altsHere++;
		kept++;
		out.push(`![${alt}](${m[2]})`);
	}

	if (!removedHere && !altsHere) continue;

	let next = out.join('\n');
	// 이미지 제거로 생긴 3줄 이상 연속 공백을 정리
	next = next.replace(/\n{3,}/g, '\n\n');

	changed++;
	imgsRemoved += removedHere;
	altsRewritten += altsHere;

	if (samples.length < SAMPLE) {
		samples.push({ file, removedHere, altsHere, before: body.trim().slice(0, 300), after: next.trim().slice(0, 300) });
	}
	if (APPLY) {
		const outText = fm + next;
		fs.writeFileSync(full, hadCRLF ? outText.replace(/\n/g, '\r\n') : outText, 'utf8');
	}
}

console.log(`대상 글:        ${files.length}`);
console.log(`변경된 글:      ${changed}`);
console.log(`제거된 중복 이미지: ${imgsRemoved}`);
console.log(`재작성된 alt:   ${altsRewritten}`);
if (skipped) console.log(`건너뜀(프론트매터 파싱 실패): ${skipped}`);

for (const s of samples) {
	console.log(`\n──── ${s.file}  (이미지 -${s.removedHere}, alt ${s.altsHere}건)`);
	console.log('--- before ---\n' + s.before);
	console.log('--- after ----\n' + s.after);
}

console.log(APPLY ? '\n✓ 기록 완료' : '\n(dry-run — 실제 기록하려면 --apply)');
