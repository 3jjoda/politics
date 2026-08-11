/* 브리핑 — 최근 N일 대표발의 정당 분포
   $1: window_days (int)

   ⚠️ 정당을 **표시하는 것**과 정당색을 쓰는 것은 다르다.
      중립성 원칙(CLAUDE.md)은 "파랑·빨강 등 정당색 금지" 이지 "정당 언급 금지" 가 아니다.
      "누가 이 법안을 냈나" 는 브리핑의 핵심 질문이고, 의원 목록·필터에서도 이미 정당을 쓴다.
      화면에서는 **골드 단색 막대 + 숫자**로만 그린다 — 정당별로 색을 나누지 말 것.

   대표발의자가 politicians 에 없으면(퇴임 등) '기타/무소속' 으로 묶인다. */
SELECT COALESCE(NULLIF(p.party_name, ''), '기타/무소속') AS party
     , COUNT(*)::int AS cnt
  FROM bills b
  LEFT JOIN politicians p ON p.mona_cd = b.mona_cd
 WHERE b.propose_dt > CURRENT_DATE - $1::int
 GROUP BY 1
 ORDER BY cnt DESC, party
