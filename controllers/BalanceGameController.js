// BalanceGameController.js — 정치 성향 밸런스 게임 (누적 모델 v2)
//
// 5단계: 초대 → 응답 → 펼침 → 비교 → 연결
// + API: respond / score / packs / questions

import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';
import BalanceGameService, { AXES, MAPPING_VERSION } from '../services/BalanceGameService.js';
import PoliticianService from '../services/PoliticianService.js';
import { AXIS_META, ALL_AXES, MATCH_AXES, POL_MAPPING_VERSION } from '../utils/axisConfig.js';
import { siteUrl } from '../utils/threadsPost.js';
import { fmtDate } from '../utils/datetime.js';

export default (db) => {
    const svc = BalanceGameService(db);
    const politicianService = PoliticianService(db);
    const controller = {};

    /* ===========================================================
       단계 1 — 게임팩 컬렉션 (`/balance-game`)
       =========================================================== */
    controller.getInvitePage = wrapWithContext(async function getInvitePage(req, res, next) {
        try {
            const userId = req.session?.userId || null;
            const [packs, axisScore] = await Promise.all([
                svc.listPacks(),
                userId ? svc.getUserAxisScore(userId) : Promise.resolve(null)
            ]);
            const completed = svc.isCompleted(axisScore);
            res.render('balance/invite', {
                pageTitle: '성향 진단',
                pageStyles: 'balance/invite',
                currentUrl: '/balance-game',
                axes: AXES,
                packs,
                completed,
                axisScore,
                mappingVersion: MAPPING_VERSION
            });
        } catch (err) {
            logger.error('밸런스 게임 초대 화면 렌더링 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    /* ===========================================================
       단계 2 — 응답 화면 (`/balance-game/respond?pack=general`)
       서버에서 DB 문항 + 기존 응답 조회. 클라이언트가 한 문항씩
       즉시 POST /api/balance-game/respond 로 저장.
       =========================================================== */
    controller.getRespondPage = wrapWithContext(async function getRespondPage(req, res, next) {
        try {
            const userId = req.session?.userId;
            if (!userId) {
                const next_ = encodeURIComponent(req.originalUrl);
                return res.redirect(`/auth/login?next=${next_}`);
            }
            const packId = String(req.query.pack || 'general');
            const pack = await svc.getPack(packId);
            if (!pack) return res.redirect('/balance-game');

            const progress = await svc.getPackProgress(userId, packId);
            // 이미 모든 문항 답했으면 펼침으로
            if (progress.completed) return res.redirect('/balance-game/reveal');

            res.render('balance/respond', {
                pageTitle: pack.title,
                pageStyles: 'balance/respond',
                currentUrl: '/balance-game/respond',
                pack,
                axes: AXES,
                mappingVersion: MAPPING_VERSION,
                questions: progress.questions,
                answers: progress.answers,
                startIndex: progress.next_index
            });
        } catch (err) {
            logger.error('밸런스 게임 응답 화면 렌더링 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    /* ===========================================================
       단계 3 — 펼침 (`/balance-game/reveal`)
       종합팩 완료한 유저만 노출. 미완료면 컬렉션으로.
       =========================================================== */
    controller.getRevealPage = wrapWithContext(async function getRevealPage(req, res, next) {
        try {
            const userId = req.session?.userId;
            if (!userId) {
                const next_ = encodeURIComponent('/balance-game/reveal');
                return res.redirect(`/auth/login?next=${next_}`);
            }
            const axisScore = await svc.getUserAxisScore(userId);
            if (!svc.isCompleted(axisScore)) {
                // 종합팩 미완료 → 응답 화면으로
                return res.redirect('/balance-game/respond?pack=general');
            }

            // 2026-08-16: 카드 = 4축 막대 + 가까운 의원 3명 (구 |값| 다이아몬드 · 응답 분포 제거)
            const userAxis = {};
            for (const k of ALL_AXES) userAxis[k] = axisScore[k] == null ? null : Number(axisScore[k]);
            const matches = await politicianService.getTopMatches(userAxis, 3);

            res.render('balance/reveal', {
                pageTitle: '당신의 카드',
                pageStyles: null,
                currentUrl: '/balance-game/reveal',
                axisScore,
                matches: matches || [],
                mappingVersion: MAPPING_VERSION
            });
        } catch (err) {
            logger.error('펼침 화면 렌더링 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    /* ===========================================================
       단계 4 — 비교 (`/balance-game/compare`)
       =========================================================== */
    controller.getComparePage = wrapWithContext(async function getComparePage(req, res, next) {
        try {
            const userId = req.session?.userId;
            if (!userId) {
                const next_ = encodeURIComponent('/balance-game/compare');
                return res.redirect(`/auth/login?next=${next_}`);
            }
            const axisScore = await svc.getUserAxisScore(userId);
            if (!svc.isCompleted(axisScore)) return res.redirect('/balance-game/respond?pack=general');

            const user = res.locals.currentUser || null;
            const groupKey = user
                ? svc.buildGroupKey({ gender: user.gender, ageGroup: user.age_group })
                : null;

            // 2026-08-16: 화면의 주인공은 **의원과의 비교**(좌표 있는 의원 292명 — 데이터가 있다).
            // 응답자 평균(전체·그룹)은 50명 임계값이라 당분간 잠겨 있다 (실측 6명) — 잠금 상태를 정직하게 보인다
            const userAxis = {};
            for (const k of ALL_AXES) userAxis[k] = axisScore[k] == null ? null : Number(axisScore[k]);
            const [overall, group, spread] = await Promise.all([
                svc.getOverallAxisAvg(),
                groupKey ? svc.getGroupAxisAvg(groupKey) : Promise.resolve(null),
                politicianService.getMatchSpread(userAxis, 3)
            ]);

            // 임계값 처리
            const groupCount = group ? Number(group.user_count || 0) : 0;
            let groupTier = 'absent'; // absent | low | normal
            if (group && groupCount >= svc.GROUP_THRESHOLD_HIGH)      groupTier = 'normal';
            else if (group && groupCount >= svc.GROUP_THRESHOLD_LOW)  groupTier = 'low';

            res.render('balance/compare', {
                pageTitle: '의원과 비교 · 성향 진단',
                pageStyles: null,
                currentUrl: '/balance-game/compare',
                axes: AXES,
                axisScore,
                userAxis,
                spread,
                overall,
                group,
                groupKey,
                groupTier,
                groupThresholdLow: svc.GROUP_THRESHOLD_LOW,
                groupThresholdHigh: svc.GROUP_THRESHOLD_HIGH,
                mappingVersion: MAPPING_VERSION
            });
        } catch (err) {
            logger.error('비교 화면 렌더링 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    /* ===========================================================
       단계 5 — 연결 (`/balance-game/connect`)
       =========================================================== */
    controller.getConnectPage = wrapWithContext(async function getConnectPage(req, res, next) {
        try {
            const userId = req.session?.userId;
            if (!userId) {
                const next_ = encodeURIComponent('/balance-game/connect');
                return res.redirect(`/auth/login?next=${next_}`);
            }
            const axisScore = await svc.getUserAxisScore(userId);
            if (!svc.isCompleted(axisScore)) return res.redirect('/balance-game/respond?pack=general');

            res.render('balance/connect', {
                pageTitle: '진단 완료',
                pageStyles: 'balance/connect',
                currentUrl: '/balance-game/connect',
                axes: AXES,
                axisScore,
                mappingVersion: MAPPING_VERSION
            });
        } catch (err) {
            logger.error('연결 화면 렌더링 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    /* ===========================================================
       결과 공유 이미지 (`/balance-game/share`) — 2026-08-16
       사용자가 자기 좌표를 인스타 스토리·피드 이미지로 뽑아 가는 자리.
       그림은 클라이언트 canvas 가 그린다 (public/scripts/balanceShareCard.js) —
       서버는 재료(좌표 4축 · 가장 가까운 의원 3명 · 축 메타)만 JSON 으로 심는다.
       ⚠️ 의원 사진은 싣지 않는다 — 외부 도메인 이미지를 canvas 에 그리면 taint 돼 PNG 를 못 뽑는다.
       ⚠️ 정당명도 싣지 않는다 (인스타 카드와 같은 규칙 — 카드 한 장에 정당명이 늘어서면 그 자체가 대비 구도)
       =========================================================== */
    controller.getSharePage = wrapWithContext(async function getSharePage(req, res, next) {
        try {
            const userId = req.session?.userId;
            if (!userId) {
                const next_ = encodeURIComponent('/balance-game/share');
                return res.redirect(`/auth/login?next=${next_}`);
            }
            const axisScore = await svc.getUserAxisScore(userId);
            if (!svc.isCompleted(axisScore)) return res.redirect('/balance-game/respond?pack=general');

            const userAxis = {};
            for (const k of ALL_AXES) userAxis[k] = axisScore[k] == null ? null : Number(axisScore[k]);

            const matches = await politicianService.getTopMatches(userAxis, 3);
            const share = {
                axis: userAxis,
                axes: ALL_AXES.map(k => ({ key: k, ...AXIS_META[k], measured: MATCH_AXES.includes(k) })),
                matches: (matches || []).map(m => ({
                    name: m.name,
                    district: m.electoral_district || '',
                    retired: m.active_yn === false
                })),
                total: Number(axisScore.total_responses || 0),
                date: fmtDate(axisScore.computed_at || new Date()),   // KST 'YYYY.MM.DD'
                polMapping: POL_MAPPING_VERSION,
                siteHost: siteUrl().replace(/^https?:\/\//, '')   // 로컬이면 대표 도메인으로 (threadsPost 와 같은 판정)
            };

            res.render('balance/share', {
                pageTitle: '결과 이미지 · 성향 진단',
                pageStyles: null,   // 다른 balance 뷰처럼 인라인 <style> (public/styles/balance/ 는 없다)
                currentUrl: '/balance-game/share',
                share
            });
        } catch (err) {
            logger.error('결과 공유 이미지 화면 렌더링 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    /* ===========================================================
       매핑 미리보기 (`/balance-game/mapping`) — 길 B 조용한 노출
       =========================================================== */
    controller.getMappingPreviewPage = wrapWithContext(async function getMappingPreviewPage(req, res, next) {
        try {
            const [packs, questions] = await Promise.all([
                svc.listPacks(),
                svc.listAllActiveQuestions()
            ]);
            res.render('balance/mapping_preview', {
                pageTitle: '매핑 미리보기',
                pageStyles: 'balance/mapping_preview',
                currentUrl: '/balance-game/mapping',
                axes: AXES,
                packs,
                questions,
                mappingVersion: MAPPING_VERSION
            });
        } catch (err) {
            logger.error('매핑 미리보기 렌더링 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    /* ===========================================================
       API — 응답 저장 / 점수 조회
       =========================================================== */
    controller.respondApi = wrapWithContext(async function respondApi(req, res, next) {
        try {
            const userId = req.session?.userId;
            if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });

            const { question_id, answer } = req.body || {};
            if (!question_id || !answer) {
                return res.status(400).json({ error: 'question_id, answer 필수' });
            }
            const result = await svc.respond({
                userId,
                questionId: String(question_id),
                answer: String(answer).toUpperCase()
            });
            res.status(200).json({ success: true, ...result });
        } catch (err) {
            if (err.code === 'INVALID_ANSWER')      return res.status(400).json({ error: 'answer 는 A/B/C 만 허용' });
            if (err.code === 'QUESTION_NOT_FOUND')  return res.status(404).json({ error: '문항을 찾을 수 없습니다' });
            logger.error('respond API 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    controller.scoreApi = wrapWithContext(async function scoreApi(req, res, next) {
        try {
            const userId = req.session?.userId;
            if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });
            const score = await svc.getUserAxisScore(userId);
            const completed = svc.isCompleted(score);
            res.status(200).json({ score, completed, mapping_version: MAPPING_VERSION });
        } catch (err) {
            logger.error('score API 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    return controller;
};
