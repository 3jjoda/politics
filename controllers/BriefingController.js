// controllers/BriefingController.js — 브리핑(최근 국회 활동) 페이지
//
// 1단계: 데이터만. AI 호출 0회.

import BriefingService from '../services/BriefingService.js';
import { buildThreadsChain, THREADS_LIMIT, siteUrl } from '../utils/threadsPost.js';
import { buildCaption } from '../utils/instaCaption.js';
import { nf, pct } from '../utils/xrayFormat.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

// 인스타 카드 — 한 브리핑을 캐러셀 여러 장으로 쪼갠다.
// 주제 묶음이 많아도 3장까지만: 캐러셀이 길면 끝까지 넘기지 않는다.
const MAX_THREAD_SLIDES = 3;

// "그날의 숫자" 장이 비교를 내려면 기준 구간이 최소 이만큼은 있어야 한다 (서비스 시작 직후 방어)
const MIN_BASE_DAYS = 10;
// 흐름 장의 법안 목록 상한 — 4건일 땐 위 40% 가 비었다 (피드백). 5건 + 큰 글자로 채운다
const THREAD_BILLS = 5;

/* 카드 한 장 → 슬라이드 배열.
   ⚠️ 슬라이드 수는 **데이터가 정한다** (폴백 카드는 threads 가 비어 4장, AI 카드는 최대 7장).
      뷰에서 개수를 가정하지 말 것.
   ctx: BriefingService.getCardContext() — { baseline, lawProposers } (없으면 그 장을 뺀다) */
