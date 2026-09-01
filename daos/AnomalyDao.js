// daos/AnomalyDao.js — 「설명이 필요한 숫자」 카드
//
// BriefingDao·XrayDao 와 같은 방식: queries/anomaly/*.sql 을 파일명 키로 읽어둔다.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queriesPath = path.resolve(__dirname, 'queries/anomaly');

const queries = {};
fs.readdirSync(queriesPath).forEach((file) => {
    const key = path.basename(file, '.sql');
    queries[key] = fs.readFileSync(path.join(queriesPath, file), 'utf8');
});

export default (db) => {
    const run = (key, params = []) => db.query(queries[key], params).then((r) => r.rows);

    return {
        /* 지표별 후보. 문턱(threshold)은 utils/anomalies.js 가 정한다 */
        getCandidates: (metricKey, threshold) => {
            const map = {
                absent: 'getAbsentCandidates',
                gap: 'getGapCandidates',
                propose: 'getProposeCandidates',
                committee: 'getCommitteeCandidates',
                axis: 'getAxisCandidates',
            };
            const q = map[metricKey];
            if (!q) throw new Error(`알 수 없는 지표: ${metricKey}`);
            return run(q, [threshold]);
        },

        /* 설명 재료 (관측 데이터) — 한 사람 */
        getExplainContext: (monaCd) => run('getExplainContext', [monaCd]).then((r) => r[0] || null),

        upsertCard: (date, metric, monaCd, explained, payload) =>
            run('upsertCard', [date, metric, monaCd, explained, JSON.stringify(payload)]).then((r) => r[0] || null),

        getLatest: (limit = 1) => run('getLatest', [limit]),
        getByDate: (date) => run('getByDate', [date]).then((r) => r[0] || null),
        getNeighbors: (date) => run('getNeighbors', [date]).then((r) => r[0] || { prev: null, next: null }),
        countAll: () => run('countAll').then((r) => r[0]?.n || 0),
        countByMetric: () => run('countByMetric'),
        getPage: (limit, offset) => run('getPage', [limit, offset]),
        getPageByMetric: (metric, limit, offset) => run('getPageByMetric', [metric, limit, offset]),
    };
};
