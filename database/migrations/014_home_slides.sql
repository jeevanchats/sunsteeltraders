-- 014_home_slides.sql — the slideshow at the top of the home page (banners come from the media library).
-- Until a slide is saved here the site shows its four built-in banners.
CREATE TABLE IF NOT EXISTS `HomeSlides` (
    `HomeSlideId`  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `MediaId`      BIGINT UNSIGNED NOT NULL,
    `Title`        VARCHAR(120) NULL,
    `Caption`      VARCHAR(300) NULL,
    `CtaText`      VARCHAR(60)  NULL,
    `LinkUrl`      VARCHAR(300) NULL,
    `DisplayOrder` INT NOT NULL DEFAULT 0,
    `IsVisible`    TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (`HomeSlideId`),
    KEY `ix_homeslides_order` (`DisplayOrder`),
    CONSTRAINT `fk_homeslides_media` FOREIGN KEY (`MediaId`) REFERENCES `MediaAssets` (`MediaId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '014_home_slides.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '014_home_slides.sql');
