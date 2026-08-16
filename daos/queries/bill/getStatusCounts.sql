/* 법안 상태별 카운트 (상태 탭 + 스테퍼용)
   $1: committee (text, nullable) — 쉼표 분리 복수 지원
   $2: party     (text, nullable) — 쉼표 분리 복수 지원 (대표발의 정당)
   $3: bill_name (text, nullable) — 법안명 완전일치 ("같은 법률 개정안 N건" 계열 필터)
   $4: search    (text, nullable) — 법안명·대표발의자 부분일치 또는 의안번호 완전일치

   ⚠️ getList.sql 의 WHERE 와 동일한 필터 집합을 유지할 것 —
      어긋나면 탭 숫자와 실제 목록 건수가 달라진다.
      실제로 search 가 빠져 있어 `?search=조세&status=원안가결` 이 결과 0건인데
      탭에는 "원안가결 157" 로 표시됐다 (2026-08-15 수정).
   ⚠️ $4 의 조건식은 getList.sql 의 $1 조건과 **글자 그대로 같아야** 한다.
*/
SELECT
  COUNT(*)                                                                               AS total,
  COUNT(*) FILTER (WHERE b.proc_result_name IS NULL OR b.proc_result_name = '')          AS pending,
  COUNT(*) FILTER (WHERE b.proc_result_name = '원안가결')                                 AS passed_orig,
  COUNT(*) FILTER (WHERE b.proc_result_name = '수정가결')                                 AS passed_mod,
  COUNT(*) FILTER (WHERE b.proc_result_name = '대안반영폐기')                             AS alt_dropped,
  COUNT(*) FILTER (WHERE b.proc_result_name = '철회')                                     AS withdrawn,
  COUNT(*) FILTER (WHERE b.proc_result_name = '폐기')                                     AS dropped,
  COUNT(*) FILTER (WHERE b.proc_result_name = '부결')                                     AS rejected
  FROM bills b
  LEFT JOIN politicians p ON p.mona_cd = b.mona_cd
 WHERE ($1::text IS NULL OR b.committee = ANY(string_to_array($1, ',')))
   AND ($2::text IS NULL OR COALESCE(p.party_name, '기타/무소속') = ANY(string_to_array($2, ',')))
   AND ($3::text IS NULL OR b.bill_name = $3)
   AND ($4::text IS NULL OR b.bill_name ILIKE '%' || $4 || '%' OR b.proposer_name ILIKE '%' || $4 || '%' OR b.bill_no = $4)
