// FAQ 섹션 구조 교정 — 렌더 시점 (2026-09-28)
// 발행기는 FAQ 를 "### 자주 묻는 질문" + "Q1. 질문\nA1. 답" 문단으로 쓴다. 그러면
//   1) FAQ 소제목이 H3 라서 바로 앞 H2(비교 섹션 등)의 하위로 묶이고
//   2) 질문이 문단 속 한 줄이라 검색엔진·AI 가 질문-답 쌍으로 읽지 못한다.
// 원문을 고쳐 쓰지 않고 AST 에서 "## 자주 묻는 질문" + 질문마다 H3 + 답 문단으로 바꾼다.
// 질문형 소제목은 목차에도 잡히고, BlogPost 의 FAQPage 구조화 데이터와 같은 쌍을 가리킨다.
import { toString } from 'mdast-util-to-string';

const FAQ_TITLE = '자주 묻는 질문';
const Q_PREFIX = /^\s*Q\d+[.)]\s*/;
const A_PREFIX = /^\s*A\d+[.)]\s*/;

function stripPrefix(nodes, re) {
	const first = nodes[0];
	if (first?.type === 'text') {
		first.value = first.value.replace(re, '');
		if (!first.value) nodes.shift();
	}
	return nodes;
}

// "Q1. 질문\nA1. 답" 한 문단을 질문 인라인 노드와 답 인라인 노드로 나눈다
function splitQA(children) {
	for (let i = 0; i < children.length; i++) {
		const c = children[i];
		if (c.type === 'break') return [children.slice(0, i), children.slice(i + 1)];
		if (c.type === 'text' && c.value.includes('\n')) {
			const at = c.value.indexOf('\n');
			const q = [...children.slice(0, i), { type: 'text', value: c.value.slice(0, at).trimEnd() }];
			const a = [{ type: 'text', value: c.value.slice(at + 1) }, ...children.slice(i + 1)];
			return [q, a];
		}
	}
	return [children, []];
}

export default function remarkFaq() {
	return (tree) => {
		const kids = tree.children;
		const start = kids.findIndex((n) => n.type === 'heading' && n.depth >= 2 && toString(n).trim() === FAQ_TITLE);
		if (start < 0) return;
		kids[start].depth = 2;

		const out = [];
		let i = start + 1;
		for (; i < kids.length; i++) {
			const n = kids[i];
			if (n.type === 'heading' && n.depth <= 2) break;
			if (n.type === 'paragraph' && n.children?.[0]?.type === 'text' && Q_PREFIX.test(n.children[0].value)) {
				const [q, a] = splitQA([...n.children]);
				out.push({ type: 'heading', depth: 3, children: stripPrefix(q, Q_PREFIX) });
				const answer = stripPrefix(a, A_PREFIX);
				if (answer.length && toString({ type: 'paragraph', children: answer }).trim()) out.push({ type: 'paragraph', children: answer });
				continue;
			}
			// 질문과 답이 다른 문단으로 나뉜 경우 — 답 문단의 "A1." 만 뗀다
			if (n.type === 'paragraph' && n.children?.[0]?.type === 'text' && A_PREFIX.test(n.children[0].value)) {
				stripPrefix(n.children, A_PREFIX);
			}
			out.push(n);
		}
		kids.splice(start + 1, i - start - 1, ...out);
	};
}
