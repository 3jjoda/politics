/* 홈 히어로 — 의원 N명 무작위 + 축별 좌표 + 소속 정당 평균 (2026-08-16 신규)

   왜: 홈이 "국회는 이렇다"(결론 숫자 3개)로 시작했는데 이 사이트의 차별점은 "의원 한 명 한 명이 이렇다" 다.
       무작위 3명의 경제·사회·제도 좌표를 **소속 정당 평균 눈금과 함께** 보여주면 그 자체가 "당 말고 사람" 의 증명이다
       (같은 당인데 평균에서 얼마나 떨어져 있는지가 보인다). 기준(정당 평균) 없이 좌표만 보여주면 아무 뜻이 없다.

   🔴 무작위다 — 편집 개입이 없어야 중립이다. 정당 안배도 하지 않는다 (안배가 곧 편집이다).
   ⚠️ 현직(active_yn)만 — 홈 KPI 와 같은 판단 (CLAUDE.md `active_yn` 항목). 세 축 다 있는 의원만 (서명 5건 미만 축이 있으면 제외).
   ⚠️ 정당 평균의 모집단은 좌표 있는 의원 전체(퇴임 포함) — 상세의 순위 모집단과 같다.
   ⚠️ 안보축은 없다 (utils/axisConfig.js). 축을 바꾸면 여기 SELECT 도 같이.

   인자: $1 limit */
WITH s AS (
    SELECT a.mona_cd, a.economy, a.social, a.institution, a.economy_n, a.social_n, a.institution_n,
           p.name, COALESCE(p.party_name, '무소속') AS party_name, p.photo_url, p.electoral_district, p.active_yn
      FROM politician_axis_score a
      JOIN politicians p ON p.mona_cd = a.mona_cd
     WHERE a.mapping_version = 'v2'
       AND a.economy IS NOT NULL AND a.social IS NOT NULL AND a.institution IS NOT NULL
), pavg AS (
    SELECT party_name, COUNT(*)::int AS n,
           AVG(economy) AS economy, AVG(social) AS social, AVG(institution) AS institution
      FROM s GROUP BY party_name
)
SELECT s.mona_cd, s.name, s.party_name, s.photo_url, s.electoral_district, s.active_yn
     , s.economy::float8 AS economy, s.social::float8 AS social, s.institution::float8 AS institution
     , s.economy_n, s.social_n, s.institution_n
     , pa.n AS party_n
     , pa.economy::float8 AS party_economy, pa.social::float8 AS party_social, pa.institution::float8 AS party_institution
  FROM s
  JOIN pavg pa ON pa.party_name = s.party_name
 WHERE s.active_yn = TRUE
 ORDER BY random()
 LIMIT $1
