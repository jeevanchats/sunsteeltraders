-- =====================================================================
-- 029_founded_year.sql  -  Sun Steel Traders was founded in 2000 (confirmed for the site; the Google listing says "since 2000").
-- Admin > Settings > Year founded held 1999. Sets it to 2000 only while it is empty or still 1999, so a later edit in the admin stands.
-- Shown on the About page and as foundingDate in the business structured data. Safe to re-run.
-- =====================================================================
INSERT IGNORE INTO `SiteSettings` (`SettingKey`, `SettingValue`) VALUES ('FoundedYear', '2000');
UPDATE `SiteSettings` SET `SettingValue` = '2000'
 WHERE `SettingKey` = 'FoundedYear' AND (`SettingValue` IS NULL OR `SettingValue` IN ('', '1999'));

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '029_founded_year.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '029_founded_year.sql');
