-- Add EARLY_ACCESS to UserStatus enum
-- This allows super_user to create temporary login credentials for non-active nodes
-- so someone can login and fill profile data without full account verification

ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'EARLY_ACCESS';
