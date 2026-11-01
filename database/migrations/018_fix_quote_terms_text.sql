-- =====================================================================
-- 018_fix_quote_terms_text.sql  -  Repairs the default quotation terms seeded by 016.
-- 016 contained the characters "plus-or-minus" and "en dash". The mysql command-line client on Windows reads script
-- files in the console code page unless told otherwise, so those characters were stored as garbage. This script is
-- plain ASCII on purpose, and only rewrites the terms when they still start and end like the 016 text and do not
-- already hold the fixed wording, so terms the owner has rewritten are left alone.
-- Apply scripts with:  mysql --default-character-set=utf8mb4 -u root -p sunsteel < script.sql
-- =====================================================================
UPDATE `SiteSettings`
   SET `SettingValue` = '1. Quotation valid for {days} days from the date above, because metal prices move daily.\n2. Prices are ex-godown Madurai plus GST.\n3. Weights are theoretical; the invoice uses the actual weighed or mill weight, which can vary by +/-2-3%.\n4. Cut lengths are held to +/-1 mm on the band saw.\n5. Mill test certificates available on request.\n6. Delivery time as agreed at order confirmation.\n7. Subject to Madurai jurisdiction.'
 WHERE `SettingKey` = 'QuoteTerms'
   AND `SettingValue` LIKE '1. Quotation valid for {days} days from the date above%'
   AND `SettingValue` LIKE '%7. Subject to Madurai jurisdiction.'
   AND `SettingValue` NOT LIKE '%+/-2-3%';

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '018_fix_quote_terms_text.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '018_fix_quote_terms_text.sql');
