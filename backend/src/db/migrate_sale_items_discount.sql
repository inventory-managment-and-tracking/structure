-- Add discount flag to sale line items (safe to re-run)
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS is_discounted BOOLEAN NOT NULL DEFAULT FALSE;
