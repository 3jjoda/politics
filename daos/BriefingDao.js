// daos/BriefingDao.js — 브리핑(최근 국회 활동) 집계 쿼리
//
// XrayDao 와 같은 방식: queries/briefing/*.sql 을 파일명 키로 읽어둔다.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queriesPath = path.resolve(__dirname, 'queries/briefing');

const queries = {};
fs.readdirSync(queriesPath).forEach((file) => {
    const key = path.basename(file, '.sql');
    queries[key] = fs.readFileSync(path.join(queriesPath, file), 'utf8');
});

export default (db) => {
    const run = (key, params = []) => db.query(queries[key], params).then((r) => r.rows);

    return {
        /* 최근 N일 요약 KPI (한 행) */
        getSummary: (days) => run('getSummary', [days]).then((r) => r[0] || null),

        /* 일별 발의 추이 — 0인 날도 채워서 반환 (스파크라인) */
        getDailyProposals: (days) => run('getDailyProposals', [days]),

        /* 본체: 위원회별로 묶은 발의 법안 — 창 안의 **전체**를 준다 (접는 건 뷰의 몫) */
        getBillsByCommittee: (days) => run('getBillsByCommittee', [days]),

        /* 이번 주 같은 법률에 몰린 개정안 */
        getHotLaws: (days, limit) => run('getHotLaws', [days, limit]),

        /* 대표발의 정당 분포 */
        getPartyDist: (days) => run('getPartyDist', [days]),

        /* 가장 최근 처리일 + 결과 분포 (기간 창 없음 — 처리는 드물다) */
        getLatestProcessed: () => run('getLatestProcessed'),

        /* 가장 최근 처리일의 법안 샘플 */
        getLatestProcessedBills: (perStage) => run('getLatestProcessedBills', [perStage]),

        /* ── AI 브리핑 피드 ── */
        getFeed: (limit, offset) => run('getFeed', [limit, offset]),
        getPost: (id) => run('getPost', [id]).then((r) => r[0] || null),
        countPosts: () => db.query('SELECT COUNT(*)::int AS cnt FROM briefing_posts').then((r) => r.rows[0].cnt),
    };
};
