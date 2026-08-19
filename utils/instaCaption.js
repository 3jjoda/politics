// utils/instaCaption.js — 인스타 캡션 조립 (단일 소스)
//
// 쓰는 곳 둘: batch/genInstaCards.js (caption.txt) · views/briefing/card.ejs (카드 미리보기 페이지의 캡션 블록).
// 🔴 갈리면 "미리보기에서 본 캡션과 배치가 뽑은 캡션이 다르다" 가 된다 — 여기만 고칠 것.
// 입력 p 는 BriefingService.getPost() 의 shape (briefing_date · headline · model · stats · threads · keywords).

/* 인스타 캡션 — 그대로 복사해 캡션 칸에 붙여넣는 텍스트.
 *
 * 🔴 캡션은 **이미지를 반복하는 자리가 아니다.** 카드에 이미 있는 것(날짜·헤드라인·숫자·흐름)을
 *    다시 적으면 자막이 될 뿐이다. 캡션만 할 수 있는 일 세 가지에 집중한다:
 *      ① 검색 유입(해시태그)  ② 프로필 링크 유도  ③ 고지
 *
 * ⚠️ **인스타 캡션의 URL 은 클릭되지 않는다.** `→ dangmalsa.kr` 처럼 링크 모양으로 써두면
 *    눌러도 아무 일이 안 일어나 안 쓴 것만 못하다. 반드시 "프로필 링크" 로 유도할 것.
 * ⚠️ 첫 2줄만 보이고 나머지는 `... 더 보기` 로 접힌다 → 첫 줄은 **헤드라인**이어야 한다.
 *    날짜를 앞에 두면 가장 비싼 자리를 카드 표지(54px 날짜)와 중복시키는 셈이다.
 */
export function buildCaption(p) {
    const [, mm, dd] = p.briefing_date.split('-');
    const isAi = p.model && p.model !== 'fallback' && p.model !== 'none';
    const isEmpty = p.model === 'none';
    const st = p.stats || {};

    // ① 첫 2줄 — 더 보기 이전에 노출되는 전부
    const L = [p.headline, `${Number(mm)}월 ${Number(dd)}일 국회 기록입니다.`];

    // ② 숫자 (SQL 집계값)
    const nums = [];
    if (!isEmpty && st.proposed !== undefined) {
        nums.push(`발의 ${st.proposed}건`);
        if (st.proposers) nums.push(`대표발의 ${st.proposers}명`);
        if (st.cosign) nums.push(`공동발의 서명 ${st.cosign}건`);
    }
    if (nums.length) L.push('', nums.join(' · '));

    // ③ 흐름 — AI 가 값을 더한 유일한 지점이라 캡션에도 남긴다
    const threads = Array.isArray(p.threads) ? p.threads : [];
    if (threads.length) {
        L.push('', '이날의 흐름');
        threads.forEach((t) => L.push(`· ${t.theme} (${t.bill_count}건): ${t.what}`));
    }

    // ④ 프로필 링크 유도 + 소개와 같은 문장 (계정 전체가 같은 말을 반복해야 정체성이 된다)
    L.push('', '법안 원문과 의원별 표결 기록은 프로필 링크에서 볼 수 있습니다.', '직접 보고 판단하세요.');

    // ⑤ 고지 — 카드가 사이트 밖으로 나가므로 이미지와 캡션 양쪽에 있어야 한다
    L.push('');
    if (isAi) {
        L.push('숫자는 국회 공식 데이터 집계입니다. 문장과 주제 묶음은 AI가 법안 원문을 읽고 정리한 것으로 사실과 다를 수 있습니다.');
    } else if (isEmpty) {
        L.push('국회 공식 데이터에 이날 기록된 활동이 없어 자동으로 남긴 기록입니다.');
    } else {
        L.push('AI 없이 국회 공식 데이터 집계만으로 만들었습니다.');
    }
    L.push('출처: 열린국회정보');

    /* ⑥ 해시태그
       🔴 **인스타 캡션 해시태그 상한 5개** (2026-08 확인). 상한이 바뀌면 이 상수만 고치면 된다.
       배분: 고정 3 + 그날 주제 2.
         · 고정을 3개로 줄인 건 매일 같은 태그만 반복하면 그 자체가 신호가 안 되기 때문.
         · `#국회`·`#법안` 은 발견용, `#당말사` 는 내 글을 한데 모으는 아카이브용.
       ⚠️ `#정치`·`#시사` 는 넣지 않는다. 쓰레드에서 `정치뉴스` 태그가 진영 글을 끌어온 것과
          같은 위험이 있다. 사안 중심 태그는 안전하다.
       ⚠️ 정당·인물 태그는 절대 금지 — 그 순간 계정이 편을 든 것이 된다. */
    const MAX_TAGS = 5;
    const BASE = ['국회', '법안', '당말사'];
    const extra = (Array.isArray(p.keywords) ? p.keywords : [])
        .map((k) => String(k).replace(/[\s#·]/g, ''))
        // 길이는 거친 대용치다 — `조세특례제한법`(7) 같은 실제 법률명은 살리고
        // `필수항공운송노선`(8) 처럼 AI 가 지어낸 구절은 거른다. 완벽하진 않으니
        // 올리기 전에 caption.txt 마지막 줄을 한 번 훑고 손대는 게 맞다
        .filter((k) => k.length >= 2 && k.length <= 7);
    const tags = [...new Set([...BASE, ...extra])].slice(0, MAX_TAGS);
    L.push('', tags.map((k) => `#${k}`).join(' '));

    return L.join('\n');
}
