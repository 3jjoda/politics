// controllers/BriefingController.js — 브리핑(최근 국회 활동) 페이지
//
// 1단계: 데이터만. AI 호출 0회.

import BriefingService from '../services/BriefingService.js';
import { buildThreadsChain, THREADS_LIMIT } from '../utils/threadsPost.js';
import { nf, pct } from '../utils/xrayFormat.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

// 인스타 카드 — 한 브리핑을 캐러셀 여러 장으로 쪼갠다.
// 주제 묶음이 많아도 3장까지만: 캐러셀이 길면 끝까지 넘기지 않는다.
const MAX_THREAD_SLIDES = 3;

/* 카드 한 장 → 슬라이드 배열.
   ⚠️ 슬라이드 수는 **데이터가 정한다** (폴백 카드는 threads 가 비어 4장, AI 카드는 최대 7장).
      뷰에서 개수를 가정하지 말 것. */
function buildSlides(p) {
    const st = p.stats || {};
    const slides = [{ kind: 'cover' }];

    // 활동 없는 날은 숫자가 전부 0이라 보여줄 게 없다 (애초에 올릴 카드가 아니다)
    if (p.isEmpty) return [...slides, { kind: 'outro' }];

    // ⚠️ 단위를 '건' 으로 뭉뚱그리지 말 것 — **사람은 '명'** 이다 ("대표발의 의원 13건" 이 나갔었다)
    const nums = [];
    if (st.proposed !== undefined) {
        nums.push({ v: st.proposed, l: '발의', u: '건' });
        if (st.proposers) nums.push({ v: st.proposers, l: '대표발의 의원', u: '명' });
        if (st.cosign) nums.push({ v: st.cosign, l: '공동발의 서명', u: '건' });
        const floorTotal = (st.floor || []).reduce((s, f) => s + Number(f.cnt), 0);
        if (floorTotal > 0) nums.push({ v: floorTotal, l: '본회의 처리', u: '건' });
    }
    if (nums.length) {
        slides.push({ kind: 'stats', nums, committees: (st.committees || []).slice(0, 4) });
    }

    // 주제 묶음 — AI 카드의 핵심. 묶인 법안 이름을 같이 실어야 검증이 가능하다
    const tb = p.thread_bills || {};
    const threads = (p.threads || []).slice(0, MAX_THREAD_SLIDES);
    threads.forEach((t, i) => {
        slides.push({
            kind: 'thread',
            t,
            idx: i + 1,
            of: threads.length,
            // ⚠️ 대표발의자를 반드시 같이 실을 것 — 법안의 87%가 동명이라 이름만 늘어놓으면
            //    같은 줄이 두 번 찍힌 것처럼 보인다 (실제로 "소득세법 일부개정법률안" 이 2줄 나왔다)
            bills: (t.bill_ids || []).filter((id) => tb[id]).slice(0, 4)
                .map((id) => ({ name: tb[id].bill_name, by: tb[id].proposer_name })),
        });
    });

    if ((st.hotLaws || []).length) slides.push({ kind: 'laws', laws: st.hotLaws.slice(0, 5) });

    slides.push({ kind: 'outro' });
    return slides;
}

export default (db) => {
    const briefingService = BriefingService(db);
    const controller = {};

    /* 피드 — AI 카드가 시간순으로 쌓인다. 상단에 이번 주 요약 스트립. */
    controller.getBriefingPage = wrapWithContext(async function getBriefingPage(req, res, next) {
        try {
            const [feed, data] = await Promise.all([
                briefingService.getFeed(req.query.page),   // 서비스가 범위 밖 page 를 접어준다
                briefingService.get(),                     // 상단 스트립용 주간 집계
            ]);

            res.render('briefing/feed', {
                // 2페이지 이후는 제목에 표시 — 탭·검색결과에서 같은 제목이 반복되지 않게
                pageTitle: feed.page > 1 ? `브리핑 ${feed.page}페이지` : '브리핑',
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

    /* 인스타 카드 — 1080×1350 세로 캔버스
     *
     * 두 모드가 **같은 마크업**을 쓴다. 미리보기에서 본 것과 캡처한 것이 달라지면 안 되기 때문:
     *   (없음)     전체 슬라이드를 축소 배열 (사람이 훑는 용도, 툴바 포함)
     *   ?slide=N   그 장만 정확히 1080×1350 (캡처용 · 나중에 Playwright 가 그대로 돌면 됨)
     *
     * layout:false — nav·footer 가 캔버스에 딸려오면 안 된다. 폰트는 뷰가 직접 로드한다.
     */
    controller.getBriefingCard = wrapWithContext(async function getBriefingCard(req, res, next) {
        try {
            const id = Number(req.params.id);
            const post = Number.isInteger(id) && id > 0 ? await briefingService.getPost(id) : null;
            if (!post) {
                return res.status(404).render('error_pages/404', {
                    pageTitle: '찾을 수 없음', pageStyles: 'error', currentUrl: '/briefing',
                    message: '브리핑을 찾을 수 없습니다.'
                });
            }

            const slides = buildSlides(post);

            // ?slide 는 범위를 벗어나면 에러가 아니라 접는다 (손으로 URL 을 고쳐도 빈 화면이 안 나오게)
            const raw = req.query.slide;
            const single = raw === undefined || raw === ''
                ? null
                : Math.min(slides.length, Math.max(1, Math.floor(Number(raw) || 1)));

            // ?story=1 — 스토리 전용 1080×1920 한 장.
            // `slide` 와 별도 파라미터로 둔 이유: 크기가 달라서 같은 번호 체계에 못 들어간다
            // (배치가 캡처할 때 --window-size 를 다르게 줘야 한다).
            const story = req.query.story === '1' || req.query.story === 'true';

            res.render('briefing/card', {
                layout: false,
                post,
                slides,
                single,          // null = 전체 미리보기 / 1-based 인덱스 = 그 장만
                story,
                nf
            });
        } catch (error) {
            logger.error('브리핑 카드 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 쓰레드(Threads) 연결 게시물 — 복사해 붙이는 자리
     *
     * 파일이 아니라 페이지로 만든 이유: 쓰레드는 **모바일에서 올린다.**
     * 배치가 텍스트 파일을 떨궈봐야 폰으로 옮기는 일이 남는다. */
    controller.getBriefingThreads = wrapWithContext(async function getBriefingThreads(req, res, next) {
        try {
            const id = Number(req.params.id);
            const post = Number.isInteger(id) && id > 0 ? await briefingService.getPost(id) : null;
            if (!post) {
                return res.status(404).render('error_pages/404', {
                    pageTitle: '찾을 수 없음', pageStyles: 'error', currentUrl: '/briefing',
                    message: '브리핑을 찾을 수 없습니다.'
                });
            }

            // 모르는 값은 에러가 아니라 기본값으로 접는다 (URL 을 손으로 고쳐도 빈 화면이 안 나오게)
            const mode = req.query.mode === 'short' ? 'short' : 'full';

            res.render('briefing/threads', {
                pageTitle: `쓰레드 · ${post.briefing_date}`,
                pageStyles: null,
                currentUrl: '/briefing',
                post,
                mode,
                chain: buildThreadsChain(post, { mode }),
                limit: THREADS_LIMIT
            });
        } catch (error) {
            logger.error('브리핑 쓰레드 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    return controller;
};
