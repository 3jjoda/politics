import logger from './logger.js';

const TTL_MS = 10 * 60 * 1000;
let cache = { lastUpdated: null, fetchedAt: 0 };

// 배지 소스는 batch_runs.finished_at (syncBills 마지막 성공 시각).
//
// bills.updated_at 을 쓰지 않는 이유: syncBills 가 변경분만 UPDATE 하도록 바뀌면서
// (batch/syncBills.js 의 BILL_CHANGED_GUARD) updated_at 이 "배치 실행 시각"이 아니라
// "법안이 실제로 바뀐 시각"이 됐다. 변경이 없는 날엔 배지가 멈춘다.
//
// COALESCE fallback 은 batch_runs 마이그레이션 적용 전이거나 첫 크론 실행 전인 경우
// (batch_runs 가 비어 있음) 기존 동작을 유지하기 위한 것.
const fetchLastUpdated = async (db) => {
    const { rows } = await db.query(`
        SELECT COALESCE(
            (SELECT MAX(finished_at) FROM batch_runs
              WHERE batch_name = 'syncBills' AND status = 'success'),
            (SELECT MAX(updated_at) FROM bills)
        ) AS max
    `);
    return rows[0]?.max || null;
};

export const getBillFreshness = async (db) => {
    const now = Date.now();
    if (cache.lastUpdated && now - cache.fetchedAt < TTL_MS) {
        return cache.lastUpdated;
    }
    try {
        const value = await fetchLastUpdated(db);
        cache = { lastUpdated: value, fetchedAt: now };
        return value;
    } catch (err) {
        logger.error(`[dataFreshness] MAX(bills.updated_at) 조회 실패: ${err.message}`);
        return cache.lastUpdated;
    }
};

export const formatRelativeKo = (date) => {
    if (!date) return null;
    const diffMs = Date.now() - new Date(date).getTime();
    if (diffMs < 0) return '방금 전';
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return '방금 전';
    if (min < 60) return `${min}분 전`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour}시간 전`;
    const day = Math.floor(hour / 24);
    if (day < 7) return `${day}일 전`;
    const week = Math.floor(day / 7);
    if (week < 5) return `${week}주 전`;
    const month = Math.floor(day / 30);
    return `${month}달 전`;
};

const formatAbsoluteKo = (date) => {
    try {
        return new Date(date).toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
        });
    } catch {
        return '';
    }
};

export const dataFreshnessMiddleware = (db) => async (req, res, next) => {
    try {
        const lastUpdated = await getBillFreshness(db);
        res.locals.dataFreshness = lastUpdated ? {
            lastUpdated,
            relative: formatRelativeKo(lastUpdated),
            absolute: formatAbsoluteKo(lastUpdated)
        } : null;
    } catch {
        res.locals.dataFreshness = null;
    }
    next();
};
