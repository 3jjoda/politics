// utils/reportReasons.js — 신고 사유·종류 단일 소스 (2026-08-27)
//
// 화면 선택지·서버 검증·관리자 목록 라벨이 전부 이 배열을 읽는다.
// 🔴 DB CHECK(`reports_reason_check`)와 key 목록이 어긋나면 조용히 23514 로 죽는다.

/* 🔴 CHECK 에는 `political` 이 있지만 **여기에 넣지 않는다.**
   "정치적" 을 신고 사유로 열면 곧 진영 신고 도구가 된다 — 내 의견과 다른 글이 전부 신고 대상이 되고,
   중립을 표방하는 사이트가 그 이유로 글을 지우면 그 자체가 편집이다.
   선거법이 요구하는 후보자 비방·허위사실은 `abuse`·`false_info` 가 이미 덮는다 (ELECTION_LAW.md §5).
   ⚠️ 되살리고 싶어지면 이 문단을 먼저 읽을 것. */
export const REPORT_REASONS = [
    { key: 'spam',       label: '스팸·광고',  desc: '홍보·도배' },
    { key: 'abuse',      label: '욕설·비방',  desc: '인신공격, 특정인에 대한 모욕' },
    { key: 'false_info', label: '허위사실',   desc: '사실과 다른 주장' },
    { key: 'other',      label: '기타',      desc: '위에 없는 사유' },
];

export const REPORT_TYPES = ['comment', 'post'];

/* 처리 상태 — 🔴 `kept` 를 "기각" 같은 말로 바꾸지 말 것.
   신고자를 심판하는 게 아니라 **대상을 판단**하는 것이다. */
export const REPORT_STATUS = {
    open:    { label: '미처리', tone: 'open' },
    kept:    { label: '살려둠', tone: 'kept' },
    removed: { label: '삭제함', tone: 'removed' },
};

export const reasonLabel = (key) => (REPORT_REASONS.find((r) => r.key === key) || {}).label || key;

/* 서버 검증 — 모르는 값은 null (호출부가 400). postTypes.js 의 resolvePostType 과 같은 규약 */
export const resolveReason = (raw) =>
    (REPORT_REASONS.find((r) => r.key === String(raw || '').trim()) || {}).key || null;
export const resolveReportType = (raw) =>
    REPORT_TYPES.includes(String(raw || '').trim()) ? String(raw).trim() : null;
