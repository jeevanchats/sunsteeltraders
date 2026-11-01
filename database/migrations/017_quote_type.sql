-- =====================================================================
-- 017_quote_type.sql  —  The four kinds of quotation the customer sells by:
--   Project   : pure trading, bought from a supplier and sent straight to the customer in bulk
--   Wholesale : bulk purchases, in tonnes
--   Retail    : small purchases, in kg
--   CutPieces : items that include a cutting operation at Sun Steel Traders
-- A tag with defaults (cutting extras for Cut Pieces, weight in tonnes for Wholesale); all four are priced per kg
-- as before. Existing quotations become Retail: staff can change the type on them.
-- =====================================================================
DROP PROCEDURE IF EXISTS `_m017_quote_type`;
DELIMITER //
CREATE PROCEDURE `_m017_quote_type`()
BEGIN
  -- MySQL 8 has no ADD COLUMN IF NOT EXISTS: skip when it already ran.
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Quotes' AND COLUMN_NAME = 'QuoteType') THEN
    ALTER TABLE `Quotes`
        ADD COLUMN `QuoteType` VARCHAR(12) NOT NULL DEFAULT 'Retail' AFTER `Status`,   -- Project | Wholesale | Retail | CutPieces
        ADD KEY `ix_quotes_type_created` (`QuoteType`, `CreatedAt`);
  END IF;
END//
DELIMITER ;
CALL `_m017_quote_type`();
DROP PROCEDURE `_m017_quote_type`;

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '017_quote_type.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '017_quote_type.sql');
