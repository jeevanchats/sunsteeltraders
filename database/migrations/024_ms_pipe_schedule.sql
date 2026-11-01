-- =====================================================================
-- 024_ms_pipe_schedule.sql  -  The standard carbon-steel pipe schedule (ASME B36.10M, as used for ASTM A106 / A53 pipe), NPS 1/2 to 12,
-- so the public weight calculator and the quotation tool can price MS pipe by schedule (SCH 10 ... SCH 160, STD, XS, XXS).
--   NominalSize  '2 in.'      OdMm  outside diameter, mm      Schedule  'SCH 40'      WallMm  wall thickness, mm
-- Only added when the table still holds just the 10 sample rows from migration 016: a schedule the owner has already replaced or
-- edited in Quote data is left alone. Rows already present keep their values; only their display order is set.
-- Check the figures against your supplier's pipe chart; they can be edited any time in Quote data > MS pipe schedule.
-- Plain ASCII on purpose. Apply with:  mysql --default-character-set=utf8mb4 -u root -p sunsteel < this file
-- =====================================================================
DROP PROCEDURE IF EXISTS `_m024_pipes`;
DELIMITER //
CREATE PROCEDURE `_m024_pipes`()
BEGIN
  IF (SELECT COUNT(*) FROM `MsPipeSchedule`) <= 10 THEN
    INSERT INTO `MsPipeSchedule` (`NominalSize`, `OdMm`, `Schedule`, `WallMm`, `DisplayOrder`) VALUES
     ('1/2 in.',     21.30, 'SCH 10',  2.11,  10), ('1/2 in.',     21.30, 'SCH 40',  2.77,  10), ('1/2 in.',     21.30, 'SCH 80',  3.73,  10), ('1/2 in.',     21.30, 'SCH 160',  4.78,  10), ('1/2 in.',     21.30, 'XXS',  7.47,  10),
     ('3/4 in.',     26.70, 'SCH 10',  2.11,  20), ('3/4 in.',     26.70, 'SCH 40',  2.87,  20), ('3/4 in.',     26.70, 'SCH 80',  3.91,  20), ('3/4 in.',     26.70, 'SCH 160',  5.56,  20), ('3/4 in.',     26.70, 'XXS',  7.82,  20),
     ('1 in.',       33.40, 'SCH 10',  2.77,  30), ('1 in.',       33.40, 'SCH 40',  3.38,  30), ('1 in.',       33.40, 'SCH 80',  4.55,  30), ('1 in.',       33.40, 'SCH 160',  6.35,  30), ('1 in.',       33.40, 'XXS',  9.09,  30),
     ('1 1/4 in.',   42.20, 'SCH 10',  2.77,  40), ('1 1/4 in.',   42.20, 'SCH 40',  3.56,  40), ('1 1/4 in.',   42.20, 'SCH 80',  4.85,  40), ('1 1/4 in.',   42.20, 'SCH 160',  6.35,  40), ('1 1/4 in.',   42.20, 'XXS',  9.70,  40),
     ('1 1/2 in.',   48.30, 'SCH 10',  2.77,  50), ('1 1/2 in.',   48.30, 'SCH 40',  3.68,  50), ('1 1/2 in.',   48.30, 'SCH 80',  5.08,  50), ('1 1/2 in.',   48.30, 'SCH 160',  7.14,  50), ('1 1/2 in.',   48.30, 'XXS', 10.15,  50),
     ('2 in.',       60.30, 'SCH 10',  2.77,  60), ('2 in.',       60.30, 'SCH 40',  3.91,  60), ('2 in.',       60.30, 'SCH 80',  5.54,  60), ('2 in.',       60.30, 'SCH 160',  8.74,  60), ('2 in.',       60.30, 'XXS', 11.07,  60),
     ('2 1/2 in.',   73.00, 'SCH 10',  3.05,  70), ('2 1/2 in.',   73.00, 'SCH 40',  5.16,  70), ('2 1/2 in.',   73.00, 'SCH 80',  7.01,  70), ('2 1/2 in.',   73.00, 'SCH 160',  9.53,  70), ('2 1/2 in.',   73.00, 'XXS', 14.02,  70),
     ('3 in.',       88.90, 'SCH 10',  3.05,  80), ('3 in.',       88.90, 'SCH 40',  5.49,  80), ('3 in.',       88.90, 'SCH 80',  7.62,  80), ('3 in.',       88.90, 'SCH 160', 11.13,  80), ('3 in.',       88.90, 'XXS', 15.24,  80),
     ('4 in.',      114.30, 'SCH 10',  3.05,  90), ('4 in.',      114.30, 'SCH 40',  6.02,  90), ('4 in.',      114.30, 'SCH 80',  8.56,  90), ('4 in.',      114.30, 'SCH 120', 11.13,  90), ('4 in.',      114.30, 'SCH 160', 13.49,  90), ('4 in.',      114.30, 'XXS', 17.12,  90),
     ('5 in.',      141.30, 'SCH 10',  3.40, 100), ('5 in.',      141.30, 'SCH 40',  6.55, 100), ('5 in.',      141.30, 'SCH 80',  9.53, 100), ('5 in.',      141.30, 'SCH 120', 12.70, 100), ('5 in.',      141.30, 'SCH 160', 15.88, 100), ('5 in.',      141.30, 'XXS', 19.05, 100),
     ('6 in.',      168.30, 'SCH 10',  3.40, 110), ('6 in.',      168.30, 'SCH 40',  7.11, 110), ('6 in.',      168.30, 'SCH 80', 10.97, 110), ('6 in.',      168.30, 'SCH 120', 14.27, 110), ('6 in.',      168.30, 'SCH 160', 18.26, 110), ('6 in.',      168.30, 'XXS', 21.95, 110),
     ('8 in.',      219.10, 'SCH 10',  3.76, 120), ('8 in.',      219.10, 'SCH 20',  6.35, 120), ('8 in.',      219.10, 'SCH 30',  7.04, 120), ('8 in.',      219.10, 'SCH 40',  8.18, 120), ('8 in.',      219.10, 'SCH 60', 10.31, 120), ('8 in.',      219.10, 'SCH 80', 12.70, 120),
     ('8 in.',      219.10, 'SCH 100', 15.09, 120), ('8 in.',      219.10, 'SCH 120', 18.26, 120), ('8 in.',      219.10, 'SCH 140', 20.62, 120), ('8 in.',      219.10, 'SCH 160', 23.01, 120), ('8 in.',      219.10, 'XXS', 22.23, 120),
     ('10 in.',     273.10, 'SCH 10',  4.19, 130), ('10 in.',     273.10, 'SCH 20',  6.35, 130), ('10 in.',     273.10, 'SCH 30',  7.80, 130), ('10 in.',     273.10, 'SCH 40',  9.27, 130), ('10 in.',     273.10, 'SCH 60', 12.70, 130), ('10 in.',     273.10, 'SCH 80', 15.09, 130),
     ('10 in.',     273.10, 'SCH 100', 18.26, 130), ('10 in.',     273.10, 'SCH 120', 21.44, 130), ('10 in.',     273.10, 'SCH 140', 25.40, 130), ('10 in.',     273.10, 'SCH 160', 28.58, 130),
     ('12 in.',     323.90, 'SCH 10',  4.57, 140), ('12 in.',     323.90, 'SCH 20',  6.35, 140), ('12 in.',     323.90, 'SCH 30',  8.38, 140), ('12 in.',     323.90, 'STD',  9.53, 140), ('12 in.',     323.90, 'SCH 40', 10.31, 140), ('12 in.',     323.90, 'XS', 12.70, 140),
     ('12 in.',     323.90, 'SCH 60', 14.27, 140), ('12 in.',     323.90, 'SCH 80', 17.48, 140), ('12 in.',     323.90, 'SCH 100', 21.44, 140), ('12 in.',     323.90, 'SCH 120', 25.40, 140), ('12 in.',     323.90, 'SCH 140', 28.58, 140), ('12 in.',     323.90, 'SCH 160', 33.32, 140)
    ON DUPLICATE KEY UPDATE `DisplayOrder` = VALUES(`DisplayOrder`);
  END IF;
END//
DELIMITER ;
CALL `_m024_pipes`();
DROP PROCEDURE `_m024_pipes`;

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '024_ms_pipe_schedule.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '024_ms_pipe_schedule.sql');
