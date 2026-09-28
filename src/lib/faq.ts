// FAQ 질문-답 추출 — FAQPage 구조화 데이터용 (2026-09-28)
//   본문 "### 자주 묻는 질문" 섹션의 "Q1. 질문 / A1. 답" 을 읽는다. 화면 구조는 remark-faq.mjs 가 같은 규칙으로 바꾼다.
//   구글은 상업 사이트에 FAQ 리치결과를 주지 않지만, 빙·AI 검색은 질문-답 쌍을 그대로 인용 단위로 쓴다.

export interface FaqItem { question: string; answer: string }

const plain = (s: string) =>
	s.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\*\*|__|`/g, '')
		.replace(/\s+/g, ' ')
		.trim();

export function extractFaq(body: string | undefined): FaqItem[] {
	if (!body) return [];
	const m = body.match(/^#{2,3}\s*자주 묻는 질문\s*$([\s\S]*?)(?=^#{1,2}\s|$(?![\s\S]))/m);
	if (!m) return [];
	const items: FaqItem[] = [];
	const re = /^\s*Q\d+[.)]\s*(.+?)\s*\n+\s*A\d+[.)]\s*([\s\S]+?)(?=\n\s*Q\d+[.)]|\s*$(?![\s\S]))/gm;
	for (const x of m[1].matchAll(re)) {
		const question = plain(x[1]);
		const answer = plain(x[2]);
		if (question && answer) items.push({ question, answer });
	}
	return items;
}
