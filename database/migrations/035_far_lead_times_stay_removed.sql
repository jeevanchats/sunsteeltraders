-- =====================================================================
-- 035_far_lead_times_stay_removed.sql  -  Keeps Trichy, Coimbatore, Salem, Chennai and Hosur out of the delivery list.
-- 033 deleted them once, but deploy.sh re-runs every migration and 010_catalog_seed.sql re-inserts them (INSERT IGNORE),
-- so this delete runs on every deploy, after 010. The admin has no delivery-list editor; to bring a city back, remove it
-- from this list. Safe to re-run.
-- =====================================================================
DELETE FROM `DeliveryLeadTimes` WHERE `City` IN ('Trichy', 'Coimbatore', 'Salem', 'Chennai', 'Hosur');

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '035_far_lead_times_stay_removed.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '035_far_lead_times_stay_removed.sql');
