// controllers/XrayController.js — "숫자로 본 국회" 페이지 (구 "국회 X레이")
// 표시명만 바뀌었고 내부 식별자(xray / .xr-* / URL /xray)는 그대로 유지
//
// 구조: 페이지는 **접힌 목록만** 렌더하고 쿼리를 하나도 돌리지 않는다.
//       사용자가 섹션을 펼치면 그때 /xray/s/:id 로 그 섹션 HTML 조각만 받아온다.
//       (이전엔 14개 쿼리를 전부 돌린 뒤 렌더해서 TTFB 2.3초였다)

import XrayService from '../services/XrayService.js';
import { XRAY_GROUPED, getSection } from '../services/xraySections.js';
import { nf, pct, median } from '../utils/xrayFormat.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {
    const xrayService = XrayService(db);
    const controller = {};

    /* 목록 페이지 — DB 조회 0회 */
    controller.getXrayPage = wrapWithContext(async function getXrayPage(req, res, next) {
        try {
            res.render('xray/xray', {
                pageTitle: '숫자로 본 국회',
                pageStyles: null,
                currentUrl: '/xray',
                groups: XRAY_GROUPED
            });
        } catch (error) {
            logger.error('X레이 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 섹션 조각 — 펼칠 때만 호출됨. layout 없이 조각만 반환 */
    controller.getSectionFragment = wrapWithContext(async function getSectionFragment(req, res, next) {
        const section = getSection(req.params.id);
        if (!section) {
            return res.status(404).type('text/html; charset=utf-8')
                .send('<div class="xr-empty">알 수 없는 섹션입니다.</div>');
        }

        try {
            const data = await xrayService.loadSection(section.loader);

            res.render(section.partial, {
                layout: false,          // express-ejs-layouts 우회 — 조각만 반환
                x: data,
                section,
                nf, pct, median
            }, (renderErr, html) => {
                if (renderErr) {
                    logger.error(`X레이 섹션(${section.id}) 렌더 실패: ${renderErr.message}`);
                    return res.status(500).type('text/html; charset=utf-8')
                        .send('<div class="xr-empty">이 섹션을 불러오지 못했습니다.</div>');
                }
                res.type('text/html; charset=utf-8').send(html);
            });
        } catch (error) {
            logger.error(`X레이 섹션(${section.id}) 조회 실패:`, `${error.message}\n${error.stack}`);
            res.status(500).type('text/html; charset=utf-8')
                .send('<div class="xr-empty">이 섹션을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>');
        }
    });

    return controller;
};
