// 요약 문단(summary) 생성기 — GEO 2026-09-07
//   목적: AI 답변 엔진이 그대로 인용할 수 있는 "정의문 + 숫자 + 장점 + 대상" 3~5문장을
//         프론트매터 실데이터와 TL;DR 라벨에서 결정적으로 만든다(LLM 호출 없음, 날조 없음).
//   ⚠️ 라이브 저장소 tools/web_doc_summary.js 와 동일 내용이어야 한다(발행 시 같은 규칙으로 생성).
//      한쪽을 고치면 다른 쪽도 같이 고칠 것.

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

// 마지막 글자에 받침이 있는지 (한글·숫자·영문 대략 처리)
export function hasJong(word) {
	const s = String(word || '').replace(/[)\]"'》」』\s.]+$/g, '');
	if (!s) return false;
	const ch = s[s.length - 1];
	const code = ch.charCodeAt(0);
	if (code >= HANGUL_START && code <= HANGUL_END) return (code - HANGUL_START) % 28 !== 0;
	if (/[0-9]/.test(ch)) return '013678'.includes(ch); // 영·일·삼·육·칠·팔
	if (/[a-zA-Z]/.test(ch)) return 'lmnrLMNR'.includes(ch); // 엘·엠·엔·알
	return false;
}
const eunNeun = (w) => (hasJong(w) ? '은' : '는');
const ida = (w) => (hasJong(w) ? '이다' : '다');

