// services/XrayService.js — 국회 X레이 데이터 조립

import XrayDao from '../daos/XrayDao.js';

export default (db) => {
    const dao = XrayDao(db);

    /* ① 히스토그램 20구간 채우기 + 요약 통계 */
    function buildConsensus(rows) {
        const bins = Array.from({ length: 20 }, (_, i) => ({
            from: i * 5, to: (i + 1) * 5, cnt: 0
        }));
        rows.forEach(r => {
            const idx = Math.min(19, Math.max(0, Number(r.bucket) - 1));
            bins[idx].cnt = Number(r.cnt);
        });
        const total = bins.reduce((s, b) => s + b.cnt, 0);
        const nearUnanimous = bins.slice(18).reduce((s, b) => s + b.cnt, 0); // 찬성률 90% 이상
        const contested = bins.slice(0, 14).reduce((s, b) => s + b.cnt, 0);  // 찬성률 70% 미만
        return {
            bins, total,
            nearUnanimous,
            nearUnanimousPct: total > 0 ? Math.round(nearUnanimous / total * 1000) / 10 : 0,
            contested,
            contestedPct: total > 0 ? Math.round(contested / total * 1000) / 10 : 0
        };
    }

    /* ⑨ 정당별 4축 분포 그룹핑 (10인 미만 정당은 '그 외') */
    function buildSpectrum(rows) {
        const byParty = new Map();
        rows.forEach(r => {
            const key = r.party_name || '무소속';
            if (!byParty.has(key)) byParty.set(key, []);
            byParty.get(key).push({
                name: r.name,
                economy: Number(r.economy),
                social: Number(r.social),
                security: Number(r.security),
                institution: Number(r.institution)
            });
        });
        const parties = [...byParty.entries()]
            .map(([party, members]) => ({ party, members }))
            .sort((a, b) => b.members.length - a.members.length);
        const main = parties.filter(p => p.members.length >= 10);
        const rest = parties.filter(p => p.members.length < 10);
        if (rest.length > 0) {
            main.push({ party: '그 외', members: rest.flatMap(p => p.members) });
        }
        return main.map(p => ({ party: p.party, count: p.members.length, members: p.members }));
    }

    return {
        getPageData: async () => {
            const [
                consensusRows, dissentRank, proposePass,
                funnel, committeeRate,
                crossPartyStats, crossPartyRank,
                leaderSigner, absentRank, citizenGap,
                spectrumRows, categoryCounts
            ] = await Promise.all([
                dao.getConsensusHistogram(), dao.getDissentRank(), dao.getProposePass(),
                dao.getFunnel(), dao.getCommitteeProcessRate(),
                dao.getCrossPartyStats(), dao.getCrossPartyRank(),
                dao.getLeaderSigner(), dao.getAbsentRank(), dao.getCitizenGap(),
                dao.getPartySpectrum(), dao.getCategoryCounts()
            ]);

            return {
                consensus: buildConsensus(consensusRows),
                dissentRank,
                proposePass,
                funnel,
                committeeRate,
                crossParty: {
                    stats: crossPartyStats,
                    multiPct: crossPartyStats && Number(crossPartyStats.total_bills) > 0
                        ? Math.round(Number(crossPartyStats.multi_party_bills) / Number(crossPartyStats.total_bills) * 1000) / 10
                        : 0,
                    rank: crossPartyRank
                },
                leaderSigner,
                absentRank,
                citizenGap,
                spectrum: buildSpectrum(spectrumRows),
                categoryCounts
            };
        }
    };
};
