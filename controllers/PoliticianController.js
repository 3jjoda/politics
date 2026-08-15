import PoliticianService from '../services/PoliticianService.js';
import BillService from '../services/BillService.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {
    const politicianService = PoliticianService(db);
    const billService = BillService(db);
    const controller = {};

    controller.getList = wrapWithContext(async function getList(req, res, next) {
        try {
            const results = await politicianService.getList();
            res.status(200).json(results);
        } catch (error) {
            logger.error('API 컨트롤러에서 정치인 목록 조회 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 정치인 목록 페이지 */
    controller.getListPage = wrapWithContext(async function getListPage(req, res, next) {
        try {
            const [politicians, partyCounts, committeeCounts, electCounts, genderStats, ageGroupStats] = await Promise.all([
                politicianService.getListWithStats(),
                politicianService.getPartyCounts(),
                politicianService.getCommitteeCounts(),
                politicianService.getElectTypeCounts(),
                politicianService.getGenderStats(),
                politicianService.getAgeGroupStats()
            ]);

            res.render('politician/politician', {
                pageTitle: '정치인',
                pageStyles: 'politician/politician',
                currentUrl: '/politician',
                politicians,
                partyCounts,
                committeeCounts,
                electCounts,
                genderStats,
                ageGroupStats
            });
        } catch (error) {
            logger.error('웹 컨트롤러에서 정치인 목록 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    controller.getDetail = wrapWithContext(async function getDetail(req, res, next) {
        try {
            const politicianData = await politicianService.getDetail(req.params.id);
            if (!politicianData || politicianData.length === 0) {
                return res.status(404).json({ message: '정치인을 찾을 수 없습니다.' });
            }
            res.status(200).json(politicianData);
        } catch (error) {
            logger.error('API 컨트롤러에서 정치인 상세 정보 조회 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 정치인 상세 페이지 */
    controller.getDetailPage = wrapWithContext(async function getDetailPage(req, res, next) {
        try {
            const monaCd = req.params.id;

            const politicianData = await politicianService.getDetail(monaCd);
            if (!politicianData || politicianData.length === 0) {
                return res.status(404).render('error_pages/404', {
                    pageTitle: '정치인 찾을 수 없음',
                    pageStyles: 'error',
                    message: '요청하신 정치인 정보를 찾을 수 없습니다.'
                });
            }
            const politician = politicianData[0];

            const [bills, votes, topics, monthly, timeline, voteSummary, crossPartyVote, partyCoop, radarScale, committees, titles, speeches] = await Promise.all([
                politicianService.getBillsByMonaCd(monaCd),
                politicianService.getVotesByMonaCd(monaCd),
                politicianService.getTopicsByMonaCd(monaCd),
                politicianService.getMonthlyBillsByMonaCd(monaCd),
                politicianService.getTimelineByMonaCd(monaCd),
                politicianService.getVoteSummaryByMonaCd(monaCd),
                politicianService.getCrossPartyVoteByMonaCd(monaCd),
                politicianService.getPartyCoopByMonaCd(monaCd),
                politicianService.getRadarScale(),
                politicianService.getCommittees(monaCd),
                politicianService.getTitles(monaCd),
                politicianService.getSpeechesByMonaCd(monaCd)
            ]);

            res.render('politician/politician_detail', {
                pageTitle: politician.name,
                pageStyles: 'politician/politician_detail',
                currentUrl: `/politician/${monaCd}`,
                politician,
                bills,
                votes,
                topics,
                monthly,
                timeline,
                voteSummary: voteSummary || { for_cnt: 0, against_cnt: 0, abstain_cnt: 0, absent_cnt: 0, total_cnt: 0 },
                crossPartyVote,
                partyCoop,
                radarScale,
                committees,
                titles,
                speeches
            });

        } catch (error) {
            logger.error('웹 컨트롤러에서 정치인 상세 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    return controller;
};
