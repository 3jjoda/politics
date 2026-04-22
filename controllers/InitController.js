import CodeService from '../services/CodeService.js';
import BillService from '../services/BillService.js';
import PoliticianService from '../services/PoliticianService.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {
    const codeService = CodeService(db);
    const billService = BillService(db);
    const politicianService = PoliticianService(db);
    const controller = {};

    /* 초기화 */
    controller.getInitialData = wrapWithContext(async function getInitialData(req, res, next) {
        try {
            const codes = await codeService.getList();
            return { CODES: codes };
        } catch(error) {
            logger.error('컨트롤러에서 예상치 못한 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 홈 페이지 렌더링 */
    controller.getHomePage = wrapWithContext(async function getHomePage(req, res, next) {
        try {
            const [codes, kpi, trending, recentVotes, topProposers, monthlyTrend] = await Promise.all([
                codeService.getList(),
                billService.getHomeKpi(),
                billService.getTrending(),
                billService.getRecentVotes(),
                politicianService.getTopProposers(),
                billService.getMonthlyTrend()
            ]);

            res.render('index', {
                pageTitle: '정치 바로미터',
                pageStyles: null,
                currentUrl: '/',
                initialData: { CODES: codes },
                kpi,
                trending,
                recentVotes,
                topProposers,
                monthlyTrend
            });
        } catch (error) {
            logger.error('홈 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    return controller;
};
