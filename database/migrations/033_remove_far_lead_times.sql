-- =====================================================================
-- 033_remove_far_lead_times.sql  -  The delivery list on the home page shows south Tamil Nadu only: Trichy, Coimbatore,
-- Salem, Chennai and Hosur are removed. deploy.sh re-runs every migration, so the delete runs only the first time
-- (guarded by __schema_migrations); a city staff add back later is never removed again. Safe to re-run.
-- =====================================================================
DROP PROCEDURE IF EXISTS `_m033_remove_far_lead_times`;
DELIMITER //
CREATE PROCEDURE `_m033_remove_far_lead_times`()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '033_remove_far_lead_times.sql') THEN
    DELETE FROM `DeliveryLeadTimes` WHERE `City` IN ('Trichy', 'Coimbatore', 'Salem', 'Chennai', 'Hosur');
  END IF;
END//
DELIMITER ;
CALL `_m033_remove_far_lead_times`();
DROP PROCEDURE `_m033_remove_far_lead_times`;

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '033_remove_far_lead_times.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '033_remove_far_lead_times.sql');
