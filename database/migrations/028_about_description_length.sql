-- =====================================================================
-- 028_about_description_length.sql  -  The About page description was 161 characters, one past what Google shows (about 155-160).
-- Only changes a row that still has the text 025 wrote, so a description staff edit in the admin is left alone. Safe to re-run.
-- =====================================================================
UPDATE `Pages` SET `MetaDescription` = 'Three godowns in Madurai (Aarapalayam, New Jail Road, Vilangudi) with band-saw cutting and crane loading. Steel and metals for South India''s workshops.'
 WHERE `Slug` = 'about-us' AND `MetaDescription` = 'Three godowns in Madurai (Aarapalayam, New Jail Road, Vilangudi), with band-saw cutting and overhead crane loading. Steel and metals for South India''s workshops.';

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '028_about_description_length.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '028_about_description_length.sql');
