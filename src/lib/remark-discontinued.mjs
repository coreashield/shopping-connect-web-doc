// 판매 종료(saleStatus: discontinued) 글의 본문에서 구매 링크를 렌더 시점에 제거한다.
// 발행기가 본문 끝에 "[👉 상품 최저가·구매하러 가기](/go/…)" 같은 문단을 넣는데,
// 판매처 페이지가 삭제된 글에서는 레이아웃 CTA 를 숨겨도 이 본문 링크가 남아 죽은 링크가 된다.
// 프론트매터를 고쳐 쓰지 않고 마크다운 AST 에서 지우므로, 상태가 바뀌면 자동으로 되돌아온다.
import { visit } from 'unist-util-visit';

const BUY_LINK = /^\/go\/|naver\.me\/|smartstore\.naver\.com|brand\.naver\.com/;
const REMOVED_NOTE = '판매처 상품 페이지가 삭제되어 구매 링크를 제거했습니다.';

const isBuyLink = (node) => node.type === 'link' && typeof node.url === 'string' && BUY_LINK.test(node.url);
const isBlank = (node) => node.type === 'text' && node.value.trim() === '';

export default function remarkDiscontinued() {
	return (tree, file) => {
		const fm = file.data?.astro?.frontmatter;
		if (!fm || fm.saleStatus !== 'discontinued') return;

		visit(tree, 'paragraph', (node) => {
			if (!node.children?.some(isBuyLink)) return;
			const onlyLink = node.children.every((c) => isBuyLink(c) || isBlank(c));
			if (onlyLink) {
				// 링크만 있는 문단(구매 CTA 줄) → 안내 한 줄로 교체
				node.children = [{ type: 'text', value: REMOVED_NOTE }];
				return;
			}
			// 문장 안에 섞인 링크 → 링크만 벗기고 앵커 텍스트는 남긴다
			node.children = node.children.flatMap((c) => (isBuyLink(c) ? c.children ?? [] : [c]));
		});
	};
}
