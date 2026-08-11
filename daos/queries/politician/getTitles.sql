/* 의원 특수 직위 (수동 관리)
   $1: mona_cd

   정렬: 공적 지위 → 정당 지위 순.
     의장단 → 국무위원 → 교섭단체 → 당직
   상임위 직위(위원장·간사·위원)는 여기 없다 — getCommittees.sql 이 담당한다. */
SELECT t.category
     , t.title
     , t.source_url
     , t.note
     , TO_CHAR(t.updated_at, 'YYYY-MM-DD') AS updated_at
       /* 수동 데이터라 낡을 수 있다. 화면에서 쓰진 않지만 운영 점검용으로 같이 내린다 */
     , (t.updated_at < NOW() - INTERVAL '6 months') AS is_stale
  FROM politician_titles t
 WHERE t.mona_cd = $1
 ORDER BY CASE t.category
            WHEN '의장단'   THEN 0
            WHEN '국무위원' THEN 1
            WHEN '교섭단체' THEN 2
            ELSE 3
          END
        , t.title
