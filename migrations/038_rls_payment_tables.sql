-- Enable RLS on payment tables
-- Only service_role (server-side) can read/write — no public access
ALTER TABLE booking_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_payouts    ENABLE ROW LEVEL SECURITY;

-- No policies = only service_role bypasses RLS (default Supabase behaviour)
-- Guests and owners never access these tables directly via client SDK
