// "이런 경우엔 다른 유형을 본다" 목록 바로 뒤에 같은 분류 가격 비교표로 가는 링크를 붙인다 (2026-10-03).
// 조건이 안 맞는 독자를 떠나보내지 않고 다른 선택지(비교표의 "가격 보기")로 잇는다. 본문을 고쳐 쓰지 않고 렌더 시점에.
import { visit } from 'unist-util-visit';

const toString = (n) => (n.value ?? '') + (n.children || []).map(toString).join('');

export default function remarkAltLink() {
	return (tree) => {
		visit(tree, 'paragraph', (node, index, parent) => {
			if (!parent || index == null) return;
			if (!/^이런 (경우엔 다른 유형을 본다|분은 다른 걸 보세요)/.test(toString(node).trim())) return;
			const next = parent.children[index + 1];
			const at = next && next.type === 'list' ? index + 2 : index + 1;
			parent.children.splice(at, 0, {
				type: 'paragraph',
				children: [{ type: 'link', url: '#compare-title', children: [{ type: 'text', value: '→ 같은 분류의 다른 상품 가격 비교 보기' }] }],
			});
			return index + 2;
		});
	};
}
