-- KilimoSync — marketplace category taxonomy.
-- These are structural taxonomy rows, not sample listings — safe to ship
-- to production. No fake products, farmers, or orders are ever seeded.

insert into public.categories (name, slug, description, icon) values
  ('Vegetables', 'vegetables', 'Fresh leafy greens, tomatoes, onions and more', 'leaf'),
  ('Fruits', 'fruits', 'Seasonal and tropical fruits', 'apple'),
  ('Grains & Cereals', 'grains-cereals', 'Maize, rice, wheat and millet', 'wheat'),
  ('Tubers & Roots', 'tubers-roots', 'Potatoes, sweet potatoes, cassava and arrowroot', 'carrot'),
  ('Legumes', 'legumes', 'Beans, peas, groundnuts and lentils', 'bean'),
  ('Dairy & Eggs', 'dairy-eggs', 'Milk, eggs and dairy produce', 'egg'),
  ('Poultry & Livestock', 'poultry-livestock', 'Chicken, goats and other livestock produce', 'bird'),
  ('Herbs & Spices', 'herbs-spices', 'Fresh herbs, chili and spices', 'sparkles')
on conflict (slug) do nothing;
