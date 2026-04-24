SELECT
  bill_id,
  summary,
  category,
  reading_time_min,
  changes,
  affected,
  issues,
  context,
  limitations,
  judgment_questions,
  model,
  prompt_version,
  analyzed_at,
  needs_review,
  review_status,
  updated_at
FROM bill_ai_analysis
WHERE bill_id = $1
LIMIT 1;
