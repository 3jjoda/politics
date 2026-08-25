// controllers/PromoController.js — SNS 운영용 카드 생성 페이지 (운영자 도구)
//
// /promo/numbers — 「숫자 캐러셀」 (SNS.md 백로그 1). 인스타 4:5 카드를 브라우저에서 그려
// cardShot.js 로 PNG 를 받는다 (브리핑 인스타 카드와 같은 방식 · ?slide=N = 1080×1350 1:1).
//
// 🔴 숫자는 화면에 하드코딩하지 않는다 — getHomeFacts(10분 캐시)가 그날 값을 준다.
//    카드에 "22대 국회 · 날짜 기준" 이 항상 붙는 이유다 (SNS.md 생산 규칙 3).
// 🔴 시리즈 문안은 홈 B 섹션·용어 설명과 같은 말이어야 한다 — 카드가 혼자 다른 주장을 하면 안 된다.
//    특히 불참 시리즈의 "게으름이 아니다" 각주는 KPI 코호트 제외 사유와 같은 내용이다.
// ⚠️ 라우트는 공개다 (브리핑 카드와 같은 판단 — 같은 공개 데이터를 다르게 그린 것뿐이고,
//    막으면 로그인 상태에 따라 미리보기가 안 된다). noindex + robots /promo 차단.

import BillService from '../services/BillService.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';
import logger from '../utils/logger.js';

const nf = (n) => Number(n).toLocaleString('ko-KR');

/* 시리즈 정의 — facts(getHomeFacts 행) → 슬라이드 배열.
   kind: num(큰 숫자) · bridge(중간 숫자+전환) · ask(질문) · process(발의→가결 단계) · outro(브랜드) */
