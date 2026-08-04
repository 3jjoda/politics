// refreshCrossPartyVote.js — 교차 표결 성향 MV 갱신
//
// politician_cross_party_vote 는 bill_votes × bills 집계라 매 요청 계산하면
// 의원 목록 쿼리가 88ms → 180ms 로 늘고, bill_votes 가 늘수록 나빠진다.
// 값은 syncVotes/syncBills 가 도는 하루 1회만 바뀌므로 배치에서 갱신한다.
//
// 실행 순서: syncBills · syncVotes 다음 (둘 다 이 MV 의 입력)

import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { startBatchRun, finishBatchRun } from '../utils/batchRun.js';
import { startWatchdog } from '../utils/watchdog.js';

async function run() {
    logger.info('[CrossPartyVote START] 교차 표결 성향 MV 갱신');
    const stopWatchdog = startWatchdog('refreshCrossPartyVote', 10);
    const pool = new pg.Pool(dbConfig);
    const runId = await startBatchRun(pool, 'refreshCrossPartyVote');
    const startTime = Date.now();

    try {
        // CONCURRENTLY — 갱신 중에도 의원 목록 페이지가 막히지 않는다
        // (ux_pcpv_mona_cd UNIQUE 인덱스가 있어야 동작)
        await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY politician_cross_party_vote');

        const { rows } = await pool.query(`
            SELECT COUNT(*)::int AS 전체
                 , COUNT(*) FILTER (WHERE in_cohort)::int AS 순위대상
                 , ROUND(MIN(gap) FILTER (WHERE in_cohort)::numeric, 1) AS 최소격차
                 , ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap)
                         FILTER (WHERE in_cohort)::numeric, 1)          AS 중앙격차
                 , ROUND(MAX(gap) FILTER (WHERE in_cohort)::numeric, 1) AS 최대격차
              FROM politician_cross_party_vote`);
        const s = rows[0];
        logger.info(`[CrossPartyVote] ${s.전체}명 · 순위대상 ${s.순위대상}명 · 격차 ${s.최소격차} ~ ${s.최대격차} (중앙 ${s.중앙격차})`);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`[CrossPartyVote SUCCESS] 완료 (${duration}초)`);
        await finishBatchRun(pool, runId, {
            status: 'success',
            stats: {
                total: s.전체, inCohort: s.순위대상,
                gapMin: Number(s.최소격차), gapMedian: Number(s.중앙격차), gapMax: Number(s.최대격차)
            }
        });
    } catch (error) {
        logger.error('[CrossPartyVote FAILED]:', error);
        await finishBatchRun(pool, runId, { status: 'failed', error: error.message });
    } finally {
        await pool.end();
        stopWatchdog();
        logger.info('[CrossPartyVote END]');
    }
}

run();
