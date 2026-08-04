// datetime.js — 한국시간(KST) 기준 표시 포맷 모음
//
// 왜 필요한가:
//   Date 의 getFullYear()/getDate()/getHours() 는 "실행 프로세스의 타임존" 을 쓴다.
//   로컬 개발은 윈도우(KST)라 정상으로 보이지만, Railway 컨테이너는 TZ 를 주지 않으면
//   UTC 로 돌기 때문에 새벽 0~9시 데이터가 하루 전으로 렌더된다.
//   → 여기서 timeZone 을 명시해 실행 환경과 무관하게 KST 를 보장한다.
//
// 짝이 되는 규칙:
//   · DB 쪽은 세션 타임존이 UTC 라 TO_CHAR / CURRENT_DATE 에 AT TIME ZONE 'Asia/Seoul' 필요
//   · timestamptz 는 절대 시각이라 저장 자체는 어느 쪽이든 정확하다 (표시만 문제)

const KST = 'Asia/Seoul';

const partsKst = (value) => {
    if (!value) return null;
    const dt = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: KST,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(dt);
    return parts.reduce((acc, p) => (acc[p.type] = p.value, acc), {});
};

/** 2026.08.05 */
export const fmtDate = (value) => {
    const p = partsKst(value);
    return p ? `${p.year}.${p.month}.${p.day}` : '—';
};

/** 2026.08.05 01:00 */
export const fmtDateTime = (value) => {
    const p = partsKst(value);
    return p ? `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}` : '—';
};

/**
 * DB 가 TO_CHAR(... AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') 로 만든
 * 타임존 표기 없는 KST 벽시계 문자열을 절대 시각으로 되돌린다.
 * 그냥 new Date('2026-08-05 01:00') 하면 실행 환경 타임존으로 해석돼 또 어긋난다.
 */
const parseKstWallClock = (value) => {
    if (value instanceof Date) return value;
    if (typeof value !== 'string') return new Date(value);
    const s = value.trim().replace(' ', 'T');
    // 이미 오프셋/Z 가 붙어 있으면 그대로 신뢰
    if (/(Z|[+-]\d{2}:?\d{2})$/.test(s)) return new Date(s);
    return new Date(`${s.length === 16 ? `${s}:00` : s}+09:00`);
};

/**
 * 상대시간. public/scripts/interactions.js 의 PB.timeAgo 와 동일한 규칙 —
 * 7일까지는 상대표기, 그 이후는 날짜. ("24달 전" 같은 표기를 피한다)
 */
export const timeAgo = (value) => {
    if (!value) return '';
    const t = parseKstWallClock(value);
    if (Number.isNaN(t.getTime())) return String(value);
    const diff = (Date.now() - t.getTime()) / 1000;
    if (diff < 0) return '방금 전';
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
    return fmtDate(t);
};

/** SQL 에서 "오늘(한국 기준)" 이 필요할 때 쓰는 표현식 — CURRENT_DATE 대체 */
export const SQL_TODAY_KST = `(NOW() AT TIME ZONE 'Asia/Seoul')::date`;
