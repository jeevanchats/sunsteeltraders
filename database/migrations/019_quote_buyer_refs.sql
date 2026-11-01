-- =====================================================================
-- 019_quote_buyer_refs.sql  -  Fields the customer's current quotation/invoice carries that ours lacked:
--   BuyerRef          the buyer's order or reference number ("Buyer's Ref./Order No.")
--   DispatchedThrough the lorry or transport it goes by ("Dispatched through")
--   QuoteBranchAddress (site setting) the branch office line printed in the header ("B/O")
-- Plain ASCII on purpose. Apply with:  mysql --default-character-set=utf8mb4 -u root -p sunsteel < this file
-- =====================================================================
DROP PROCEDURE IF EXISTS `_m019_quote_refs`;
DELIMITER //
CREATE PROCEDURE `_m019_quote_refs`()
BEGIN
  -- MySQL 8 has no ADD COLUMN IF NOT EXISTS: skip when it already ran.
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Quotes' AND COLUMN_NAME = 'BuyerRef') THEN
    ALTER TABLE `Quotes`
        ADD COLUMN `BuyerRef`          VARCHAR(60) NULL AFTER `Address`,
        ADD COLUMN `DispatchedThrough` VARCHAR(80) NULL AFTER `BuyerRef`;
  END IF;
END//
DELIMITER ;
CALL `_m019_quote_refs`();
DROP PROCEDURE `_m019_quote_refs`;

-- Branch office line for the quotation header. Enter it in Quote data; nothing is filled in here.
INSERT IGNORE INTO `SiteSettings` (`SettingKey`, `SettingValue`) VALUES ('QuoteBranchAddress', NULL);

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '019_quote_buyer_refs.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '019_quote_buyer_refs.sql');
