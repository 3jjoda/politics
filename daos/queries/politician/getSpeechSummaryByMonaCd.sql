/* 의원 발언 요약 (politician_speeches)
   $1: mona_cd

   🔴 **`role_kind IN ('member','chair')` 만 센다.**
      나머지 셋(government·witness·other)은 소스가 MONA_CD 를 주지 않아 **이름으로만 매칭**한
      결과라 동명이인 오귀속이 섞여 있다 (도지사 김영환 87건 · 회장 김병주 21건 — 전부 다른 사람).
      `위원장`·`위원`·`간사` 같은 직위는 국회의원만 가질 수 있어 이름 충돌이 구조적으로 없다.
      이게 두 갈래만 쓰는 이유다. 편의상 빼먹은 게 아니니 되돌리지 말 것.

   🔴 질의석(member)과 위원장석(chair)을 **합치지 않는다.** 위원장은 안건을 호명하느라 발언이
      구조적으로 많다 (실측 서영교 위원장석 680건 vs 질의석 365건). 합치면 "위원장을 맡았다" 가
      "말을 많이 했다" 로 둔갑한다.

   ⚠️ 이 값들로 의원 간 순위를 매기지 않는다 — 위원회마다 회의 빈도가 다르다. 화면 방침 참조.
   ⚠️ `rec_sec` 은 합산하지 않는다. 한 클립에 질의와 답변이 함께 녹화돼 있어
      ("김용민 위원 질의 / 정성호 장관 답변" 6:20) **개인 발언시간이 아니다.**
      클립 하나의 길이는 최근 목록에서 참고용으로만 보여준다. */
SELECT COUNT(*) FILTER (WHERE role_kind = 'member')::int          AS member_cnt
     , COUNT(*) FILTER (WHERE role_kind = 'chair')::int           AS chair_cnt
     , COUNT(DISTINCT taking_date)::int                           AS speech_days
     , TO_CHAR(MIN(taking_date), 'YYYY-MM-DD')                    AS first_date
     , TO_CHAR(MAX(taking_date), 'YYYY-MM-DD')                    AS last_date
       /* 회의 종류 분포 — 같은 행을 두 번 스캔하지 않으려고 여기서 같이 만든다.
          많은 순 정렬은 SQL 이 끝낸다 (뷰에서 다시 정렬하지 않게). */
     , COALESCE((
         SELECT JSON_AGG(x ORDER BY x.cnt DESC, x.meeting_kind)
           FROM (SELECT COALESCE(meeting_kind, '기타') AS meeting_kind, COUNT(*)::int AS cnt
                   FROM politician_speeches
                  WHERE mona_cd = $1 AND role_kind IN ('member', 'chair')
                  GROUP BY 1) x
       ), '[]'::json)                                             AS meetings
  FROM politician_speeches
 WHERE mona_cd = $1
   AND role_kind IN ('member', 'chair')
