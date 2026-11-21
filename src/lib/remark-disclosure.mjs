// 글 상단 제휴 고지 정리(렌더 시점) — 2026-10-05, 11/22 개편.
// 발행기가 글 맨 위에 "> ⚠️ **대가성 콘텐츠 안내** — 본 포스팅은 … 수수료를 제공받습니다." 를 넣는다(글 파일 1만여 개,
// 문구 3종). 글 파일은 고치지 않고 마크다운 AST 에서 바꾼다.
//  - 11/22 대표 결정 ①: 고지가 본문(17px)보다 큰 인용 블록(1.33배·굵게)이라 글보다 광고 표시가 먼저 보였다
//    → class="disclosure" 를 붙여 본문보다 약간 작은 보통 굵기 한 줄 상자로(global.css blockquote.disclosure).
//  - 11/22 대표 결정 ②: 쿠팡·토스 등 다른 제휴도 붙일 예정이라 특정 프로그램 이름("네이버 쇼핑 커넥트")을 빼고
//    사실 그대로의 일반 문구로 통일. 프로그램별 필수 문구가 필요한 링크(예: 쿠팡 파트너스)는 그 링크를 쓰는
//    글에서 EXTRA 로 덧붙인다(아직 없음).
// 고지는 "글 첫머리에, 쉽게 알아볼 수 있게"가 기준이라 위치는 그대로 맨 위다. 더 작게·더 흐리게 만들지 말 것.
import { visit } from 'unist-util-visit';

export const DISCLOSURE_TEXT = '이 글에는 제휴 링크가 포함되어 있으며, 링크를 통해 구매하면 쇼핑로그가 일정액의 수수료를 제공받습니다.';

const textOf = (node) => (node.value != null ? node.value : (node.children || []).map(textOf).join(''));

export default function remarkDisclosure() {
	return (tree) => {
		visit(tree, 'blockquote', (node) => {
			if (!/대가성\s*콘텐츠\s*안내/.test(textOf(node))) return;
			node.data = { ...(node.data || {}), hProperties: { ...((node.data || {}).hProperties || {}), className: ['disclosure'] } };
			node.children = [{ type: 'paragraph', children: [{ type: 'text', value: `광고 안내 · ${DISCLOSURE_TEXT}` }] }];
		});
	};
}
