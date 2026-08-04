// services/PoliticianService.js

import logger from '../utils/logger.js';
import PoliticianDao from '../daos/PoliticianDao.js';

export default (db) => {
    const politicianDao = PoliticianDao(db);

    return {
        getList: async () => politicianDao.getList(),
        getListWithStats: async () => politicianDao.getListWithStats(),
        getDetail: async (monaCd) => politicianDao.getDetail(monaCd),
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
        getRadarScale: async () => politicianDao.getRadarScale()
    };
};
