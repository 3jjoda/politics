/* X레이 ⑨ 같은 당, 다른 생각 — 의원별 4축 좌표 (v2 매핑 · 공동발의 기반 · 안보축은 NULL, 현직만) */
SELECT p.name, p.party_name
     , s.economy, s.social, s.security, s.institution
  FROM politician_axis_score s
  JOIN politicians p ON p.mona_cd = s.mona_cd
 WHERE s.mapping_version = 'v2' AND p.active_yn = TRUE
