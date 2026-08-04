// batchRun.js — 배치 실행 기록 (batch_runs)
//
// 용도 2가지:
//  1. nav "법안 N시간 전 갱신" 배지 소스. syncBills 가 변경분만 UPDATE 하도록
//     바뀌면서 bills.updated_at 이 "배치 실행 시각"을 더 이상 보장하지 않음.
//  2. 크론 실패 추적. 배치들이 최상위 catch 에서 로그만 남기고 exit 0 으로 끝나
//     cron 이 실패를 인지하지 못하는 문제 보완.
//
// 기록 실패가 배치 본작업을 막아서는 안 되므로 모든 함수가 예외를 삼킨다.

import logger from './logger.js';

export const startBatchRun = async (pool, batchName) => {
    try {
        const { rows } = await pool.query(
            `INSERT INTO batch_runs (batch_name, status) VALUES ($1, 'running') RETURNING id`,
            [batchName]
        );
        return rows[0].id;
    } catch (err) {
        logger.error(`[batchRun] ${batchName} 시작 기록 실패: ${err.message}`);
        return null;
    }
};

export const finishBatchRun = async (pool, runId, { status, stats = null, error = null } = {}) => {
    if (!runId) return;
    try {
        await pool.query(
            `UPDATE batch_runs
                SET status      = $2,
                    finished_at = NOW(),
                    duration_ms = (EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000)::int,
                    stats       = $3,
                    error       = $4
              WHERE id = $1`,
            [runId, status, stats ? JSON.stringify(stats) : null, error ? String(error).slice(0, 2000) : null]
        );
    } catch (err) {
        logger.error(`[batchRun] 종료 기록 실패(id=${runId}): ${err.message}`);
    }
};
