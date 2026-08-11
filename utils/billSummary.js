// billSummary.js — 국회 공식 "제안이유 및 주요내용" 원문(bills.summary) 표시 헬퍼
//
// 원문은 거의 항상 머리말 한 줄로 시작한다 (실측 18,631건 중 18,597건 = 99.8%):
//   "제안이유 및 주요내용"  15,450건
//   "제안이유"               3,107건
//   "■ 제안이유 및 주요내용" / "제안이유 및 주요 내용" / "제안이유 및 주용내용"(오타) …
//
// 이걸 안 벗기면 목록 카드가 전부 같은 첫 줄로 시작해서, 애초에 이 데이터를 넣은 이유
// (동명 법안이 구분되지 않는 문제)를 그대로 재현하게 된다.

// 머리말 판정: 짧은 한 줄 + '이유' 또는 '주요내용' 계열 단어
//   실측 15종 변형(오타·전각기호·띄어쓰기 흔들림)을 개별 매칭하는 대신
//   "짧고 제목처럼 생겼는가" 로 판정한다 — 새 변형이 나와도 걸린다.
//   본문 문장은 최소 40자를 넘으므로 20자 상한과 충돌하지 않는다.
const HEADING_MAX_LEN = 20;
const HEADING_WORD = /이유|주요\s*내용|주용내용|주요\s*사항/;

/**
 * 원문에서 선두 머리말 줄을 제거한다.
 * 머리말로 보이지 않으면 원문을 그대로 돌려준다 (판정 실패 시 내용을 잃지 않도록).
 */
export const stripSummaryHeading = (text) => {
    if (!text) return '';
    const lines = String(text).split('\n');
    let i = 0;

    // 선두 공백 줄 건너뛰기
    while (i < lines.length && !lines[i].trim()) i++;
    if (i >= lines.length) return '';

    const first = lines[i].trim();
    if (first.length <= HEADING_MAX_LEN && HEADING_WORD.test(first)) i++;

    return lines.slice(i).join('\n').trim();
};

/**
 * 목록 카드용 미리보기 — 머리말 제거 + 개행·중복 공백을 한 칸으로 접기.
 * 줄 수 제한은 CSS(-webkit-line-clamp)가 하므로 여기서는 길이만 넉넉히 자른다.
 */
export const summaryPreview = (text, maxLen = 220) => {
    const body = stripSummaryHeading(text).replace(/\s+/g, ' ').trim();
    if (!body) return '';
    return body.length > maxLen ? body.slice(0, maxLen).trimEnd() + '…' : body;
};
