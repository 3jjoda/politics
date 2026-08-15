// services/PoliticianService.js

import logger from '../utils/logger.js';
import PoliticianDao from '../daos/PoliticianDao.js';

/* 발언 영상 클립 하나의 길이. "6:20" / "1:02:30"
   ⚠️ 이건 **클립 길이**지 개인 발언시간이 아니다 (한 클립에 질의와 답변이 함께 녹화된다).
      화면에서 이 값을 합산하거나 의원 간 비교에 쓰지 말 것. */
const fmtClipLen = (sec) => {
    if (!Number.isFinite(sec) || sec <= 0) return null;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
};

/* 발언 요약을 화면 모양으로 — 값이 없으면 통째로 null 을 돌려 뷰가 섹션을 안 그리게 한다.
   ⚠️ **평균 대비·백분위·순위를 만들지 않는다** (UI 방침, ROADMAP 12번).
      위원회마다 회의 수가 다르고 위원장·장관은 구조가 달라 숫자를 나란히 세우면 곧 오해가 된다.
      비율은 **그 의원 안에서의 구성비**(회의 종류 분포)까지만 낸다. */
const shapeSpeeches = (summary, recent) => {
    const memberCnt = summary?.member_cnt || 0;
    const chairCnt = summary?.chair_cnt || 0;
    const total = memberCnt + chairCnt;
    if (total === 0) return null;

    const meetings = (summary.meetings || []).map((m) => ({
        ...m,
        pct: Math.round((m.cnt / total) * 100),
    }));

    return {
        memberCnt,
        chairCnt,
        total,
        speechDays: summary.speech_days || 0,
        firstDate: summary.first_date,
        lastDate: summary.last_date,
        meetings,
        recent: (recent || []).map((r) => ({ ...r, clipLen: fmtClipLen(r.rec_sec) })),
    };
};

export default (db) => {
    const politicianDao = PoliticianDao(db);

    return {
        getList: async () => politicianDao.getList(),
        getListWithStats: async () => politicianDao.getListWithStats(),
        getDetail: async (monaCd) => politicianDao.getDetail(monaCd),
        getCommittees: async (monaCd) => politicianDao.getCommittees(monaCd),
        getTitles: async (monaCd) => politicianDao.getTitles(monaCd),
        getTopProposers: async () => politicianDao.getTopProposers(),
        getRecentPartyMoves: async (limit) => politicianDao.getRecentPartyMoves(limit),
        getPartyCounts: async () => politicianDao.getPartyCounts(),
        getCommitteeCounts: async () => politicianDao.getCommitteeCounts(),
        getElectTypeCounts: async () => politicianDao.getElectTypeCounts(),
        getGenderStats:     async () => politicianDao.getGenderStats(),
        getAgeGroupStats:   async () => politicianDao.getAgeGroupStats(),
        getBillsByMonaCd: async (monaCd) => politicianDao.getBillsByMonaCd(monaCd),
        getVotesByMonaCd: async (monaCd) => politicianDao.getVotesByMonaCd(monaCd),
        getTopicsByMonaCd: async (monaCd) => politicianDao.getTopicsByMonaCd(monaCd),
        getMonthlyBillsByMonaCd: async (monaCd) => politicianDao.getMonthlyBillsByMonaCd(monaCd),
        getTimelineByMonaCd: async (monaCd) => politicianDao.getTimelineByMonaCd(monaCd),
        getVoteSummaryByMonaCd: async (monaCd) => politicianDao.getVoteSummaryByMonaCd(monaCd),
        getCrossPartyVoteByMonaCd: async (monaCd) => politicianDao.getCrossPartyVoteByMonaCd(monaCd),
        getPartyCoopByMonaCd: async (monaCd) => politicianDao.getPartyCoopByMonaCd(monaCd),
        getRadarScale: async () => politicianDao.getRadarScale(),

        /* 의원 발언 기록 — 요약 + 최근 영상을 한 덩어리로.
           발언이 0건이면 null (뷰가 섹션 자체를 안 그린다). */
        getSpeechesByMonaCd: async (monaCd, recentLimit = 8) => {
            const [summary, recent] = await Promise.all([
                politicianDao.getSpeechSummaryByMonaCd(monaCd),
                politicianDao.getRecentSpeechesByMonaCd(monaCd, recentLimit),
            ]);
            return shapeSpeeches(summary, recent);
        }
    };
};
