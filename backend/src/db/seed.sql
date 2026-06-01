-- ============================================================
-- ClothTrack — Seed Data
-- Run: psql -U postgres -d clothtrack -f src/db/seed.sql
-- Default owner login: username=admin  password=admin123
-- ============================================================

-- ── DEFAULT OWNER ACCOUNT ────────────────────────────────────
-- password_hash is bcrypt of 'admin123' (cost 10)
INSERT INTO users (full_name, username, password_hash, role, is_active)
VALUES (
  'Admin Owner',
  'admin',
  '$2a$10$4huifd5GYbV/AxqrJIzBYOZrg4TmL5tk83qIfn3ckl3TXyb3btuee',
  'owner',
  TRUE
)
ON CONFLICT (username) DO NOTHING;

-- ── SAMPLE CATEGORIES ────────────────────────────────────────
INSERT INTO categories (name, description) VALUES
  ('Shirts',    'All types of shirts including T-shirts, dress shirts, and polos'),
  ('Trousers',  'Jeans, chinos, slacks, and all trouser styles'),
  ('Dresses',   'Casual and formal dresses for women'),
  ('Jackets',   'Coats, denim jackets, blazers, and outerwear'),
  ('Shoes',     'Footwear including sneakers, heels, and sandals'),
  ('Accessories','Belts, scarves, hats, and bags')
ON CONFLICT DO NOTHING;

-- ── SAMPLE SUPPLIERS ─────────────────────────────────────────
INSERT INTO suppliers (name, phone, email, address, notes) VALUES
  (
    'Addis Textile PLC',
    '+251911234567',
    'orders@addistextile.com',
    'Bole Road, Addis Ababa, Ethiopia',
    'Primary local fabric supplier. Delivers within 2–3 business days.'
  ),
  (
    'Global Fashion Imports',
    '+251922345678',
    'supply@globalfashion.et',
    'Megenagna, Addis Ababa, Ethiopia',
    'Imports branded clothing. Minimum order: 50 units per style.'
  ),
  (
    'Hawassa Industrial Park',
    '+251933456789',
    'sales@hawassapark.et',
    'Hawassa Industrial Park, SNNPR, Ethiopia',
    'Bulk jeans and casual wear. Monthly delivery schedule.'
  )
ON CONFLICT DO NOTHING;
