-- =====================================================================
-- 034_home_delivery_faq.sql  -  The home page FAQ "How fast can you deliver?" matches the delivery list: same day in
-- Madurai only, next day across south Tamil Nadu (no Trichy, Chennai or Hosur). Only the seeded answer is replaced, so
-- an answer staff have rewritten in the admin is left alone. Safe to re-run.
-- =====================================================================
UPDATE `Faqs`
   SET `Answer` = 'Same day within Madurai, and next day across south Tamil Nadu: Dindigul, Virudhunagar, Sivakasi, Tirunelveli, Tuticorin, Nagercoil and more.'
 WHERE `Scope` = 'page' AND `ScopeKey` = '' AND `Question` = 'How fast can you deliver?'
   AND `Answer` = 'Same day within Madurai, Virudhunagar and Sivakasi; one day to Tirunelveli, Tuticorin and Trichy; two to three days to Chennai and Hosur.';

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '034_home_delivery_faq.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '034_home_delivery_faq.sql');
