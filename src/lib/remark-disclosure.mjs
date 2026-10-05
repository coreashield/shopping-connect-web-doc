// 글 상단 대가성 고지 문구 정정(렌더 시점) — 2026-10-05.
// 발행기가 4,765개 글에 "쇼핑커넥트/쿠팡파트너스 등 제휴를 통해 …" 를 넣었는데, 이 사이트는 쿠팡파트너스를
// 쓰지 않는다(제휴 링크는 전부 네이버 쇼핑 커넥트). 고지는 사실이어야 하므로 글 파일을 고치지 않고
// 마크다운 AST 에서 문구만 바꾼다. 생성기(src/utils/disclosure.js)도 같은 날 고쳤다.
import { visit } from 'unist-util-visit';

const FIXES = [
	[/쇼핑\s?커넥트\s*\/\s*쿠팡\s?파트너스\s*등\s*제휴를\s*통해/g, '네이버 쇼핑 커넥트 활동의 일환으로'],
	[/쇼핑\s?커넥트\s*\/\s*쿠팡\s?파트너스\s*활동의\s*일환으로\s*일정\s*수수료/g, '네이버 쇼핑 커넥트 활동의 일환으로 소정의 수수료'],
	[/쇼핑\s?커넥트\s*\/\s*쿠팡\s?파트너스/g, '네이버 쇼핑 커넥트'],
];

export default function remarkDisclosure() {
	return (tree) => {
		visit(tree, 'text', (node) => {
			if (!/쿠팡\s?파트너스/.test(node.value)) return;
			let v = node.value;
			for (const [re, to] of FIXES) v = v.replace(re, to);
			node.value = v;
		});
	};
}
