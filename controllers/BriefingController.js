// controllers/BriefingController.js — 브리핑(최근 국회 활동) 페이지
//
// 1단계: 데이터만. AI 호출 0회.

import BriefingService from '../services/BriefingService.js';
import { nf, pct } from '../utils/xrayFormat.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {
    const briefingService = BriefingService(db);
    const controller = {};

    /* 피드 — AI 카드가 시간순으로 쌓인다. 상단에 이번 주 요약 스트립. */
    controller.getBriefingPage = wrapWithContext(async function getBriefingPage(req, res, next) {
        try {
            const [feed, data] = await Promise.all([
                briefingService.getFeed(),
                briefingService.get(),      // 상단 스트립용 주간 집계
            ]);

            res.render('briefing/feed', {
                pageTitle: '브리핑',
                pageStyles: null,
                currentUrl: '/briefing',
                feed,
                b: data,
                nf, pct
            });
        } catch (error) {
            logger.error('브리핑 피드 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 카드 상세 — 댓글·공유의 단위 */
    controller.getBriefingPost = wrapWithContext(async function getBriefingPost(req, res, next) {
        try {
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(404).render('error_pages/404', {
                    pageTitle: '찾을 수 없음', pageStyles: 'error', currentUrl: '/briefing',
                    message: '브리핑을 찾을 수 없습니다.'
                });
            }
            const post = await briefingService.getPost(id);
            if (!post) {
                return res.status(404).render('error_pages/404', {
                    pageTitle: '찾을 수 없음', pageStyles: 'error', currentUrl: '/briefing',
                    message: '브리핑을 찾을 수 없습니다.'
                });
            }

            res.render('briefing/post', {
                pageTitle: post.headline,
                pageStyles: null,
                currentUrl: '/briefing',
                // 카톡·X 미리보기 — 카드마다 내용이 다르므로 반드시 넘긴다
                ogTitle: `${post.headline} · 당말사`,
                ogDesc: post.body.slice(0, 140),
                ogPath: `/briefing/${post.id}`,
                post,
                nf
            });
        } catch (error) {
            logger.error('브리핑 상세 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    return controller;
};
