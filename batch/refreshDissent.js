// refreshDissent.js — 당론 이탈(소신 표결) MV 갱신
//
// politician_dissent 는 bill_votes 를 두 번 훑는 집계라 매 요청 계산하면 1,410ms 가 걸렸다.
// X레이 섹션 쿼리들이 병렬 실행이라 이 하나가 페이지 TTFB 를 지배했다.
// 값은 syncVotes 가 도는 하루 1회만 바뀌므로 배치에서 갱신한다.
//
// 실행 순서: syncPoliticians · syncVotes 다음 (둘 다 이 MV 의 입력)

import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { startBatchRun, finishBatchRun } from '../utils/batchRun.js';
import { startWatchdog } from '../utils/watchdog.js';

async function run() {
    logger.info('[Dissent START] 당론 이탈 MV 갱신');
    const stopWatchdog = startWatchdog('refreshDissent', 10);
    const pool = new pg.Pool(dbConfig);
    const runId = await startBatchRun(pool, 'refreshDissent');
    const startTime = Date.now();

    try {
        // CONCURRENTLY — 갱신 중에도 X레이 페이지가 막히지 않는다
        // (ux_politician_dissent_mona_cd UNIQUE 인덱스가 있어야 동작)
        await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY politician_dissent');

        const { rows } = await pool.query(`
            SELECT COUNT(*)::int AS 대상의원
                 , ROUND((MIN(dissent_rate) * 100)::numeric, 2) AS 최소이탈률
                 , ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dissent_rate) * 100)::numeric, 2) AS 중앙이탈률
                 , ROUND((MAX(dissent_rate) * 100)::numeric, 2) AS 최대이탈률
              FROM politician_dissent`);
        const s = rows[0];
        logger.info(`[Dissent] ${s.대상의원}명 · 이탈률 ${s.최소이탈률}% ~ ${s.최대이탈률}% (중앙 ${s.중앙이탈률}%)`);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`[Dissent SUCCESS] 완료 (${duration}초)`);
        await finishBatchRun(pool, runId, {
            status: 'success',
            stats: {
                total: s.대상의원,
                rateMin: Number(s.최소이탈률),
                rateMedian: Number(s.중앙이탈률),
                rateMax: Number(s.최대이탈률)
            }
        });
    } catch (error) {
        logger.error('[Dissent FAILED]:', error);
        await finishBatchRun(pool, runId, { status: 'failed', error: error.message });
    } finally {
        await pool.end();
        stopWatchdog();
        logger.info('[Dissent END]');
    }
}

run();
