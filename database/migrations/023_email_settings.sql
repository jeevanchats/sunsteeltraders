-- =====================================================================
-- 023_email_settings.sql  -  Outgoing email (Brevo SMTP) for new-request alerts. Set up by a Super Admin in the admin under
-- "Email alerts"; nothing sends until the mode is switched from Mock to Live there.
--   EmailMode        Mock (written to the server log) | Live (really sent)
--   SmtpHost/Port    smtp-relay.brevo.com / 587
--   SmtpLogin/SmtpKey  from the Brevo account; the key is saved encrypted by the API and never shown again
--   EmailFromAddress   a sender verified in Brevo
--   EmailAlertTo       comma-separated addresses that receive each new request
-- Plain ASCII on purpose. Apply with:  mysql --default-character-set=utf8mb4 -u root -p sunsteel < this file
-- =====================================================================
INSERT IGNORE INTO `SiteSettings` (`SettingKey`, `SettingValue`) VALUES
 ('EmailMode',        'Mock'),
 ('SmtpHost',         'smtp-relay.brevo.com'),
 ('SmtpPort',         '587'),
 ('SmtpLogin',        NULL),
 ('SmtpKey',          NULL),
 ('EmailFromAddress', NULL),
 ('EmailFromName',    'Sun Steel Traders'),
 ('EmailAlertTo',     NULL);

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '023_email_settings.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '023_email_settings.sql');
