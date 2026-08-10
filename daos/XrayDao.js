// daos/XrayDao.js — 국회 X레이 집계 쿼리

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queriesPath = path.resolve(__dirname, 'queries/xray');

const queries = {};
fs.readdirSync(queriesPath).forEach(file => {
    const key = path.basename(file, '.sql');
    queries[key] = fs.readFileSync(path.join(queriesPath, file), 'utf8');
});

export default (db) => {
    const run = (key) => db.query(queries[key]).then(r => r.rows);

    return {
        /* ① 표결 합의 분포 (찬성률 히스토그램) */
        getConsensusHistogram: () => run('getConsensusHistogram'),

        /* ② 소신 표결 (당론 이탈) TOP */
        getDissentRank: () => run('getDissentRank'),

        /* ③ 발의왕 vs 입법왕 */
        getProposePass: () => run('getProposePass'),

        /* ④ 생존율 깔때기 + 위원회 처리율 */
        getFunnel: () => run('getFunnel').then(rows => rows[0]),
        getCommitteeProcessRate: () => run('getCommitteeProcessRate'),

        /* ⑤ 초당적 공동발의 */
        getCrossPartyStats: () => run('getCrossPartyStats').then(rows => rows[0]),
        getCrossPartyRank: () => run('getCrossPartyRank'),

        /* ⑥ 주도자 vs 서명러 */
        getLeaderSigner: () => run('getLeaderSigner'),

        /* ⑦ 표결 불참률 TOP */
        getAbsentRank: () => run('getAbsentRank'),

        /* ⑧ 국민 vs 국회 괴리 */
        getCitizenGap: () => run('getCitizenGap'),

        /* ⑨ 정당 내 성향 스펙트럼 */
        getPartySpectrum: () => run('getPartySpectrum'),

        /* ⑩ AI 카테고리 분포 */
        getCategoryCounts: () => run('getCategoryCounts'),

        /* 월별 대표발의 + 그 달 법안의 처리 진행도 */
        getMonthlyPropose: () => run('getMonthlyPropose'),

        /* ⑪ 당 성향 격차 분포 (politician_cross_party_vote MV 기반) */
        getCrossPartyGapDist: () => run('getCrossPartyGapDist'),
        getCrossPartyGapStats: () => run('getCrossPartyGapStats').then(rows => rows[0])
    };
};
