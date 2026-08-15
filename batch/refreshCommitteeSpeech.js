// refreshCommitteeSpeech.js — 상임위 발언 참여율 MV 갱신
//
// politician_committee_speech 는 위원회 × 회의를 LIKE 로 매칭한 뒤 의원별로 접는 집계라
// 매 요청 계산하면 220ms 가 든다 (의원 상세는 이미 13개 쿼리를 병렬로 돌린다).
// 값은 syncSpeeches·syncCommittees 가 도는 하루 1회만 바뀌므로 배치에서 갱신한다.
//
// 실행 순서: syncSpeeches · syncCommittees 다음 (둘 다 이 MV 의 입력)
//   ⚠️ politician_titles(장관·의장단 제외)와 politicians.active_yn(퇴임 제외)도 읽는다.
//      직위는 수동 입력이라 순서에 걸리지 않지만, 값이 낡으면 코호트가 낡는다.

import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { startBatchRun, finishBatchRun } from '../utils/batchRun.js';
import { startWatchdog } from '../utils/watchdog.js';

async function run() {
    logger.info('[CommitteeSpeech START] 상임위 발언 참여율 MV 갱신');
    const stopWatchdog = startWatchdog('refreshCommitteeSpeech', 10);
    const pool = new pg.Pool(dbConfig);
    const runId = await startBatchRun(pool, 'refreshCommitteeSpeech');
    const startTime = Date.now();

    try {
        // CONCURRENTLY — 갱신 중에도 의원 상세가 막히지 않는다
        // (ux_pcs_mona_dept UNIQUE 인덱스가 있어야 동작)
        await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY politician_committee_speech');

        const { rows: [s] } = await pool.query(`
            SELECT COUNT(*)::int                                   AS pairs
                 , COUNT(*) FILTER (WHERE in_cohort)::int          AS cohort
                 , COUNT(DISTINCT mona_cd) FILTER (WHERE in_cohort)::int AS cohort_people
                 , ROUND(AVG(rate) FILTER (WHERE in_cohort), 1)    AS avg_rate
                 , ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rate)
                     FILTER (WHERE in_cohort)::numeric, 1)         AS med_rate
                 , ROUND(AVG(denom) FILTER (WHERE in_cohort))::int AS avg_denom
              FROM politician_committee_speech`);

        logger.info(`[CommitteeSpeech] ${s.pairs}쌍 중 코호트 ${s.cohort}쌍(${s.cohort_people}명)`
            + ` · 평균 ${s.avg_rate}% · 중앙 ${s.med_rate}% · 평균 분모 ${s.avg_denom}개`);

        /* 🔴 코호트가 얇아지면 "의원 평균" 이 표본 몇 개짜리 숫자가 된다.
              화면에서는 그냥 평균으로 보이므로 여기서 경고하지 않으면 조용히 나빠진다.
              2026-08-15 기준 164쌍인데, 후반기 원구성 직후라 분모가 아직 덜 쌓인 상태다
              (연말이면 대부분 11개를 넘긴다). 절반 밑으로 떨어지면 표시를 재검토할 것. */
        if (s.cohort < 80) {
            logger.warn(`  ⚠ 코호트가 ${s.cohort}쌍뿐입니다 — "의원 평균" 의 신뢰도가 낮습니다.`
                + ' 화면 노출 조건(MIN_DENOM)을 재검토하세요');
        }

        // 분모 미달로 빠진 쌍이 얼마나 되는지 — 시간이 가면 줄어야 정상이다
        const { rows: [d] } = await pool.query(`
            SELECT COUNT(*) FILTER (WHERE denom < 11)::int      AS thin
                 , COUNT(*) FILTER (WHERE start_exact)::int     AS exact_start
                 , COUNT(*)::int                                AS total
              FROM politician_committee_speech`);
        logger.info(`  [분모] 11개 미만이라 비율을 감추는 쌍 ${d.thin}/${d.total}`
            + ` (${(d.thin / d.total * 100).toFixed(1)}%)`);

        /* 소속 이력이 얼마나 정확해졌나 — 이 비율이 오를수록 "값이 후하다" 는 주의 문구가 걷힌다.
           2026-08-15 이력 도입 시점엔 0% 다 (전부 시드). 원구성·사보임이 생길 때마다 오른다.
           ⚠️ 이 줄이 없으면 언제부터 값을 믿어도 되는지 알 방법이 없다. */
        logger.info(`  [시작일] 이력 기준 ${d.exact_start}/${d.total}`
            + ` (${(d.exact_start / d.total * 100).toFixed(1)}%) · 나머지는 첫 발언일 근사`);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`[CommitteeSpeech SUCCESS] 완료 (${duration}초)`);
        await finishBatchRun(pool, runId, {
            status: 'success',
            stats: {
                pairs: s.pairs, cohort: s.cohort, cohortPeople: s.cohort_people,
                avgRate: Number(s.avg_rate), medRate: Number(s.med_rate),
                avgDenom: s.avg_denom, thinPairs: d.thin,
            },
        });
    } catch (error) {
        logger.error('[CommitteeSpeech FAILED]:', error.message);
        await finishBatchRun(pool, runId, { status: 'failed', error: error.message });
        process.exitCode = 1;
    } finally {
        await pool.end();
        stopWatchdog();
        logger.info('[CommitteeSpeech END]');
    }
}

run();
