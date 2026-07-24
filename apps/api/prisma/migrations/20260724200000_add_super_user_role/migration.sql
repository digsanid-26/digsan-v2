-- Insert super_user role if it doesn't exist
INSERT INTO "roles" ("id", "name", "description", "permissions", "created_at", "updated_at")
SELECT gen_random_uuid(), 'super_user', 'Super user role', NULL, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "name" = 'super_user');
