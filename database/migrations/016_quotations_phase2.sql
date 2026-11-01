-- =====================================================================
-- 016_quotations_phase2.sql  —  Quotation lines that carry their own weight
-- calculation, GST rate and HSN code; manual and tool lines; product master;
-- MS pipe schedule table; payment terms and bank details on the quote.
--
-- Line types (ItemType): Calculated = weight from material, shape, size, length and
-- pieces; ManualWeight = quantity × weight per unit × rate per kg; ManualUnit =
-- quantity × unit price (tools, goods sold by count). Existing 015 lines become
-- ManualWeight lines (they were typed kg × rate) and keep their totals.
-- The GST rate is frozen on each line when the quote is saved.
-- =====================================================================
DROP PROCEDURE IF EXISTS `_m016_quote_columns`;
DELIMITER //
CREATE PROCEDURE `_m016_quote_columns`()
BEGIN
  -- MySQL 8 has no ADD COLUMN IF NOT EXISTS: skip the whole block when it already ran.
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QuoteItems' AND COLUMN_NAME = 'ItemType') THEN
    ALTER TABLE `Quotes`
        ADD COLUMN `PaymentTerms` VARCHAR(200) NULL AFTER `Notes`,
        ADD COLUMN `BankDetails`  VARCHAR(600) NULL AFTER `PaymentTerms`;

    ALTER TABLE `QuoteItems`
        ADD COLUMN `ItemType`      VARCHAR(12)  NOT NULL DEFAULT 'ManualWeight' AFTER `QuoteId`,
        ADD COLUMN `Brand`         VARCHAR(100) NULL AFTER `ItemType`,
        ADD COLUMN `Model`         VARCHAR(80)  NULL AFTER `Size`,
        ADD COLUMN `Unit`          VARCHAR(10)  NOT NULL DEFAULT 'nos' AFTER `Quantity`,
        ADD COLUMN `Hsn`           VARCHAR(12)  NULL AFTER `Unit`,
        ADD COLUMN `GstCategory`   VARCHAR(10)  NOT NULL DEFAULT 'Raw' AFTER `Hsn`,   -- Raw | Finished
        ADD COLUMN `GstRate`       DECIMAL(5,2) NOT NULL DEFAULT 18.00 AFTER `GstCategory`,
        ADD COLUMN `Remarks`       VARCHAR(300) NULL AFTER `GstRate`,
        ADD COLUMN `MaterialKey`   VARCHAR(20)  NULL AFTER `Remarks`,                 -- Calculated lines
        ADD COLUMN `Form`          VARCHAR(12)  NULL AFTER `MaterialKey`,             -- round, ..., sspipe, mspipe
        ADD COLUMN `DimsJson`      JSON NULL AFTER `Form`,
        ADD COLUMN `LengthMm`      DECIMAL(10,1) NULL AFTER `DimsJson`,
        ADD COLUMN `PieceKg`       DECIMAL(12,4) NULL AFTER `LengthMm`,
        ADD COLUMN `WeightPerUnit` DECIMAL(12,3) NULL AFTER `PieceKg`,                -- ManualWeight lines
        ADD COLUMN `UnitPrice`     DECIMAL(10,2) NULL AFTER `RatePerKg`;              -- ManualUnit lines

    -- Lines from 015 keep their old totals: they were typed as kg x rate.
    UPDATE `QuoteItems` qi JOIN `Quotes` q ON q.QuoteId = qi.QuoteId
       SET qi.GstRate = q.GstRate, qi.WeightPerUnit = CASE WHEN qi.Quantity > 0 THEN ROUND(qi.Kg / qi.Quantity, 3) END;

    -- A by-unit line has no weight.
    ALTER TABLE `QuoteItems` MODIFY COLUMN `Kg` DECIMAL(12,2) NOT NULL DEFAULT 0;
  END IF;
END//
DELIMITER ;
CALL `_m016_quote_columns`();
DROP PROCEDURE `_m016_quote_columns`;