const SERIES = {
    pending: {
        label: '계류',
        title: '법안 4건 중 3건',
        tags: ['입법', '법안처리'],
        slides: (f) => [
            { kind: 'num', kicker: `22대 국회의 법안 ${nf(f.bill_total)}건 중`, big: `${f.pending_rate}%`,
              line: '발의된 법안 4건 중 3건은 아직 위원회에 있습니다' },
            { kind: 'bridge', kicker: '그런데 이 숫자에는 뒷이야기가 있습니다', big: `${nf(f.bill_pending_over_1y)}건`,
              line: '발의된 지 1년이 넘도록 결론이 나지 않았습니다',
              sub: '법안을 냈다고 심사되는 것은 아닙니다. 임기가 끝나면 심사받지 못한 법안은 폐기됩니다.' },
            { kind: 'ask', head: '법안을 많이 발의한 의원이\n일을 많이 한 의원일까요?',
              sub: '발의 건수만으로는 알 수 없습니다. 몇 건이 심사를 통과했는지, 어디서 멈췄는지가 같이 보여야 합니다.' },
            { kind: 'process', head: '당말사는 전 과정을 봅니다', active: 1,
              note: '계류가 곧 방치는 아닙니다. 위원회 심사는 원래 오래 걸립니다. 그래서 건수 하나가 아니라 과정을 봅니다.' },
            { kind: 'outro', head: '숫자로 국회를 보면\n생각보다 다르게 보입니다' },
        ],
        caption: (f) => [
            `발의된 법안 100건 중 ${Math.round(f.pending_rate)}건은 아직 위원회에 있습니다.`,
            `그중 ${nf(f.bill_pending_over_1y)}건은 발의된 지 1년이 넘었습니다.`,
            '',
            '법안을 많이 발의한 의원이 일을 많이 한 의원일까요?',
            '당말사는 발의 → 위원회 → 본회의 → 가결, 전 과정을 봅니다.',
            '',
            '전체 기록은 프로필 링크에서.',
            '',
            '#국회 #법안 #당말사 #입법 #법안처리',
        ].join('\n'),
    },
    oppose: {
        label: '반대표',
        title: '반대는 0.7%',
        tags: ['본회의', '표결'],
        slides: (f) => {
            const per = Math.round(f.vote_total / Math.max(1, f.vote_oppose));
            return [
                { kind: 'num', kicker: `본회의 표결 ${nf(f.vote_total)}건 중`, big: `${f.oppose_rate}%`,
                  line: `반대표는 ${nf(f.vote_oppose)}건뿐입니다` },
                { kind: 'bridge', kicker: '얼마나 드문 걸까요', big: `${nf(per)}번 중 1번`,
                  line: '본회의에서 반대표가 나오는 빈도입니다',
                  sub: '본회의까지 온 법안은 거의 그대로 통과합니다.' },
                { kind: 'ask', head: '그럼 법안은\n어디서 걸러질까요?',
                  sub: `본회의가 아니라 위원회입니다. 발의된 법안 4건 중 3건이 위원회에서 결론을 기다리고 있습니다.` },
                { kind: 'process', head: '찬반보다 먼저 볼 곳', active: 1,
                  note: '위원회 심사는 의원 개인별 표결이 공개되지 않습니다. 그래서 당말사는 법안마다 날짜와 결과로 그 길을 따라갑니다.' },
                { kind: 'outro', head: '숫자로 국회를 보면\n생각보다 다르게 보입니다' },
            ];
        },
        caption: (f) => [
            `본회의 표결 ${nf(f.vote_total)}건 중 반대표는 ${f.oppose_rate}%.`,
            '본회의까지 온 법안은 거의 그대로 통과합니다.',
            '',
            '그럼 법안은 어디서 걸러질까요? 본회의가 아니라 위원회입니다.',
            '당말사는 법안마다 발의 → 위원회 → 본회의 → 가결의 길을 따라갑니다.',
            '',
            '전체 기록은 프로필 링크에서.',
            '',
            '#국회 #법안 #당말사 #본회의 #표결',
        ].join('\n'),
    },
    absent: {
        label: '불참',
        title: '다섯 번 중 한 번',
        tags: ['국회의원', '본회의'],
        slides: (f) => [
            { kind: 'num', kicker: '국회의원 절반은', big: `${f.absent_median}%`,
              line: '본회의 표결 다섯 번 중 한 번 이상 자리에 없습니다',
              meta: `의원별 불참률의 중앙값 · 표결 100건 이상 ${nf(f.absent_cohort)}명 기준` },
            { kind: 'ask', head: '기권과 불참은 다릅니다',
              sub: '기권은 표결에 참여해 찬반을 고르지 않은 것. 불참은 그 표결에 아예 없었던 것입니다. 이 숫자는 불참만 센 것입니다.' },
            { kind: 'ask', head: '불참이 많은 의원은\n게으른 의원일까요?',
              sub: '꼭 그렇지는 않습니다. 장관을 겸직하면 자리를 비우고, 국회의장은 관례상 표결에 참여하지 않습니다. 표결에 불참하는 방식으로 입장을 드러내는 경우도 있습니다.' },
            { kind: 'outro', head: '그래서 숫자 하나로\n단정하지 않습니다',
              note: '당말사는 불참을 지우지도, 단정하지도 않습니다. 이유가 있는 자리에는 이유를 함께 적습니다.' },
        ],
        caption: (f) => [
            `국회의원 절반은 본회의 표결 다섯 번 중 한 번 이상 자리에 없습니다 (의원별 불참률 중앙값 ${f.absent_median}%).`,
            '',
            '불참이 많으면 게으른 의원일까요? 꼭 그렇지는 않습니다.',
            '장관 겸직, 의장의 관례상 중립, 표결 불참으로 드러내는 입장이 섞여 있습니다.',
            '그래서 당말사는 숫자 하나로 단정하지 않고, 이유가 있는 자리에는 이유를 적습니다.',
            '',
            '전체 기록은 프로필 링크에서.',
            '',
            '#국회 #법안 #당말사 #국회의원 #본회의',
        ].join('\n'),
    },
};

export default (db) => {
    const billService = BillService(db);
    const controller = {};

    controller.getNumbersCard = wrapWithContext(async function getNumbersCard(req, res, next) {
        try {
            const key = Object.prototype.hasOwnProperty.call(SERIES, req.query.series) ? req.query.series : 'pending';
            const def = SERIES[key];
            const facts = await billService.getHomeFacts();
            if (!facts) {
                return res.status(503).type('text/plain; charset=utf-8')
                    .send('숫자를 불러오지 못했습니다. 잠시 후 다시 열어주세요.');
            }
            const slides = def.slides(facts);
            const raw = req.query.slide;
            const single = raw === undefined || raw === ''
                ? null
                : Math.min(slides.length, Math.max(1, Math.floor(Number(raw) || 1)));
            // 카드에 박는 날짜 — 올리는 날 기준 (KST 고정, 로컬 getter 금지)
            const dateKo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()).replace(/-/g, '.');
            res.render('promo/numbers_card', {
                layout: false,
                seriesKey: key,
                seriesList: Object.entries(SERIES).map(([k, v]) => ({ key: k, label: v.label, title: v.title })),
                def, slides, single, dateKo,
                caption: def.caption(facts),
            });
        } catch (error) {
            logger.error('숫자 캐러셀 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    return controller;
};
