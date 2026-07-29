// controllers/XrayController.js — 국회 X레이 페이지

import XrayService from '../services/XrayService.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {
    const xrayService = XrayService(db);
    const controller = {};

    controller.getXrayPage = wrapWithContext(async function getXrayPage(req, res, next) {
        try {
            const data = await xrayService.getPageData();

            res.render('xray/xray', {
                pageTitle: '국회 X레이 - 정치 바로미터',
                pageStyles: null,
                currentUrl: '/xray',
                xray: data
            });
        } catch (error) {
            logger.error('X레이 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    return controller;
};
