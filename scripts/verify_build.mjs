// 빌드 결과 검증: 본문이 빈 채로 렌더된 글(제목·구매버튼만 있고 본문 없음)을 검출.
// Astro Content Layer 렌더 플레이크로 소수 글이 빈 본문으로 빌드되는 사고 방지(2026-07-09 실측).
// 사용: node scripts/verify_build.mjs <dist경로>  (기본 dist)
// 빈 글 발견 시 exit 1 (워크플로에서 배포 차단).
// 원본: naver_brand_connect/tools/verify_web_doc_build.js — 이 저장소 단독 워크플로(deploy-sites.yml)용 사본.
import fs from 'fs';
import path from 'path';

const DIST = process.argv[2] || 'dist';
const BLOG_DIR = path.join(DIST, 'blog');

if (!fs.existsSync(BLOG_DIR)) {
	console.error(`❌ blog 디렉토리 없음: ${BLOG_DIR}`);
	process.exit(1);
}

// 마크다운 본문 문단은 Astro가 scope 없이 순수 <p>로 렌더한다.
// (구매버튼 buy-meta 등은 <p class="...">라 bare <p>와 구분됨)
// 정상 글은 intro+장점3+시나리오+FAQ = bare <p> 다수(실측 15~20). 빈 글은 0.
const MIN_BODY_P = 3;

const slugs = fs.readdirSync(BLOG_DIR).filter((d) => {
	try {
		return fs.statSync(path.join(BLOG_DIR, d)).isDirectory();
	} catch {
		return false;
	}
});

const empties = [];
let checked = 0;

for (const slug of slugs) {
	// 목록 페이지네이션(/blog/2/ … , [...page].astro)은 글이 아니라 본문 <p>가 없다.
	//   2026-08-27 템플릿 개편 후 이 페이지들이 "빈 본문"으로 오판돼 8/28~9/2 모든 배포가 차단됐다(실측).
	if (/^\d+$/.test(slug)) continue;
	const htmlPath = path.join(BLOG_DIR, slug, 'index.html');
	if (!fs.existsSync(htmlPath)) continue;
	const html = fs.readFileSync(htmlPath, 'utf8');
	checked++;
	const bareP = (html.match(/<p>/g) || []).length;
	const hasH2Body = /<h2 id=/.test(html); // 마크다운 ## 은 id 부여됨(관련글 aside h2는 id 없음)
	if (bareP < MIN_BODY_P && !hasH2Body) {
		empties.push({ slug, bareP });
	}
}

console.log(`🔍 검증: ${checked}개 글 확인, 빈 본문 ${empties.length}개`);
if (empties.length) {
	console.error('❌ 본문이 빈 글:');
	for (const e of empties) console.error(`   - ${e.slug} (bare <p>=${e.bareP})`);
	process.exit(1);
}
console.log('✅ 전 글 본문 정상');