// 마크다운·라벨 잔재 제거
function clean(s) {
	return String(s || '')
		.replace(/\*\*|__|`/g, '')
		.replace(/\[HL\]|\[\/HL\]/g, '')
		.replace(/━{2,}/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/[\s.。]+$/g, '')
		.trim();
}

// 구(句)를 서술문으로: 명사구면 "…이다", 이미 서술형이면 그대로
const NOMINAL_ENDINGS = [
	[/가능$/, '가능하다'], [/우수$/, '우수하다'], [/편리$/, '편리하다'], [/간편$/, '간편하다'],
	[/탁월$/, '탁월하다'], [/저렴$/, '저렴하다'], [/뛰어남$/, '뛰어나다'], [/추천$/, '추천한다'],
	[/제공$/, '제공한다'], [/포함$/, '포함한다'], [/지원$/, '지원한다'], [/차단$/, '차단한다'],
	[/해결$/, '해결한다'], [/확보$/, '확보한다'], [/절약$/, '절약한다'], [/개선$/, '개선한다'],
	[/만족$/, '만족스럽다'], [/없음$/, '없다'], [/있음$/, '있다'], [/됨$/, '된다'], [/함$/, '하다'],
	[/임$/, '이다'], [/음$/, '다'],
];
export function toStatement(phrase) {
	const s = clean(phrase);
	if (!s) return '';
	// 합쇼체·해요체 → 평서문. 변환이 애매한 어미는 빈 문자열(사용 불가)
	if (/입니다$/.test(s)) { const b = s.replace(/입니다$/, ''); return b + ida(b); }
	if (/합니다$/.test(s)) return s.replace(/합니다$/, '한다');
	if (/됩니다$/.test(s)) return s.replace(/됩니다$/, '된다');
	if (/습니다$/.test(s)) return s.replace(/습니다$/, '다');
	if (/니다$/.test(s)) return '';
	if (/다$/.test(s)) return s;
	if (/하세요$/.test(s)) return s.replace(/하세요$/, '할 수 있다');
	if (/(이에요|예요)$/.test(s)) return s.replace(/(이에요|예요)$/, '') + ida(s.replace(/(이에요|예요)$/, ''));
	if (/(죠|지요)$/.test(s)) return s.replace(/(죠|지요)$/, '다');
	if (/해요$/.test(s)) return s.replace(/해요$/, '하다');
	if (/[아어]요$/.test(s)) return s.replace(/[아어]요$/, '다');
	if (/(세요|요|니다|까|네)$/.test(s)) return '';
	if (/[?？!]$/.test(s)) return '';
	for (const [re, rep] of NOMINAL_ENDINGS) {
		if (re.test(s)) return s.replace(re, rep);
	}
	return s + ida(s);
}

// "…에게 맞는다" 형태로 쓸 수 있는 대상 구인지
const TARGET_TAIL = /(분|분들|사람|사람들|가구|남성|여성|남자|여자|어린이|아이|학생|직장인|사용자|초보자|입문자|고객|부모님|어르신|자녀|누구나|모두|님|족|층|맘|파|러|자)$/;
export function toTargetSentence(phrase, scenarioPhrase) {
	const s = clean(phrase)
		.replace(/(에게|께|한테)\s*(강력\s*)?추천.*$/, '')
		.replace(/(이라면|라면)\s*(추천|강추).*$/, '')
		.trim();
	if (s && TARGET_TAIL.test(s)) return `${s}에게 맞는다.`;
	if (s) return `${s} 같은 경우에 알맞다.`;
	const sc = clean(scenarioPhrase);
	return sc ? `${sc} 같은 상황에 알맞다.` : '';
}

function leafCategory(category) {
	const parts = String(category || '').split('>').map((x) => x.trim()).filter(Boolean);
	if (!parts.length) return '';
	const leaf = parts[parts.length - 1];
	return leaf === '기타' && parts.length > 1 ? parts[parts.length - 2] : leaf;
}

// TL;DR 라벨 줄들 → {core, price, pros, target, scenario, plain[]}
export function classifyTldrLines(lines) {
	const out = { core: '', price: '', pros: '', target: '', scenario: '', plain: [] };
	for (const raw of lines) {
		const line = clean(String(raw).replace(/^>\s?/, ''));
		if (!line || /^TL;?DR$/i.test(line)) continue;
		const m = line.match(/^(?:\d+\.\s*)?([^:：]{1,14})\s*[:：]\s*(.+)$/);
		if (!m) { out.plain.push(line); continue; }
		const label = m[1].replace(/\s/g, '');
		const val = m[2].trim();
		if (/대상|분께|누구|누가|이런|타겟/.test(label)) { if (!out.target) out.target = val; }
		else if (/핵심|한줄|포인트|요약|특징/.test(label)) { if (!out.core) out.core = val; }
		else if (/가격|얼마|가성비/.test(label)) { if (!out.price) out.price = val; }
		else if (/장점|좋은|좋다|강점/.test(label)) { if (!out.pros) out.pros = val; }
		else if (/추천|시나리오|사용|상황|용도/.test(label)) { if (!out.scenario) out.scenario = val; }
		else out.plain.push(val);
	}
	return out;
}

/**
 * @param {object} p  { productName, title, productStore, category, description }  (가격·평점은 렌더 시점에 붙임)
 * @param {object} t  classifyTldrLines() 결과 (없으면 {})
 * @returns {string}  요약 문단 (빈 문자열이면 생성 불가)
 */
export function buildSummary(p, t = {}) {
	const name = clean(p.productName || p.title);
	if (!name) return '';
	const leaf = leafCategory(p.category);
	const store = clean(p.productStore);
	const plain = t.plain && t.plain.length ? t.plain.join(' ') : '';
	// description 폴백: 구형 글의 description 은 본문 앞 150자를 자른 것일 수 있어 첫 문장만, 짧을 때만 쓴다
	const descFirst = clean(p.description).split(/(?<=[.!?。])\s+/)[0] || '';
	//   서술체(…입니다/…요)로 끝나는 첫 문장은 본문 도입부가 잘려 들어온 것이므로 쓰지 않는다(명사구만 허용).
	const descCore = !t.core && !plain && descFirst && descFirst.length <= 90
		&& !/[?？!]/.test(descFirst) && !/(니다|요|까|죠|저는|저도|제가)$/.test(descFirst) && !/(저는|저도|제가|저만)/.test(descFirst)
		? descFirst : '';
	const sentences = [];

	// 1. 정의문 — "X는 (판매처에서 판매하는) 분류이다."
	if (leaf) sentences.push(`${name}${eunNeun(name)} ${store ? `${store}에서 판매하는 ` : ''}${leaf}${ida(leaf)}.`);
	// 2. 핵심 — 라벨/설명은 "핵심은 …이다", v2 평문 결론은 그대로
	if (t.core || descCore) {
		const st = toStatement(t.core || descCore);
		if (st) sentences.push(leaf ? `핵심은 ${st}.` : `${name}${eunNeun(name)} ${st}.`);
	} else if (plain) {
		const st = plain.replace(/^결론부터\s*(말하면|말하자면|말씀드리면)[,\s]*/, '').replace(/[.\s]+$/, '');
		if (st) sentences.push(st + '.');
	}
	// 3. 가격·평점 문장은 여기서 만들지 않는다 (2026-09-08).
	//    summary 문자열에 굳혀 두면 productPrice 갱신 시 요약만 옛 값으로 남는다.
	//    레이아웃(src/lib/summary.ts)이 productPrice·rating·updatedDate 로 렌더 시점에 붙인다.
	// 4. 장점
	if (t.pros) { const st = toStatement(t.pros); if (st) sentences.push(`주요 장점은 ${st}.`); }
	// 5. 대상
	const target = toTargetSentence(t.target, t.scenario);
	if (target) sentences.push(target);

	return sentences.join(' ').replace(/\s+/g, ' ').trim();
}
