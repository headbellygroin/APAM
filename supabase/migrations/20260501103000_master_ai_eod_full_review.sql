/*
  # Master AI — persist full end-of-day review payload

  Adds `full_review` so the Master AI UI can restore the same review across sessions.
  Adds a unique constraint on (user_id, review_date) so reviews can be upserted idempotently.
*/

ALTER TABLE master_ai_eod_reviews
  ADD COLUMN IF NOT EXISTS full_review jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS master_ai_eod_reviews_user_review_date
  ON master_ai_eod_reviews (user_id, review_date);
