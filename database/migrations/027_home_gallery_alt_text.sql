-- =====================================================================
-- 027_home_gallery_alt_text.sql  -  Alt text for the 39 photos in the home-page gallery.
-- They were uploaded with no alt text, so Google and screen readers got nothing for 78 images on the home page
-- (the gallery shows every photo twice for the looping slide). Each line describes what the photo shows.
-- Only fills a blank AltText on that exact media id and file name, so alt text staff write in the admin is never
-- replaced, and on a database with different uploads it changes nothing. Safe to re-run.
-- =====================================================================
UPDATE `MediaAssets` SET `AltText` = 'Stainless steel round bars' WHERE `MediaId` = 1 AND `FileName` = '1.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Aluminium round bar and square bar' WHERE `MediaId` = 2 AND `FileName` = 'aluminium.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Brass hexagonal and round bars' WHERE `MediaId` = 3 AND `FileName` = 'brass bar.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Cast iron round bar' WHERE `MediaId` = 4 AND `FileName` = 'cast iron.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Band saw machine cutting steel bars, with the operator at the controls' WHERE `MediaId` = 5 AND `FileName` = 'ChatGPT Image Oct 11, 2026, 11_54_33 PM.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Hollow round bars' WHERE `MediaId` = 6 AND `FileName` = 'ChatGPT Image Oct 25, 2026, 11_54_51 PM.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Chequered plate' WHERE `MediaId` = 7 AND `FileName` = 'chequered sheet.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Stainless steel circle and flat plate' WHERE `MediaId` = 8 AND `FileName` = 'circle flats.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Copper flat bar' WHERE `MediaId` = 9 AND `FileName` = 'copper bar flat.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'EN8 steel round bar' WHERE `MediaId` = 10 AND `FileName` = 'en8.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'EN24 steel round bar' WHERE `MediaId` = 11 AND `FileName` = 'en24.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Galvanised (GP) pipes' WHERE `MediaId` = 12 AND `FileName` = 'gp pipes.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Gunmetal bush' WHERE `MediaId` = 13 AND `FileName` = 'gun metal.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'HCHCR D2 tool steel flat' WHERE `MediaId` = 14 AND `FileName` = 'hchcr d2 tool.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Hexagonal steel bar' WHERE `MediaId` = 15 AND `FileName` = 'hex bar.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Mild steel angle' WHERE `MediaId` = 16 AND `FileName` = 'ms angle (2).png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Mild steel I beam' WHERE `MediaId` = 17 AND `FileName` = 'ms i beam.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Mild steel channel' WHERE `MediaId` = 18 AND `FileName` = 'mschannel.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'White nylon rod and block' WHERE `MediaId` = 19 AND `FileName` = 'nylon.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'OHNS tool steel flat bar' WHERE `MediaId` = 20 AND `FileName` = 'ohns.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'White PTFE (Teflon) rod and sheet' WHERE `MediaId` = 21 AND `FileName` = 'ptfe bush sheet.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Metal sheets stacked on a pallet' WHERE `MediaId` = 22 AND `FileName` = 'sheets.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Stainless steel flat bars' WHERE `MediaId` = 23 AND `FileName` = 'ss flats.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Abrasive cut-off wheels' WHERE `MediaId` = 24 AND `FileName` = 'Abrasive Cut-Off Wheels.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Clear acrylic sheets' WHERE `MediaId` = 25 AND `FileName` = 'acrylic sheets.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Bakelite sheets' WHERE `MediaId` = 26 AND `FileName` = 'bakelite sheets.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Black MS square and rectangular pipes' WHERE `MediaId` = 27 AND `FileName` = 'black pipes.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Black mild steel round bars' WHERE `MediaId` = 28 AND `FileName` = 'black round bar.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Black mild steel square bars' WHERE `MediaId` = 29 AND `FileName` = 'black square bar.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Brass sheet and brass coil' WHERE `MediaId` = 30 AND `FileName` = 'Brass Sheets & Coils.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Carbide turning inserts' WHERE `MediaId` = 31 AND `FileName` = 'Carbide Inserter Turning Tools.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Copper hollow tubes' WHERE `MediaId` = 32 AND `FileName` = 'copper hollow tubes.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Mild steel flat bars' WHERE `MediaId` = 33 AND `FileName` = 'flat bar.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'HSS and M42 cobalt lathe tool bit blanks' WHERE `MediaId` = 34 AND `FileName` = 'HSS and M42 Cobalt Lathe Tool Bit Blanks.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'HSS taps and die set' WHERE `MediaId` = 35 AND `FileName` = 'HSS Taps & Die Sets.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Lathe chuck with chuck key and jaws' WHERE `MediaId` = 36 AND `FileName` = 'Lathe Chuck Machine Accessories.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Magnetic V-blocks and precision clamps' WHERE `MediaId` = 37 AND `FileName` = 'Magnetic V-Blocks & Precision Clamps.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Mild steel plates stacked on a pallet' WHERE `MediaId` = 38 AND `FileName` = 'ms plate.png' AND (`AltText` IS NULL OR `AltText` = '');
UPDATE `MediaAssets` SET `AltText` = 'Solid carbide end mills' WHERE `MediaId` = 39 AND `FileName` = 'solid carbide end mills.png' AND (`AltText` IS NULL OR `AltText` = '');

INSERT INTO `__schema_migrations` (`script_name`)
SELECT '027_home_gallery_alt_text.sql'
WHERE NOT EXISTS (SELECT 1 FROM `__schema_migrations` WHERE `script_name` = '027_home_gallery_alt_text.sql');
