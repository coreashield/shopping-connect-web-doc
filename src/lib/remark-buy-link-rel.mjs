// 본문 마크다운의 구매 링크([👉 …](/go/…))에 rel="nofollow sponsored" 를 붙인다.
// 레이아웃 구매 버튼은 이미 붙어 있는데 발행기가 본문에 넣는 링크는 맨 링크라
// 검색엔진에 제휴 링크임을 알리지 못하고 크롤러가 따라갔다(10/3).
import { visit } from 'unist-util-visit';

export default function remarkBuyLinkRel() {
	return (tree) => {
		visit(tree, 'link', (node) => {
			if (typeof node.url !== 'string' || !node.url.startsWith('/go/')) return;
			// 10/5: 버튼 위치 측정 — 본문 링크는 pos=body (functions/go 가 slug#body 로 기록)
			if (!/[?&]pos=/.test(node.url)) node.url += (node.url.includes('?') ? '&' : '?') + 'pos=body';
			node.data = node.data || {};
			node.data.hProperties = { ...(node.data.hProperties || {}), rel: 'nofollow sponsored noopener', target: '_blank' };
		});
	};
}
