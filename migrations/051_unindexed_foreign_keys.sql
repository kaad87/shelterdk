-- migrations/051_unindexed_foreign_keys.sql
-- Adds covering indexes for foreign keys flagged by Supabase's performance advisor
-- (lint 0001_unindexed_foreign_keys). Unindexed FKs force sequential scans on joins
-- and on `.eq(<fk_col>, …)` lookups — a contributor to the statement-timeout storm,
-- notably google_place_reviews.google_place_id (behind the getReviews query) and
-- bookable_shelters.shelter_id (behind the booking/detail joins).
--
-- All target tables are small, so these build effectively instantly. Indexes never
-- change query results — pure performance, zero behavioural risk.

CREATE INDEX IF NOT EXISTS idx_admin_impersonations_target_shelter_id ON public.admin_impersonations (target_shelter_id);
CREATE INDEX IF NOT EXISTS idx_bookable_shelters_shelter_id ON public.bookable_shelters (shelter_id);
CREATE INDEX IF NOT EXISTS idx_booking_action_tokens_booking_id ON public.booking_action_tokens (booking_id);
CREATE INDEX IF NOT EXISTS idx_buying_guide_entries_affiliate_product_id ON public.buying_guide_entries (affiliate_product_id);
CREATE INDEX IF NOT EXISTS idx_google_place_reviews_google_place_id ON public.google_place_reviews (google_place_id);
CREATE INDEX IF NOT EXISTS idx_owner_payouts_shelter_id ON public.owner_payouts (shelter_id);
CREATE INDEX IF NOT EXISTS idx_shelter_comments_source_submission_id ON public.shelter_comments (source_submission_id);
CREATE INDEX IF NOT EXISTS idx_shelter_photo_submissions_shelter_id ON public.shelter_photo_submissions (shelter_id);
CREATE INDEX IF NOT EXISTS idx_shelter_submissions_shelter_id ON public.shelter_submissions (shelter_id);
CREATE INDEX IF NOT EXISTS idx_shelters_google_place_id ON public.shelters (google_place_id);
CREATE INDEX IF NOT EXISTS idx_stay_guide_entries_nature_stay_id ON public.stay_guide_entries (nature_stay_id);
CREATE INDEX IF NOT EXISTS idx_trip_posts_shelter_id ON public.trip_posts (shelter_id);
