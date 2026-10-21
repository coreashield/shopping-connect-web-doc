#!/usr/bin/env node
/**
 * 대표 이미지·상품 사진 갤러리를 DB 상품 사진으로 교체 (2026-10-21).
 *
 * 문제: products.images 앞쪽 1~2장은 판매처 상단 배너·로고(12.jpg, M1.jpg, pc.jpg, uuid PNG)인 경우가 많다.
 *   판매중 42,464개 중 "상품 사진" 파일명({숫자8+}_{숫자}.jpg)이 맨 앞인 상품은 42%뿐,
 *   그런 사진이 하나라도 있는 상품은 97% — 앞에서부터 그 패턴을 고르면 대표 이미지가 된다(표본 24/24 상품 사진).
 *
 * 하는 일: 블로그 글마다 productId 로 DB images 를 읽어
 *   heroImage = 첫 상품 사진, gallery = 상품 사진 최대 5장 (프론트매터 두 줄만 바꾼다. 본문·다른 필드 무변경)
 *   상품 사진이 하나도 없으면 그대로 둔다.
 *
 * 사용: node scripts/backfill_product_photos.mjs [--dry] [--env <.env 경로>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { isProductPhoto } from './lib/product_photo.mjs';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const envPath = args.includes('--env') ? args[args.indexOf('--env') + 1] : 'F:/기타/새 폴더/shopping_connect/.env';
const env = Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
const URL_ = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY 없음');

const DIR = path.resolve('src/content/blog');
const files = fs.readdirSync(DIR).filter((f) => /\.mdx?$/.test(f));
const pidOf = (fm, f) => fm.match(/^productId:\s*"?(\d{6,})"?/m)?.[1] ?? f.match(/-(\d{6,})-\d{8}\.mdx?$/)?.[1];

const posts = [];
for (const f of files) {
	const txt = fs.readFileSync(path.join(DIR, f), 'utf8');
	const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!m) continue;
	const pid = pidOf(m[1], f);
	if (pid) posts.push({ f, pid, txt, fm: m[1] });
}
const ids = [...new Set(posts.map((p) => p.pid))];
console.log(`글 ${files.length} · productId 있는 글 ${posts.length} · 상품 ${ids.length}`);

const images = new Map();
for (let i = 0; i < ids.length; i += 150) {
	const chunk = ids.slice(i, i + 150);
	const r = await fetch(`${URL_}/rest/v1/products?product_id=in.(${chunk.join(',')})&select=product_id,images`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
	if (!r.ok) throw new Error(`supabase ${r.status}`);
	for (const row of await r.json()) images.set(String(row.product_id), Array.isArray(row.images) ? row.images : []);
}

const q = (s) => `"${s}"`;
let changed = 0, noPhoto = 0, same = 0;
for (const p of posts) {
	const photos = [...new Set((images.get(p.pid) || []).map((u) => String(u).replace(/\?.*$/, '')).filter(isProductPhoto))].slice(0, 5);
	if (!photos.length) { noPhoto++; continue; }
	let fm = p.fm.replace(/^gallery:.*(\r?\n {2,}- .*)*\r?\n?/m, '');
	const heroLine = `heroImage: ${q(photos[0])}`;
	fm = /^heroImage:/m.test(fm) ? fm.replace(/^heroImage:.*$/m, heroLine) : `${fm}\n${heroLine}`;
	fm = fm.replace(/^heroImage:.*$/m, (l) => `${l}\ngallery: [${photos.map(q).join(', ')}]`);
	if (fm === p.fm) { same++; continue; }
	changed++;
	if (!DRY) fs.writeFileSync(path.join(DIR, p.f), p.txt.replace(p.fm, () => fm));
}
console.log(`${DRY ? '[dry] ' : ''}변경 ${changed} · 그대로 ${same} · 상품 사진 없음(유지) ${noPhoto}`);
