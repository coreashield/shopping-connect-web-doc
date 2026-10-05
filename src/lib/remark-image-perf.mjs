// 본문 상품 이미지 가볍게 (렌더 시점) — 2026-10-05.
// 성능 진단: 글 하나의 본문 이미지가 원본 크기로 ~1.9MB, 지연 로딩 없음 → 모바일 LCP 6~16초(실험실).
// 네이버 이미지 CDN 은 ?type=w640 로 줄여 준다(실측 241KB → 72KB). 본문 칼럼이 720px 이하라 w640 이면 충분.
// 마크다운 이미지와 글에 직접 들어간 <img> 둘 다 처리. 쿼리가 이미 있는 주소·다른 호스트는 건드리지 않는다.
import { visit } from 'unist-util-visit';

const NAVER_IMG = /^https:\/\/(shop-phinf|shopping-phinf|phinf|dthumb-phinf)\.pstatic\.net\/[^?\s"')]+$/;
const shrink = (u) => (NAVER_IMG.test(u) ? `${u}?type=w640` : u);

export default function remarkImagePerf() {
	return (tree) => {
		visit(tree, 'image', (node) => {
			node.url = shrink(node.url);
			node.data = node.data || {};
			node.data.hProperties = { ...(node.data.hProperties || {}), loading: 'lazy', decoding: 'async' };
		});
		visit(tree, 'html', (node) => {
			if (!/<img\b/i.test(node.value)) return;
			node.value = node.value.replace(/<img\b([^>]*)>/gi, (m, attrs) => {
				let a = attrs.replace(/\bsrc="([^"]+)"/i, (s, u) => `src="${shrink(u)}"`);
				if (!/\bloading=/i.test(a)) a += ' loading="lazy"';
				if (!/\bdecoding=/i.test(a)) a += ' decoding="async"';
				return `<img${a}>`;
			});
		});
	};
}
