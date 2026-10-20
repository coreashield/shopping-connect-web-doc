// 한국어 굵게 표시 깨짐 보정 (2026-10-20 점검: 색인 글 1,144개 중 47개에 "**"가 그대로 보임).
// CommonMark 규칙상 닫는 ** 앞이 문장부호(괄호·따옴표·%)이고 바로 뒤가 글자(조사)면 굵게가 안 된다.
//   예: **높은 평점(5점 만점)**으로 → 화면에 별표가 그대로 남는다.
// 파서가 굵게로 못 묶고 남긴 글자 노드 안의 **…** 만 굵게(strong)로 바꾼다. 본문 파일은 고쳐 쓰지 않는다.
import { visit, SKIP } from 'unist-util-visit';

const PAIR = /\*\*([^*\n]+?)\*\*/g;

export default function remarkCjkBold() {
	return (tree) => {
		visit(tree, 'text', (node, index, parent) => {
			if (!parent || index == null || !node.value.includes('**')) return;
			const parts = [];
			let last = 0;
			for (const m of node.value.matchAll(PAIR)) {
				if (m.index > last) parts.push({ type: 'text', value: node.value.slice(last, m.index) });
				parts.push({ type: 'strong', children: [{ type: 'text', value: m[1] }] });
				last = m.index + m[0].length;
			}
			if (!parts.length) return;
			if (last < node.value.length) parts.push({ type: 'text', value: node.value.slice(last) });
			parent.children.splice(index, 1, ...parts);
			return [SKIP, index + parts.length];
		});
	};
}
