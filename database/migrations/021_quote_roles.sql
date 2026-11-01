-- =====================================================================
-- 021_quote_roles.sql  -  Who can do what once quotations exist.
--   Super Admin  everything (site details, content, theme, staff users, and quote data)
--   Manager      Dashboard, Requests, Quotations, Customers, Quote data, and may CHANGE quote data (GST, HSN, pipe schedule, terms, bank)
--   Staff        Dashboard, Requests, Quotations, Customers, and view Quote data (the former "Sales" role, renamed)
-- New permission quote.data = change GST rates, HSN codes, the MS pipe schedule, payment terms and bank details.
-- Manager loses catalogue, stock, media, content and theme; Staff loses stock. Users keep their roles; only what the roles allow changes.
-- Plain ASCII on purpose. Re-runnable. Apply with:  mysql --default-character-set=utf8mb4 -u root -p sunsteel < this file
-- =====================================================================
INSERT IGNORE INTO `Permissions` (`Code`, `Name`, `Module`) VALUES
 ('quote.data', 'Change GST, HSN, pipe schedule, terms and bank details', 'Quotations');

-- The Sales role becomes Staff.
UPDATE `Roles` SET `Name` = 'Staff', `NormalizedName` = 'STAFF'
 WHERE `NormalizedName` = 'SALES' AND NOT EXISTS (SELECT 1 FROM (SELECT 1 FROM `Roles` WHERE `NormalizedName` = 'STAFF') x);

UPDATE `Roles` SET `Description` = 'Dashboard, requests, quotations, customers and quote data (view)' WHERE `NormalizedName` = 'STAFF';
UPDATE `Roles` SET `Description` = 'Dashboard, requests, quotations, customers and quote data (can change GST, HSN, terms and bank)' WHERE `NormalizedName` = 'MANAGER';

-- Everything the roles may do, stated in full so a re-run leaves the same result.
DELETE rp FROM `RolePermissions` rp
  JOIN `Roles` r ON r.`RoleId` = rp.`RoleId`
 WHERE r.`NormalizedName` IN ('MANAGER', 'STAFF');

INSERT IGNORE INTO `RolePermissions` (`RoleId`, `PermissionId`)
SELECT r.`RoleId`, p.`PermissionId` FROM `Roles` r JOIN `Permissions` p
 WHERE r.`NormalizedName` = 'SUPER ADMIN';

INSERT IGNORE INTO `RolePermissions` (`RoleId`, `PermissionId`)
SELECT r.`RoleId`, p.`PermissionId` FROM `Roles` r JOIN `Permissions` p
 WHERE r.`NormalizedName` = 'MANAGER' AND p.`Code` IN ('lead.manage', 'quote.data');

INSERT IGNORE INTO `RolePermissions` (`RoleId`, `PermissionId`)
SELECT r.`RoleId`, p.`PermissionId` FROM `Roles` r JOIN `Permissions` p
 WHERE r.`NormalizedName` = 'STAFF' AND p.`Code` IN ('lead.manage');

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '021_quote_roles.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '021_quote_roles.sql');
