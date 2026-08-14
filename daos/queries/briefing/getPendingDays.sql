/* 대기 중인 날 — 아직 카드가 없는 최근 평일
   $1: 되짚을 최대 일수 (오늘 포함)

   왜 테이블에 미리 넣지 않나:
     `briefing_posts.briefing_date` 가 UNIQUE 라 나중에 진짜 카드가 들어올 때 충돌하고,
     무엇보다 "카드는 한 번 쓰면 안 고친다" 는 원칙이 깨진다.
     대기는 **내용이 아니라 상태**라서 렌더 시점에 계산하는 게 맞다.

   🔴 상한($1)을 반드시 걸 것 — 배치가 오래 멈추면 "곧 올라옵니다" 딱지가 2주치 쌓여
      그 자체가 거짓말이 된다. 상한 밖은 아예 그리지 않는다 (지금과 같은 화면이 된다).

   ⚠️ 주말 제외 — genBriefing 의 `pickDays` 와 같은 판단이다.
      국회가 원래 안 하는 날이라 "대기 중" 을 띄우면 노이즈가 된다.
      주말에 본회의가 열린 예외는 배치가 카드를 만들어주므로 NOT EXISTS 로 자연히 빠진다.

   ⚠️ 오늘도 포함한다 — 사용자가 가장 먼저 묻는 게 "오늘 건 왜 없나" 다.
      단 이유가 다르므로(집계 전 vs 데이터 미도착) `is_today` 로 갈라 문구를 바꾼다. */
SELECT TO_CHAR(d, 'YYYY-MM-DD') AS day
     , (d::date = CURRENT_DATE) AS is_today
  FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, INTERVAL '1 day') d
 WHERE EXTRACT(ISODOW FROM d) < 6
   AND NOT EXISTS (SELECT 1 FROM briefing_posts bp WHERE bp.briefing_date = d::date)
 ORDER BY d DESC
