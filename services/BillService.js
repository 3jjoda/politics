import BillDao from '../daos/BillDao.js';
import logger from '../utils/logger.js';

export default (db) => {
    const billDao = BillDao(db);

    return {
        getList: async (params) => billDao.getList(params),
        getListOne: async (monaCd) => billDao.getListOne(monaCd),
        getDetail: async (billId) => billDao.getDetail(billId),
        getHomeKpi: async () => billDao.getHomeKpi(),
        getTrending: async (sort) => billDao.getTrending(sort),
        getRecentVotes: async () => billDao.getRecentVotes(),
        getMonthlyTrend: async () => billDao.getMonthlyTrend(),
        getStatusCounts: async (committee) => billDao.getStatusCounts(committee),
        getTopicCounts: async () => billDao.getTopicCounts(),
        getPartyCounts: async () => billDao.getPartyCounts(),
        getBillDetailVotes: async (billId) => billDao.getBillDetailVotes(billId),
        getBillCoProposers: async (billId) => billDao.getBillCoProposers(billId),
        getAiAnalysis: async (billId) => billDao.getAiAnalysis(billId),
        search: async (q) => billDao.search(q)
    };
};
