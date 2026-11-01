-- =====================================================================
-- 025_godown_locations.sql  -  The three godowns are at Aarapalayam, New Jail Road and Vilangudi (Madurai); only the shop is in Simmakkal.
-- Corrects the seeded wording ("godowns in Simmakkal"). Each update only touches a row that still has the original seeded text,
-- so anything staff have edited in the admin is left alone. Safe to re-run.
-- =====================================================================
UPDATE `Pages` SET `MetaDescription` = 'Three godowns in Madurai (Aarapalayam, New Jail Road, Vilangudi), with band-saw cutting and overhead crane loading. Steel and metals for South India''s workshops.'
 WHERE `Slug` = 'about-us' AND `MetaDescription` = 'Three godowns in Simmakkal, Madurai, with band-saw cutting and overhead crane loading. Steel and metals for South India''s workshops.';

UPDATE `Pages` SET `MetaDescription` = 'Send your cut list or drawing for a same-day quote. Call, WhatsApp or visit our shop in Simmakkal, Madurai.'
 WHERE `Slug` = 'contact-us' AND `MetaDescription` = 'Send your cut list or drawing for a same-day quote. Call, WhatsApp or visit our godowns in Simmakkal, Madurai.';

UPDATE `HeroSlides` SET `SubHeadline` = 'Steel, stainless, brass, copper, cast iron and engineering plastics, cut to your size in our Madurai godowns and dispatched the same day.'
 WHERE `SubHeadline` = 'Steel, stainless, brass, copper, cast iron and engineering plastics, cut to your size in our Simmakkal godowns and dispatched the same day.';

UPDATE `Cities` SET `Intro` = 'Our shop is in Simmakkal and our three godowns are at Aarapalayam, New Jail Road and Vilangudi, minutes from most Madurai workshops. Pick up over the counter, or we deliver cut pieces the same day.'
 WHERE `Slug` = 'madurai' AND `Intro` = 'Our godowns sit in Simmakkal, minutes from most Madurai workshops. Pick up over the counter, or we deliver cut pieces the same day.';

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '025_godown_locations.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '025_godown_locations.sql');
