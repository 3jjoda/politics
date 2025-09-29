/* 법안 목록 */
SELECT id
     , bill_id
     , name
     , summary
     , mona_cd
     , proposer_name
     , propose_date
     , committee_name
     , proc_result_cd
     , proc_result_text
     , proc_date
     , original_link
     , view_count
     , created_at
     , updated_at
  FROM bills 