// 구매 판단 목록을 색 상자로 (2026-10-03 대표 지시 "강조할 부분은 색·크기를 알아서").
// "이런 경우에 맞다"(카페형 "이런 분께 맞아요") = 초록, "이런 경우엔 다른 유형을 본다"("다른 걸 보세요") = 주황.
// 제목 문단과 바로 뒤 목록에 클래스만 붙이고 모양은 BlogPost.astro CSS 가 정한다. 본문은 고쳐 쓰지 않는다.
import { visit } from 'unist-util-visit';

const toString = (n) => (n.value ?? '') + (n.children || []).map(toString).join('');
const addClass = (node, cls) => {
	node.data = node.data || {};
	node.data.hProperties = { ...(node.data.hProperties || {}), className: cls };
};

export default function remarkFitBox() {
	return (tree) => {
		visit(tree, 'paragraph', (node, index, parent) => {
			if (!parent || index == null) return;
			const t = toString(node).trim();
			const kind = /^이런 (경우에 맞다|분께 맞아요)$/.test(t) ? 'yes' : /^이런 (경우엔 다른 유형을 본다|분은 다른 걸 보세요)$/.test(t) ? 'no' : null;
			if (!kind) return;
			addClass(node, ['fit-title', `fit-${kind}`]);
			const next = parent.children[index + 1];
			if (next && next.type === 'list') addClass(next, ['fit-list', `fit-${kind}`]);
		});
	};
}