-- Products the customer sells by brand or by piece (branded pipes, roof sheets, tools).
CREATE TABLE IF NOT EXISTS `QuoteProducts` (
    `QuoteProductId` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `ItemType`       VARCHAR(12)  NOT NULL DEFAULT 'ManualUnit',  -- ManualWeight | ManualUnit
    `GstCategory`    VARCHAR(10)  NOT NULL DEFAULT 'Finished',    -- Raw | Finished
    `Brand`          VARCHAR(100) NULL,
    `Description`    VARCHAR(200) NOT NULL,
    `Size`           VARCHAR(120) NULL,
    `Model`          VARCHAR(80)  NULL,
    `Unit`           VARCHAR(10)  NOT NULL DEFAULT 'nos',
    `WeightPerUnit`  DECIMAL(12,3) NULL,
    `Hsn`            VARCHAR(12)  NULL,
    `GstRate`        DECIMAL(5,2) NULL,                           -- own rate; blank = the category default
    `ReferenceRate`  DECIMAL(10,2) NULL,                          -- suggestion only; the price is typed per quote
    `IsActive`       TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (`QuoteProductId`),
    KEY `ix_quoteproducts_desc` (`Description`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- HSN code for calculated lines: shape + material; a blank material covers every material of that shape.
CREATE TABLE IF NOT EXISTS `QuoteHsn` (
    `QuoteHsnId`  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `Form`        VARCHAR(12) NOT NULL,
    `MaterialKey` VARCHAR(20) NOT NULL DEFAULT '',
    `Hsn`         VARCHAR(12) NOT NULL,
    PRIMARY KEY (`QuoteHsnId`),
    UNIQUE KEY `uq_quotehsn` (`Form`, `MaterialKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Wall thickness per nominal size and schedule (ASME B36.10M, IS 1239). SAMPLE ROWS ONLY:
-- the full table must be entered and checked against the standard before the MS pipe calculator is used.
CREATE TABLE IF NOT EXISTS `MsPipeSchedule` (
    `MsPipeScheduleId` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `NominalSize`      VARCHAR(20)  NOT NULL,        -- '2 in.'
    `OdMm`             DECIMAL(7,2) NOT NULL,
    `Schedule`         VARCHAR(12)  NOT NULL,        -- SCH 40, STD, XS, Light, Medium, Heavy ...
    `WallMm`           DECIMAL(6,2) NOT NULL,
    `DisplayOrder`     INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`MsPipeScheduleId`),
    UNIQUE KEY `uq_mspipe` (`NominalSize`, `Schedule`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `MsPipeSchedule` (`NominalSize`, `OdMm`, `Schedule`, `WallMm`, `DisplayOrder`) VALUES
 ('1/2 in.', 21.30, 'SCH 40', 2.77, 10), ('1/2 in.', 21.30, 'SCH 80', 3.73, 10),
 ('1 in.',   33.40, 'SCH 40', 3.38, 20), ('1 in.',   33.40, 'SCH 80', 4.55, 20),
 ('2 in.',   60.30, 'SCH 40', 3.91, 30), ('2 in.',   60.30, 'SCH 80', 5.54, 30),
 ('4 in.',  114.30, 'SCH 40', 6.02, 40), ('4 in.',  114.30, 'SCH 80', 8.56, 40),
 ('6 in.',  168.30, 'SCH 40', 7.11, 50), ('6 in.',  168.30, 'SCH 80', 10.97, 50);

-- Defaults. The finished-product GST rate, bank details and HSN codes are NOT assumed: the customer supplies them.
INSERT IGNORE INTO `SiteSettings` (`SettingKey`, `SettingValue`) VALUES
 ('QuoteGstFinished',   NULL),   -- GST % for finished products (tools, roof sheets). TO CONFIRM
 ('QuoteBankDetails',   NULL),   -- printed on every quote when set
 ('QuotePaymentTerms',  NULL),
 ('QuoteWeightDecimals', '1');

-- QuoteGstRate (015) now means the raw-material default and the rate on cutting/loading/freight. TO CONFIRM.
-- Move 015's placeholder defaults to the blueprint's wording, only where nobody has edited them.
UPDATE `SiteSettings` SET `SettingValue` = '3' WHERE `SettingKey` = 'QuoteValidDays' AND `SettingValue` = '7';
UPDATE `SiteSettings`
   SET `SettingValue` = '1. Quotation valid for {days} days from the date above, because metal prices move daily.\n2. Prices are ex-godown Madurai plus GST.\n3. Weights are theoretical; the invoice uses the actual weighed or mill weight, which can vary by ±2–3%.\n4. Cut lengths are held to ±1 mm on the band saw.\n5. Mill test certificates available on request.\n6. Delivery time as agreed at order confirmation.\n7. Subject to Madurai jurisdiction.'
 WHERE `SettingKey` = 'QuoteTerms'
   AND `SettingValue` = '1. Prices are per kg, ex-godown Madurai, and valid for the days shown above.\n2. Weights are theoretical; billing is on actual weight.\n3. Payment: 100% before dispatch unless agreed in writing.\n4. Goods once cut to size cannot be returned.\n5. Subject to Madurai jurisdiction.';

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '016_quotations_phase2.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '016_quotations_phase2.sql');