function buildSlides(p, ctx = {}) {
    const st = p.stats || {};
    const slides = [{ kind: 'cover' }];

    // 활동 없는 날은 숫자가 전부 0이라 보여줄 게 없다 (애초에 올릴 카드가 아니다)
    if (p.isEmpty) return [...slides, { kind: 'outro' }];

    /* "그날의 숫자" — 🔴 표지의 29/20/341 을 다시 크게 쓰는 장이 아니다 (그렇게 만들었다가 "2번에서 새로 얻는 게 없다"
       는 지적을 받았다 — 캐러셀은 2번째 이탈이 가장 크다). 표지 숫자에 **비교**를 붙인 장이다:
         발의 N건      → 최근 30 평일 평균의 몇 배 · 그중 몇 번째로 많은 날   (SQL 기준선, getCardBaseline)
         법안 1건당 서명 → cosign / proposed                                   (stats 나눗셈)
         의원 1명당 발의 → proposed / proposers
       ⚠️ 비교값도 전부 SQL·코드 산출이다 — AI 에게서 받지 않는다 (stats 와 같은 원칙).
       ⚠️ 기준선이 없으면(조회 실패·서비스 초기) 이 장을 **뺀다.** 표지와 겹치는 장을 내보내느니 6장이 낫다.
       ⚠️ 위원회별 발의는 뺐다 — 갓 발의된 법안은 회부 전이라 committee 가 NULL 이고, 그 줄은 사실상 나온 적이 없다 */
    const b = ctx.baseline;
    if (st.proposed > 0 && b && Number(b.base_days) >= MIN_BASE_DAYS) {
        const avg = Number(b.base_avg);
        const ratio = avg > 0 ? st.proposed / avg : null;
        const rank = Number(b.days_above) + 1;
        const cmp = [{
            v: st.proposed, u: '건', l: '발의',
            s: `최근 ${b.base_days} 평일 평균 ${avg}건` + (ratio ? ` · ${ratio.toFixed(1)}배` : '') + ` · ${rank}번째로 많은 날`,
        }];
        if (st.cosign && st.proposed) {
            cmp.push({ v: (st.cosign / st.proposed).toFixed(1), u: '명', l: '법안 1건당 공동발의',
                       s: `서명 ${nf(st.cosign)}건 ÷ 법안 ${nf(st.proposed)}건` });
        }
        if (st.proposers) {
            cmp.push({ v: (st.proposed / st.proposers).toFixed(1), u: '건', l: '대표발의 의원 1명당',
                       s: `${nf(st.proposers)}명이 ${nf(st.proposed)}건을 냈습니다` });
        }
        // ⚠️ 단위를 '건' 으로 뭉뚱그리지 말 것 — **사람은 '명'** 이다 ("대표발의 의원 13건" 이 나갔었다)
        const floorTotal = (st.floor || []).reduce((s, f) => s + Number(f.cnt), 0);
        if (floorTotal > 0) {
            cmp.push({ v: floorTotal, u: '건', l: '본회의 처리',
                       s: (st.floor || []).map((f) => `${f.result} ${nf(f.cnt)}`).join(' · ') });
        }
        slides.push({ kind: 'stats', nums: cmp });
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
            bills: (t.bill_ids || []).filter((id) => tb[id]).slice(0, THREAD_BILLS)
                .map((id) => ({ name: tb[id].bill_name, by: tb[id].proposer_name })),
        });
    });

    /* "몰린 법률" — 건수(2건 × 3줄)만으로는 왜 주목할 일인지가 없다. 이 장의 이야기는
       **같은 법을 두고 서로 다른 의원이 각자 안을 냈다**는 것이라 대표발의자를 같이 싣는다 (getCardLawProposers).
       이름은 중복 제거 — 한 의원이 같은 이름의 안을 둘 냈으면 한 번만 */
    if ((st.hotLaws || []).length) {
        const lp = ctx.lawProposers || {};
        slides.push({
            kind: 'laws',
            laws: st.hotLaws.slice(0, 5).map((l) => ({
                ...l, by: [...new Set(lp[l.bill_name] || [])],
            })),
        });
    }

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
                // 미리보기에서만 쓴다 — 배치(genInstaCards)의 caption.txt 와 같은 함수라 웹에서 미리 볼 수 있다
                caption: (single || story) ? null : buildCaption(post),
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

    /* 자동화 툴(Make · n8n 등)용 내보내기 — 쓰레드 체인 · 인스타 캡션 · 슬라이드 URL 을 JSON 하나로.
     *
     * 왜 우리 안에서 안 올리나: SNS 토큰·재시도·스케줄을 서비스에 들이지 않는다. 우리는 데이터만 낸다.
     *   GET /api/briefing/export            → 최신 카드
     *   GET /api/briefing/export?date=YYYY-MM-DD | ?id=N
     * 응답의 `publishable` 이 false 면 올리지 말 것 (폴백·활동없음 카드). 툴 쪽 필터 조건으로 쓴다.
     * ⚠️ 인스타 이미지는 HTML 페이지 URL(`?slide=N`)이다 — API 는 공개 JPEG URL 을 요구하므로 툴에서
     *    스크린샷 서비스(URL→이미지)를 한 단계 끼워야 한다. 스토리 링크 스티커는 API 로 못 붙여 스토리는 수동.
     * 보호: env `BRIEFING_EXPORT_KEY` 가 있으면 `?key=` 또는 `X-Export-Key` 헤더가 같아야 한다 (공개 데이터라 없어도 동작) */
    controller.getBriefingExport = wrapWithContext(async function getBriefingExport(req, res, next) {
        try {
            const need = process.env.BRIEFING_EXPORT_KEY;
            if (need && req.query.key !== need && req.get('x-export-key') !== need) {
                return res.status(404).json({ error: 'not found' });   // 존재를 숨긴다 (admin 과 같은 판단)
            }
            let post = null;
            if (req.query.id) {
                const id = Number(req.query.id);
                post = Number.isInteger(id) && id > 0 ? await briefingService.getPost(id) : null;
            } else {
                const feed = await briefingService.getFeed(1);
                const want = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : null;
                const hit = want ? feed.posts.find((p) => p.briefing_date === want) : feed.posts[0];
                post = hit ? await briefingService.getPost(hit.id) : null;
            }
            if (!post) return res.status(404).json({ error: 'not found', ready: false });

            const site = siteUrl();
            const slides = buildSlides(post);
            const base = `${site}/briefing/${post.id}`;
            const strip = (arr) => arr.map((p) => ({ n: p.n, role: p.role, text: p.text, len: p.len }));
            res.set('Cache-Control', 'no-store');
            res.json({
                ready: true,
                id: Number(post.id),   // BIGINT 가 문자열로 온다 — 툴에서 숫자 비교하게
                date: post.briefing_date,
                kind: post.isAi ? 'ai' : (post.isEmpty ? 'none' : 'fallback'),
                publishable: !!post.isAi,   // 폴백·활동없음은 올릴 카드가 아니다
                headline: post.headline,
                url: base,
                threads: {
                    limit: THREADS_LIMIT,
                    short: strip(buildThreadsChain(post, { mode: 'short', baseUrl: site })),
                    full:  strip(buildThreadsChain(post, { mode: 'full',  baseUrl: site })),
                },
                instagram: {
                    caption: buildCaption(post),
                    slideCount: slides.length,
                    slides: slides.map((_, i) => `${base}/card?slide=${i + 1}`),   // 1080×1350 HTML — 스크린샷 서비스로 이미지화
                    story: `${base}/card?story=1`,                                   // 1080×1920 HTML — 링크 스티커는 수동
                    size: { feed: [1080, 1350], story: [1080, 1920] },
                },
            });
        } catch (error) {
            logger.error('브리핑 export 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    return controller;
};
