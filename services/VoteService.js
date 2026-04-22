import CitizenVoteDao from '../daos/CitizenVoteDao.js';

const VALID = new Set(['agree', 'disagree']);

export default (db) => {
    const dao = CitizenVoteDao(db);
    return {
        getStats: async (billId, userId) => {
            if (!billId) throw new Error('INVALID_TARGET');
            const stats = await dao.getStats(billId);
            const myVote = userId ? await dao.getMyVote(billId, userId) : null;
            const agree    = Number(stats.agree_cnt || 0);
            const disagree = Number(stats.disagree_cnt || 0);
            const total    = Number(stats.total_cnt || 0);
            return {
                agree,
                disagree,
                total,
                agreeRate: total > 0 ? Number((agree / total * 100).toFixed(1)) : 0,
                myVote
            };
        },
        vote: async (billId, userId, vote) => {
            if (!billId) throw new Error('INVALID_TARGET');
            if (!VALID.has(vote)) throw new Error('INVALID_VOTE');
            return dao.upsert(billId, userId, vote);
        }
    };
};
