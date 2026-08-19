// BalanceGameController.js — 정치 성향 밸런스 게임 (누적 모델 v2)
//
// 5단계: 초대 → 응답 → 펼침 → 비교 → 연결
// + API: respond / score / packs / questions

import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';
import BalanceGameService, { AXES, MAPPING_VERSION } from '../services/BalanceGameService.js';
import PoliticianService from '../services/PoliticianService.js';
import { AXIS_META, ALL_AXES, MATCH_AXES, POL_MAPPING_VERSION, typeOf, TYPE_LIST, D_CENTER, D_STRONG, AXIS_MID } from '../utils/axisConfig.js';
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
            const [packs, axisScore, history] = await Promise.all([
                svc.listPacks(),
                userId ? svc.getUserAxisScore(userId) : Promise.resolve(null),
                userId ? svc.listUserPackHistory(userId) : Promise.resolve([])
            ]);
            const completed = svc.isCompleted(axisScore);

            /* 🔴 "진행 중" — 응답은 있는데 완료가 아닌 상태. **문항을 교체하면 대량으로 생긴다.**
               완료 판정이 활성 문항 기준이라(BalanceGameDao.recomputeUserAxisScore 주석 참조),
               옛 문항을 푼 사람은 응답이 남아 있어도 미완료로 떨어진다 (실측: 6명 전원 16/20).
               이때 화면이 "진단 시작하기" 만 보여주면 **한 번도 안 푼 사람과 구분이 안 돼**
               "나 분명히 했는데?" 가 된다. 남은 문항 수를 알려주고 이어서 풀게 한다. */
            const gh = history.find((h) => h.is_general) || null;
            const progress = (!completed && gh && gh.response_count > 0)
                ? { answered: gh.response_count, total: gh.question_count,
                    left: Math.max(0, gh.question_count - gh.response_count) }
                : null;
            res.render('balance/invite', {
                pageTitle: '성향 진단',
                pageStyles: 'balance/invite',
                currentUrl: '/balance-game',
                pageDesc: '문항 20개로 경제·사회·정치제도 성향 좌표를 만들고, 공동발의 기록으로 계산한 국회의원 좌표와 비교해 나와 가장 가까운 의원을 찾습니다',
                axes: AXES,
                packs,
                completed,
                progress,
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
            const [overall, group, spread, cloud] = await Promise.all([
                svc.getOverallAxisAvg(),
                groupKey ? svc.getGroupAxisAvg(groupKey) : Promise.resolve(null),
                politicianService.getMatchSpread(userAxis, 3),
                politicianService.getAxisCloud()          // 「전체 분포 속 나」 산점도 (익명 점구름)
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
                cloud,
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

    /* 단계 5 「연결」(`/balance-game/connect`) 은 2026-08-16 폐지 — 카드(reveal)가 가까운 의원·공유·비교를 다 갖게 되어 역할이 겹쳤다.
       라우트는 reveal 로 301 (routes/PageRoutes.js). 카드 컬렉션 구상은 주제팩이 생기면 그때 (balance_game_packs 는 그대로) */

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

            // 가까운 3명 + 가장 먼 3명 (반대 성향) — compare 와 같은 쿼리
            const [spread, cloud] = await Promise.all([politicianService.getMatchSpread(userAxis, 3), politicianService.getAxisCloud()]);
            const slim = (m) => ({ name: m.name, district: m.electoral_district || '', retired: m.active_yn === false, e: Number(m.economy), s: Number(m.social), i: Number(m.institution) });   // e·s·i: 지도·막대에 점 찍기용
            const share = {
                axis: userAxis,
                axes: ALL_AXES.map(k => ({ key: k, ...AXIS_META[k], measured: MATCH_AXES.includes(k) })),
                matches: spread ? spread.near.map(slim) : [],
                far:     spread ? spread.far.map(slim)  : [],
                polTotal: spread ? spread.total : 0,
                cloud,                                   // 좌표 지도용 — 이름·정당 없는 [e,s,i] 배열
                type: typeOf(userAxis),                  // 유형 이름 (utils/axisConfig.js 단일 소스)
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
       유형 9종 안내 (`/balance-game/types`) — 2026-08-16
       이름 체계·판정 기준을 화면에 명시한다 (외부 제안 채택). 로그인 없이 볼 수 있고,
       진단 완료 유저면 내 유형을 강조한다. 데이터는 utils/axisConfig.js 하나에서 온다
       =========================================================== */
    controller.getTypesPage = wrapWithContext(async function getTypesPage(req, res, next) {
        try {
            const userId = req.session?.userId || null;
            const axisScore = userId ? await svc.getUserAxisScore(userId) : null;
            const completed = svc.isCompleted(axisScore);
            const my = completed ? typeOf({ economy: Number(axisScore.economy), social: Number(axisScore.social) }) : null;
            res.render('balance/types', {
                pageTitle: '성향 유형 9종',
                pageStyles: null,
                currentUrl: '/balance-game/types',
                pageDesc: '자유 개척자·포용 개혁가·자립 원칙가·질서 설계자와 온건형, 균형 조율자. 경제×사회 좌표로 나뉘는 정치 성향 유형 9종의 뜻과 판정 기준',
                types: TYPE_LIST,
                thresholds: { center: D_CENTER, strong: D_STRONG, axisMid: AXIS_MID },
                my,
                myAxis: completed ? { economy: Number(axisScore.economy), social: Number(axisScore.social) } : null,
                completed
            });
        } catch (err) {
            logger.error('유형 안내 화면 렌더링 중 에러:', `${err.message}\n${err.stack}`);
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
