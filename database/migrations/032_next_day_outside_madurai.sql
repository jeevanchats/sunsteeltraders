-- =====================================================================
-- 032_next_day_outside_madurai.sql  -  Only Madurai is same-day delivery; every other city page and delivery lead time
-- becomes next day ("1 day"). Rows still on "Same day" change; any other value staff typed is left alone. The city intros
-- that promised same-day delivery are reworded the same way (exact phrases only, so edited text is untouched). Safe to re-run.
-- =====================================================================
UPDATE `Cities` SET `LeadTime` = '1 day' WHERE `Slug` <> 'madurai' AND `LeadTime` = 'Same day';
UPDATE `DeliveryLeadTimes` SET `LeadTime` = '1 day' WHERE `City` <> 'Madurai' AND `LeadTime` = 'Same day';

UPDATE `Cities` SET `Intro` = REPLACE(`Intro`, 'delivered the same day.', 'delivered next day.')
 WHERE `Slug` <> 'madurai' AND `Intro` LIKE '%delivered the same day.%';
UPDATE `Cities` SET `Intro` = REPLACE(`Intro`, 'send them down the same day.', 'send them down next day.')
 WHERE `Slug` <> 'madurai' AND `Intro` LIKE '%send them down the same day.%';
UPDATE `Cities` SET `Intro` = REPLACE(`Intro`, 'truck the same day.', 'truck next day.')
 WHERE `Slug` <> 'madurai' AND `Intro` LIKE '%truck the same day.%';

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '032_next_day_outside_madurai.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '032_next_day_outside_madurai.sql');
