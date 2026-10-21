// 구글 색인 요청 후보 목록 → review_site/gsc_urls.json (라이브 repo tools/gsc_aside.mjs --urls-file 이 읽음, 요청 이력으로 중복 제외)
//   순서: 홈 → 대분류 → 2단계 분류(상품 5+) → 리뷰 많은 상품 300
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const O = 'https://review.shopping-log.com';
const seg = (c) => encodeURIComponent(String(c).replace(/\//g, '·'));
const { tree } = JSON.parse(fs.readFileSync(path.join(HERE, '../public/_data/cats.json'), 'utf8'));
const tops = Object.entries(tree).sort((a, b) => b[1].n - a[1].n);
const urls = [`${O}/`, ...tops.filter(([, v]) => v.n >= 5).map(([c]) => `${O}/c/${seg(c)}/`)];
for (const [c1, v1] of tops) for (const [c2, v2] of Object.entries(v1.k).sort((a, b) => b[1].n - a[1].n)) if (v2.n >= 5) urls.push(`${O}/c/${seg(c1)}/${seg(c2)}/`);
const { SUPABASE_URL: SB, SUPABASE_SERVICE_KEY: SK } = process.env;
const rows = await (await fetch(`${SB}/rest/v1/product_pages?published=eq.true&select=product_id&order=review_count.desc&limit=300`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } })).json();
urls.push(...rows.map((r) => `${O}/p/${r.product_id}/`));
fs.writeFileSync(path.join(HERE, '../gsc_urls.json'), JSON.stringify(urls));
console.log(`gsc_urls.json ${urls.length}`);

// --run N : 목록을 만든 뒤 라이브 repo gsc_aside.mjs 로 N건 요청(배치 파일은 ASCII 만 써야 해서 한글 경로는 여기서 다룬다)
const ri = process.argv.indexOf('--run');
if (ri > 0) {
  const { spawnSync } = await import('node:child_process');
  const LIVE = 'F:/기타/새 폴더/shopping_connect';
  const r = spawnSync(process.execPath, [`${LIVE}/tools/gsc_aside.mjs`, '--skip-fetch', '--limit', String(Number(process.argv[ri + 1]) || 5), '--urls-file', path.join(HERE, '../gsc_urls.json')], { cwd: LIVE, stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
