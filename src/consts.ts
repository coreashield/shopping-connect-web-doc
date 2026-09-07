// 호스트별 값은 src/lib/site.ts 에서 결정된다 (카테고리 분리 실험 2026-09-02).
export { SITE_TITLE, SITE_DESCRIPTION, SITE_URL } from './lib/site';
import { CURRENT_SUB, SITE_TITLE, SITE_URL } from './lib/site';

// ── 브랜드 엔티티 (GEO 2026-09-07) ──
// 웹 검색에서 "쇼핑로그"는 동명 캐시백 앱(shoppinglog.store)이 선점하고 있다.
// AI 검색 엔진이 이 사이트를 별개 엔티티로 인식하려면 (1) 도메인을 병기한 alternateName,
// (2) 같은 @id로 묶인 Organization 노드, (3) 외부 프로필 sameAs 가 필요하다.
// sameAs에는 이 사이트가 직접 운영하는 공개 프로필만 넣는다(유튜브·스레드·네이버 블로그 등).
export const ORGANIZATION_SAME_AS: string[] = [
	'https://www.youtube.com/@shopping_log_daily',   // 유튜브 "쇼핑로그 데일리" (UC6vuM32irt7ANzYo6GT5A8g)
	'https://www.threads.com/@serin_room',            // 스레드
];

const MAIN_SITE_URL = 'https://shopping-log.com';
const MAIN_ORGANIZATION_ID = `${MAIN_SITE_URL}/#organization`;
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const ORGANIZATION = {
	'@type': 'Organization',
	'@id': ORGANIZATION_ID,
	name: SITE_TITLE,
	alternateName: CURRENT_SUB
		? [`${SITE_TITLE} ${CURRENT_SUB.host}`, '쇼핑로그']
		: ['쇼핑로그 shopping-log.com', 'Shopping Log'],
	url: `${SITE_URL}/`,
	logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.svg` },
	description:
		'네이버 스마트스토어 상품을 카테고리·주제별로 가격 비교하고 구매 전 확인할 정보를 정리하는 한국어 쇼핑 정보 사이트',
	...(ORGANIZATION_SAME_AS.length ? { sameAs: ORGANIZATION_SAME_AS } : {}),
	// 서브도메인(digital/food)은 본체 조직의 하위 엔티티로 묶는다
	...(CURRENT_SUB ? { parentOrganization: { '@type': 'Organization', '@id': MAIN_ORGANIZATION_ID, name: '쇼핑로그', url: `${MAIN_SITE_URL}/` } } : {}),
};

// ── 저자(E-E-A-T "Who") ──
// 실명 저자를 등록하면 BlogPosting.author 가 Person 으로 바뀌고 바이라인·소개 페이지에 노출된다.
// 실존 인물의 동의 없이 이름을 지어내지 않는다(기존 결정 유지). null 이면 편집팀(Organization) 저자.
export interface AuthorPerson {
	name: string;
	jobTitle?: string;
	description?: string;
	sameAs?: string[];
}
export const AUTHOR_PERSON: AuthorPerson | null = null;
export const AUTHOR_ID = `${SITE_URL}/about/#author`;

// BlogPosting.author 로 그대로 직렬화되는 노드
export const AUTHOR_NODE = AUTHOR_PERSON
	? {
			'@type': 'Person',
			'@id': AUTHOR_ID,
			name: AUTHOR_PERSON.name,
			url: `${SITE_URL}/about/`,
			...(AUTHOR_PERSON.jobTitle ? { jobTitle: AUTHOR_PERSON.jobTitle } : {}),
			...(AUTHOR_PERSON.description ? { description: AUTHOR_PERSON.description } : {}),
			...(AUTHOR_PERSON.sameAs?.length ? { sameAs: AUTHOR_PERSON.sameAs } : {}),
			worksFor: { '@id': ORGANIZATION_ID },
		}
	: {
			'@type': 'Organization',
			'@id': ORGANIZATION_ID,
			name: `${SITE_TITLE} 편집팀`,
			url: `${SITE_URL}/about/`,
		};
export const AUTHOR_DISPLAY_NAME = AUTHOR_PERSON ? AUTHOR_PERSON.name : `${SITE_TITLE} 편집팀`;
