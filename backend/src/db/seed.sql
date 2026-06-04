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

-- ── MEN'S CLOTHING CATEGORIES (clean-slate) ─────────────────
-- Delete old categories to prevent duplicates (no products reference these yet in a fresh seed)
DELETE FROM categories;

INSERT INTO categories (name, description) VALUES
  ('Shirts',         'T-shirts, dress shirts, polo shirts, and casual button-ups for men'),
  ('Trousers',       'Jeans, chinos, dress slacks, cargo pants, and all trouser styles for men'),
  ('Suits',          'Full suits, blazers, sport coats, and formal jacket-trouser sets for men'),
  ('Jackets',        'Coats, denim jackets, windbreakers, hoodies, and outerwear for men'),
  ('Sweaters',       'Pullovers, cardigans, turtlenecks, and knitwear for men'),
  ('Shorts',         'Casual shorts, chino shorts, athletic shorts, and swim trunks for men'),
  ('Sportswear',     'Athletic wear, tracksuits, gym wear, and performance clothing for men'),
  ('Underwear',      'Boxers, briefs, undershirts, and men''s innerwear'),
  ('Shoes',          'Sneakers, dress shoes, loafers, boots, and sandals for men (EU sizing)'),
  ('Neck Ties',      'Neckties, bow ties, and cravats for men — one size fits all'),
  ('Belts',          'Leather belts, fabric belts, and fashion belts for men'),
  ('Socks',          'Ankle socks, dress socks, sport socks, and compression socks for men'),
  ('Hats & Caps',    'Fedoras, baseball caps, beanies, and head accessories for men'),
  ('Scarves',        'Winter scarves, silk scarves, and neckerchiefs for men'),
  ('Wallets',        'Leather wallets, card holders, and money clips for men'),
  ('Watches',        'Wrist watches and smart watches for men'),
  ('Sunglasses',     'Aviator, wayfarer, sport, and fashion sunglasses for men'),
  ('Cufflinks',      'Dress cufflinks and tie bars for formal wear'),
  ('Vests',          'Formal waistcoats, puffer vests, and casual vests for men');

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
