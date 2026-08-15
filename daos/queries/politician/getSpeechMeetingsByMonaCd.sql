/* 의원 발언 회의 목록 — 클립이 아니라 **회의**가 단위다
   $1: mona_cd

   🔴 왜 클립 단위가 아닌가 (실측):
      한 회의에서 클립이 최대 **83개** 나온다 (이인선 · 2025-07-14 여성가족위).
      의원당 클립은 중앙값 147 · 최대 2,598(최민희)인데 회의로 묶으면 121개로 줄어든다
      (압축비 21.5:1). 평면 클립 목록은 **같은 회의 제목이 수십 번 반복**되는 노이즈라
      기록으로 읽히지 않는다. 회의 단위는 화면의 "발언한 날 N일" 과도 같은 축이다.

   🔴 요약과 **같은 필터**여야 한다 (`role_kind IN ('member','chair')`).
      어긋나면 "질의석 12건" 이라고 써놓고 목록에 장관 답변이 뜬다.
      필터 이유는 getSpeechSummaryByMonaCd.sql 주석 참조.

   ⚠️ **재생시간을 합산하지 않는다.** 한 클립에 질의와 답변이 함께 녹화돼 있어 개인 발언시간이
      아닌데, 회의 단위로 더하면 그 왜곡이 그대로 커진다. 세는 것은 클립 수만.
   ⚠️ LIMIT 을 걸지 않는다 — 회의 수는 데이터가 자연히 제한한다 (실측 최대 155개/의원,
      전체 고유 회의도 1,422개뿐). 접는 건 화면이 한다.
   ⚠️ 날짜는 여기서 문자열로 만든다 — DATE 를 JS Date 로 받으면 타임존 해석이 끼어 하루 밀린다. */
SELECT TO_CHAR(s.taking_date, 'YYYY-MM-DD')                      AS taking_date
     , s.conf_title
     , MIN(s.meeting_kind)                                       AS meeting_kind
     , COUNT(*)::int                                             AS clip_cnt
     , COUNT(*) FILTER (WHERE s.role_kind = 'member')::int        AS member_cnt
     , COUNT(*) FILTER (WHERE s.role_kind = 'chair')::int         AS chair_cnt
       /* 회의 영상 링크를 만들 재료. 클립 URL 에서 `no=` 만 떼면 그 회의 전체 페이지가 된다
          (2026-08-15 실측 확인). mc·ct1·ct2·ct3 가 회의를 특정하므로 아무 클립이나 써도 된다. */
     , (ARRAY_AGG(s.link_url ORDER BY s.clip_id))[1]             AS sample_link
  FROM politician_speeches s
 WHERE s.mona_cd = $1
   AND s.role_kind IN ('member', 'chair')
 GROUP BY s.taking_date, s.conf_title
 ORDER BY s.taking_date DESC, MAX(s.clip_id) DESC
