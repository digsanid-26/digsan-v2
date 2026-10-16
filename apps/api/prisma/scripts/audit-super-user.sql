-- Audit of the `super_user` role (tasklist-perbaikan.md, F0-02).
--
-- Until this fix, super_user was granted to anyone who merely opened /tree
-- (including EARLY_ACCESS accounts), and the role bypassed tree ownership.
-- The bypass is closed in code; this script only REPORTS who holds the role.
-- Nothing here modifies data. Review the output, then decide manually.

-- 1. Holders of super_user, with account status and number of owned trees.
SELECT u.id,
       u.email,
       u.name,
       u.status,
       u.created_by_id IS NOT NULL                       AS is_managed_early_access,
       (SELECT count(*) FROM family_trees t WHERE t.user_id = u.id) AS owned_trees,
       ur.created_at                                      AS role_granted_at
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id AND r.name = 'super_user'
JOIN users u ON u.id = ur.user_id
ORDER BY u.status, ur.created_at;

-- 2. Holders that should not have received it automatically:
--    early-access accounts, or users who own no tree at all.
SELECT u.id, u.email, u.status,
       (SELECT count(*) FROM family_trees t WHERE t.user_id = u.id) AS owned_trees
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id AND r.name = 'super_user'
JOIN users u ON u.id = ur.user_id
WHERE u.status = 'EARLY_ACCESS'
   OR NOT EXISTS (SELECT 1 FROM family_trees t WHERE t.user_id = u.id);

-- 3. (Manual, after review) revoke for the rows from query 2, e.g.:
-- DELETE FROM user_roles ur
-- USING roles r, users u
-- WHERE ur.role_id = r.id AND r.name = 'super_user'
--   AND ur.user_id = u.id
--   AND (u.status = 'EARLY_ACCESS'
--        OR NOT EXISTS (SELECT 1 FROM family_trees t WHERE t.user_id = u.id));
