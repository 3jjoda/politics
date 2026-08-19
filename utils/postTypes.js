// utils/postTypes.js — 커뮤니티 글 유형 · 단일 소스 (2026-08-19)
//
// 목록 탭·글쓰기 라디오·배지 라벨·서버 검증이 전부 이 배열을 읽는다.
// 🔴 DB CHECK(ddl/migrations/2026-08-19-post-type.sql)와 key 목록이 같아야 한다 — 유형을 추가하면 두 곳을 같이.
// 🔴 adminOnly 는 서버가 isAdminUser 로 검증한다 (PostController). 화면에서 숨기는 건 편의일 뿐 방어가 아니다.
// ⚠️ 정당색 금지 — 배지는 공지만 골드, 나머지는 무채색 (tone).

export const POST_TYPES = [
    { key: 'notice',   label: '공지',        adminOnly: true,  tone: 'gold', desc: '운영 안내. 관리자만 씁니다' },
    { key: 'free',     label: '잡담',        adminOnly: false, tone: 'gray', desc: '가벼운 이야기' },
    { key: 'bill',     label: '법안 이야기', adminOnly: false, tone: 'gray', desc: '특정 법안에 대해. 법안을 첨부하면 좋습니다' },
    { key: 'question', label: '질문',        adminOnly: false, tone: 'gray', desc: '사이트·데이터·국회 절차가 궁금할 때' },
    { key: 'feedback', label: '건의·피드백', adminOnly: false, tone: 'gray', desc: '고쳤으면 하는 것, 있었으면 하는 것' },
];

export const DEFAULT_POST_TYPE = 'free';

export const postTypeOf = (key) => POST_TYPES.find((t) => t.key === key) || null;

/* 이 사용자가 고를 수 있는 유형 (글쓰기 라디오·서버 검증 공용) */
export const allowedPostTypes = (isAdmin) => POST_TYPES.filter((t) => isAdmin || !t.adminOnly);

/* 서버 검증: 모르는 값·권한 밖 값은 null (호출부가 400 처리) */
export const resolvePostType = (raw, isAdmin) => {
    const key = String(raw || DEFAULT_POST_TYPE).trim();
    const t = postTypeOf(key);
    if (!t) return null;
    if (t.adminOnly && !isAdmin) return null;
    return t.key;
};
