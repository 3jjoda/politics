/* 설명 재료 — **관측 데이터**에서 뽑는다.
   🔴 `politician_titles` 를 쓰지 않는 이유는 utils/anomalies.js 의 EXPLAIN 주석 참조.
      요약: titles 는 현재만 담는데 지표는 임기 전체 누적이라 시간 축이 안 맞는다
      (우원식은 2024-06~2026-05 국회의장인데 후반기 의장이 바뀌어 titles 에서 빠졌다).
      발언 기록은 날짜 범위를 갖고 있어 그 자체가 이력이다. */
SELECT
  (SELECT json_build_object(
            'period', TO_CHAR(MIN(taking_date), 'YYYY"년" FMMM"월"') || ' ~ ' || TO_CHAR(MAX(taking_date), 'YYYY"년" FMMM"월"'),
            'n', COUNT(*))
     FROM politician_speeches
    WHERE mona_cd = $1 AND role = '국회의장'
   HAVING COUNT(*) >= 10)                                     AS speaker,

  (SELECT json_build_object(
            'period', TO_CHAR(MIN(taking_date), 'YYYY"년" FMMM"월"') || ' ~ ' || TO_CHAR(MAX(taking_date), 'YYYY"년" FMMM"월"'),
            'n', COUNT(*))
     FROM politician_speeches
    WHERE mona_cd = $1 AND role = '국회부의장'
   HAVING COUNT(*) >= 10)                                     AS vice_speaker,

  /* 장관 겸직 — `role='장관'` + 기관 소속. org 는 2026-09-01 에 추가된 컬럼이다 */
  (SELECT json_build_object(
            'org', org,
            'period', TO_CHAR(MIN(taking_date), 'YYYY"년" FMMM"월"') || ' ~ ' || TO_CHAR(MAX(taking_date), 'YYYY"년" FMMM"월"'),
            'n', COUNT(*))
     FROM politician_speeches
    WHERE mona_cd = $1 AND role_kind = 'government' AND role = '장관' AND org IS NOT NULL
    GROUP BY org ORDER BY COUNT(*) DESC LIMIT 1)              AS minister,

  (SELECT COUNT(*) FROM politician_committees WHERE mona_cd = $1) AS ncmt,
  (SELECT COUNT(*) FROM bill_votes WHERE mona_cd = $1)            AS vtot,
  (SELECT MAX(cnt) FROM (SELECT COUNT(*) cnt FROM bill_votes GROUP BY mona_cd) t) AS vmax,
  (SELECT photo_url FROM politicians WHERE mona_cd = $1)          AS photo_url
