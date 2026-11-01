-- =====================================================================
-- 020_customers.sql  -  Customer master. Quotations fill it in automatically (matched on phone number);
-- staff can also edit it, import it from a CSV file and export it.
--   Customers          one row per customer: name, company, GSTIN, phone, email, city, address, notes
--   Quotes.CustomerId  the master row a quotation was made for
-- Plain ASCII on purpose. Apply with:  mysql --default-character-set=utf8mb4 -u root -p sunsteel < this file
-- =====================================================================
CREATE TABLE IF NOT EXISTS `Customers` (
  `CustomerId` BIGINT       NOT NULL AUTO_INCREMENT,
  `Name`       VARCHAR(150) NOT NULL,
  `Company`    VARCHAR(150) NULL,
  `Gstin`      VARCHAR(15)  NULL,
  `Phone`      VARCHAR(20)  NOT NULL,
  `Email`      VARCHAR(256) NULL,
  `City`       VARCHAR(80)  NULL,
  `Address`    VARCHAR(400) NULL,
  `Notes`      VARCHAR(1000) NULL,
  `CreatedAt`  DATETIME     NOT NULL,
  `UpdatedAt`  DATETIME     NULL,
  PRIMARY KEY (`CustomerId`),
  UNIQUE KEY `UX_Customers_Phone` (`Phone`),
  KEY `IX_Customers_Name` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS `_m020_customers`;
DELIMITER //
CREATE PROCEDURE `_m020_customers`()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Quotes' AND COLUMN_NAME = 'CustomerId') THEN
    ALTER TABLE `Quotes` ADD COLUMN `CustomerId` BIGINT NULL AFTER `LeadId`;
  END IF;
END//
DELIMITER ;
CALL `_m020_customers`();
DROP PROCEDURE `_m020_customers`;

-- Customers from quotations already made: the latest quotation per phone number wins.
INSERT INTO `Customers` (`Name`, `Company`, `Gstin`, `Phone`, `Email`, `City`, `Address`, `CreatedAt`)
SELECT q.`CustomerName`, q.`Company`, q.`Gstin`, q.`Phone`, q.`Email`, q.`City`, q.`Address`, NOW()
FROM `Quotes` q
JOIN (SELECT `Phone`, MAX(`QuoteId`) AS `Last` FROM `Quotes` GROUP BY `Phone`) l ON l.`Last` = q.`QuoteId`
WHERE NOT EXISTS (SELECT 1 FROM `Customers` c WHERE c.`Phone` = q.`Phone`);

UPDATE `Quotes` q JOIN `Customers` c ON c.`Phone` = q.`Phone` SET q.`CustomerId` = c.`CustomerId` WHERE q.`CustomerId` IS NULL;

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '020_customers.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '020_customers.sql');
