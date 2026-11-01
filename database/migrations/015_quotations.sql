-- =====================================================================
-- 015_quotations.sql  —  Priced quotations for customers, made from a
-- web request (RFQ) or from scratch for phone and walk-in customers.
-- Lines are priced per kg (rate typed per quote, steel prices move daily);
-- cutting, loading, unloading, transport and discount apply to the whole
-- quote, then GST. Customer details are copied in so a quote never
-- changes when the request it came from is edited.
-- =====================================================================
CREATE TABLE IF NOT EXISTS `Quotes` (
    `QuoteId`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `Reference`       VARCHAR(20)  NOT NULL,                 -- SST-QT-0042
    `LeadId`          BIGINT UNSIGNED NULL,                  -- the request it answers, if any
    `Status`          VARCHAR(10)  NOT NULL DEFAULT 'Draft', -- Draft | Sent | Accepted | Rejected
    `QuoteDate`       DATE NOT NULL,
    `ValidDays`       INT NOT NULL DEFAULT 7,
    `CustomerName`    VARCHAR(150) NOT NULL,
    `Company`         VARCHAR(150) NULL,
    `Gstin`           VARCHAR(15)  NULL,
    `Phone`           VARCHAR(30)  NOT NULL,
    `Email`           VARCHAR(256) NULL,
    `City`            VARCHAR(80)  NULL,
    `Address`         VARCHAR(400) NULL,
    `CuttingCharge`   DECIMAL(12,2) NOT NULL DEFAULT 0,
    `LoadingCharge`   DECIMAL(12,2) NOT NULL DEFAULT 0,
    `UnloadingCharge` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `TransportCharge` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `Discount`        DECIMAL(12,2) NOT NULL DEFAULT 0,
    `GstRate`         DECIMAL(5,2)  NOT NULL DEFAULT 18.00,
    `InterState`      TINYINT(1) NOT NULL DEFAULT 0,         -- 1 = IGST, 0 = CGST + SGST
    `GrandTotal`      DECIMAL(14,2) NOT NULL DEFAULT 0,      -- stored for the list; recomputed on every save
    `Notes`           VARCHAR(2000) NULL,                    -- printed on the quote
    `Terms`           TEXT NULL,                             -- printed on the quote
    `CreatedBy`       BIGINT UNSIGNED NULL,
    `CreatedAt`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `UpdatedAt`       DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`QuoteId`),
    UNIQUE KEY `uq_quotes_reference` (`Reference`),
    KEY `ix_quotes_status_created` (`Status`, `CreatedAt`),
    KEY `ix_quotes_lead` (`LeadId`),
    CONSTRAINT `fk_quotes_lead`    FOREIGN KEY (`LeadId`)    REFERENCES `Leads` (`LeadId`) ON DELETE SET NULL,
    CONSTRAINT `fk_quotes_creator` FOREIGN KEY (`CreatedBy`) REFERENCES `Users` (`UserId`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QuoteItems` (
    `QuoteItemId`  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `QuoteId`      BIGINT UNSIGNED NOT NULL,
    `Description`  VARCHAR(200) NOT NULL,                    -- 'EN24 round bar'
    `Size`         VARCHAR(120) NULL,                        -- 'Ø80 × 500 mm, cut to size'
    `Quantity`     INT NOT NULL DEFAULT 1,
    `Kg`           DECIMAL(12,2) NOT NULL,
    `RatePerKg`    DECIMAL(10,2) NOT NULL,
    `DisplayOrder` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`QuoteItemId`),
    KEY `ix_quoteitems_quote` (`QuoteId`),
    CONSTRAINT `fk_quoteitems_quote` FOREIGN KEY (`QuoteId`) REFERENCES `Quotes` (`QuoteId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Defaults for new quotes; editable in Site settings. TO CONFIRM with the owner.
INSERT IGNORE INTO `SiteSettings` (`SettingKey`, `SettingValue`) VALUES
 ('QuoteValidDays', '7'),
 ('QuoteGstRate',   '18'),
 ('QuoteTerms',     '1. Prices are per kg, ex-godown Madurai, and valid for the days shown above.\n2. Weights are theoretical; billing is on actual weight.\n3. Payment: 100% before dispatch unless agreed in writing.\n4. Goods once cut to size cannot be returned.\n5. Subject to Madurai jurisdiction.');

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '015_quotations.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '015_quotations.sql');
