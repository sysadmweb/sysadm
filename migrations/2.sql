  CREATE TABLE user_permissions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    page TEXT NOT NULL,
    can_view BOOLEAN DEFAULT TRUE,
    can_create BOOLEAN DEFAULT TRUE,
    can_update BOOLEAN DEFAULT TRUE,
    can_delete BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, page)
  );

  CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
  CREATE INDEX idx_user_permissions_page ON user_permissions(page);

  INSERT INTO user_permissions (user_id, page, can_view, can_create, can_update, can_delete, is_active)
SELECT 
  u.id,
  p.page,
  true, true, true, true, true
FROM users u
CROSS JOIN (VALUES 
    ('dashboard'),
    ('employees'),
    ('accommodations'),
    ('rooms'),
    ('functions'),
    ('units'),
    ('users')
) AS p(page)
WHERE COALESCE(u.is_super_user, false) = false
  AND COALESCE(u.is_active, true) = true;

  ALTER TABLE user_permissions
ALTER COLUMN id
ADD GENERATED ALWAYS AS IDENTITY;