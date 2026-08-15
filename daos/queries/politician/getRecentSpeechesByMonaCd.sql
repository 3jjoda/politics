/* 의원 최근 발언 영상
   $1: mona_cd
   $2: limit

   🔴 요약과 **같은 필터**여야 한다 (`role_kind IN ('member','chair')`).
      어긋나면 "질의석 12건" 이라고 써놓고 목록에 장관 답변이 뜬다.
      필터 이유는 getSpeechSummaryByMonaCd.sql 주석 참조.

   ⚠️ `rec_sec` 을 같이 내리지만 이건 **클립 길이**지 개인 발언시간이 아니다
      (한 클립에 질의와 답변이 함께 녹화된다). 화면에 주의 문구를 반드시 병기할 것.
   ⚠️ 날짜는 여기서 문자열로 만든다 — DATE 를 JS Date 로 받으면 타임존 해석이 끼어 하루 밀린다. */
SELECT s.clip_id
     , s.role
     , s.role_kind
     , s.act
     , TO_CHAR(s.taking_date, 'YYYY-MM-DD') AS taking_date
     , s.meeting_kind
     , s.conf_title
     , s.rec_sec
     , s.link_url
  FROM politician_speeches s
 WHERE s.mona_cd = $1
   AND s.role_kind IN ('member', 'chair')
 ORDER BY s.taking_date DESC, s.clip_id DESC
 LIMIT $2
