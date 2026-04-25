// BalanceGameController.js — 정치 성향 밸런스 게임
// 본 컨트롤러는 단계 1 초대 + 단계 2 응답 화면 골격만 담당.
// 단계 3·4·5 (펼침·비교·연결), 응답 저장 API, 의원 거리 계산은 다음 라운드.

import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';
import { QUESTIONS, AXES, MAPPING_VERSION } from '../data/balanceGameMockQuestions.js';

export default (db) => {
    const controller = {};

    /* 단계 1 — 초대 화면 (3가지 약속 카드 + 시작 버튼) */
    controller.getInvitePage = wrapWithContext(async function getInvitePage(req, res, next) {
        try {
            res.render('balance/invite', {
                pageTitle: '성향 진단 - 정치 바로미터',
                pageStyles: 'balance/invite',
                currentUrl: '/balance-game',
                questionCount: QUESTIONS.length,
                mappingVersion: MAPPING_VERSION
            });
        } catch (err) {
            logger.error('밸런스 게임 초대 화면 렌더링 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    /* 단계 2 — 응답 화면 골격 (mock 문항)
       클라이언트가 진행도·키보드·로컬 저장을 모두 처리. 서버는 문항 던져주기만. */
    controller.getRespondPage = wrapWithContext(async function getRespondPage(req, res, next) {
        try {
            res.render('balance/respond', {
                pageTitle: '성향 진단 — 응답',
                pageStyles: 'balance/respond',
                currentUrl: '/balance-game/respond',
                questions: QUESTIONS,
                axes: AXES,
                mappingVersion: MAPPING_VERSION
            });
        } catch (err) {
            logger.error('밸런스 게임 응답 화면 렌더링 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    /* 매핑 미리보기 — 본 작업 범위 외, placeholder 페이지 */
    controller.getMappingPreviewPage = wrapWithContext(async function getMappingPreviewPage(req, res, next) {
        try {
            res.render('balance/mapping_preview', {
                pageTitle: '매핑 미리보기 - 정치 바로미터',
                pageStyles: 'balance/mapping_preview',
                currentUrl: '/balance-game/mapping',
                questions: QUESTIONS,
                axes: AXES,
                mappingVersion: MAPPING_VERSION
            });
        } catch (err) {
            logger.error('매핑 미리보기 렌더링 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    return controller;
};
