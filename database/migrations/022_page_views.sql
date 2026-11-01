-- =====================================================================
-- 022_page_views.sql  -  First-party site traffic for the admin dashboard.
--   PageViews  one row per public page seen. No cookies and no IP address are stored: VisitorKey is a one-way hash of
--              IP + browser + the day, so it can count distinct visitors within one day but cannot follow anyone across days.
--   Day        the calendar day in India (UTC+5:30), so a day on the graph is the owner's day
--   Source     Direct | Search | Social | Referral
-- Plain ASCII on purpose. Apply with:  mysql --default-character-set=utf8mb4 -u root -p sunsteel < this file
-- =====================================================================
CREATE TABLE IF NOT EXISTS `PageViews` (
  `PageViewId` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `At`         DATETIME     NOT NULL,
  `Day`        DATE         NOT NULL,
  `Path`       VARCHAR(200) NOT NULL,
  `VisitorKey` CHAR(16)     NOT NULL,
  `Source`     VARCHAR(12)  NOT NULL DEFAULT 'Direct',
  `Referrer`   VARCHAR(100) NULL,
  `Device`     VARCHAR(10)  NOT NULL DEFAULT 'Desktop',
  PRIMARY KEY (`PageViewId`),
  KEY `IX_PageViews_Day` (`Day`, `VisitorKey`),
  KEY `IX_PageViews_Path` (`Day`, `Path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '022_page_views.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '022_page_views.sql');
