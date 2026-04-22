import BillService from '../services/BillService.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {
    const billService = BillService(db);
    const controller = {};

    controller.getList = wrapWithContext(async function getList(req, res, next) {
        try {
            const results = await billService.getList({});
            res.status(200).json(results);
        } catch (error) {
            logger.error('API 컨트롤러에서 법안 목록 조회 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 법안 검색 API (커뮤니티 첨부용) */
    controller.search = wrapWithContext(async function search(req, res, next) {
        try {
            const q = (req.query.q || '').trim();
            if (!q || q.length < 2) return res.status(200).json({ items: [] });
            const items = await billService.search(q);
            res.status(200).json({ items });
        } catch (error) {
            logger.error('법안 검색 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 법안 목록 페이지 (검색/필터/페이징) */
    controller.getListPage = wrapWithContext(async function getListPage(req, res, next) {
        try {
            const pageSize = 50;
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const offset = (page - 1) * pageSize;

            const search = req.query.search ? String(req.query.search).trim() : null;
            const status = req.query.status ? String(req.query.status) : null;
            const topicRaw = req.query.topic ? parseInt(req.query.topic) : null;
            const topic = Number.isFinite(topicRaw) ? topicRaw : null;

            const [bills, statusCounts, topicCounts, partyCounts] = await Promise.all([
                billService.getList({ search, status, topic, limit: pageSize, offset }),
                billService.getStatusCounts(),
                billService.getTopicCounts(),
                billService.getPartyCounts()
            ]);

            const totalCount = bills.length > 0 ? parseInt(bills[0].total_count) : 0;
            const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

            res.render('bill/bill', {
                pageTitle: '정치 바로미터 - 법안',
                pageStyles: 'bill/bill',
                currentUrl: '/bill',
                bills,
                statusCounts,
                topicCounts,
                partyCounts,
                query: { search: search || '', status: status || '', topic: topic || '' },
                pagination: { page, pageSize, totalCount, totalPages }
            });
        } catch (error) {
            logger.error('웹 컨트롤러에서 법안 목록 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    controller.getDetail = wrapWithContext(async function getDetail(req, res, next) {
        try {
            const billData = await billService.getDetail(req.params.id);
            if (!billData || billData.length === 0) {
                return res.status(404).json({ message: '법안을 찾을 수 없습니다.' });
            }
            res.status(200).json(billData);
        } catch (error) {
            logger.error('API 컨트롤러에서 법안 상세 정보 조회 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 법안 상세 페이지 */
    controller.getDetailPage = wrapWithContext(async function getDetailPage(req, res, next) {
        try {
            const billId = req.params.id;
            const billData = await billService.getDetail(billId);
            if (!billData || billData.length === 0) {
                return res.status(404).render('error_pages/404', {
                    pageTitle: '법안 찾을 수 없음',
                    pageStyles: 'error',
                    message: '요청하신 법안 정보를 찾을 수 없습니다.'
                });
            }
            const bill = billData[0];

            const [coProposers, votes] = await Promise.all([
                billService.getBillCoProposers(billId),
                billService.getBillDetailVotes(billId)
            ]);

            const voters = {
                agree:    votes.filter(v => v.vote_result === '찬성'),
                disagree: votes.filter(v => v.vote_result === '반대'),
                abstain:  votes.filter(v => v.vote_result === '기권'),
                absent:   votes.filter(v => v.vote_result === '불참')
            };

            res.render('bill/bill_detail', {
                pageTitle: `정치 바로미터 - ${bill.bill_name}`,
                pageStyles: 'bill/bill_detail',
                currentUrl: `/bill/${billId}`,
                bill,
                coProposers,
                voters,
                voteCounts: {
                    agree:    voters.agree.length,
                    disagree: voters.disagree.length,
                    abstain:  voters.abstain.length,
                    absent:   voters.absent.length
                }
            });

        } catch (error) {
            logger.error('웹 컨트롤러에서 법안 상세 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    return controller;
};
