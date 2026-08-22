-- Keno demo seed data. Run after schema.sql. Idempotent within a fresh schema (schema.sql drops/recreates public).
-- Demo password for every seeded user: password123
-- Hash below = bcrypt('password123', 10)

-- ============================================================
-- 01. Core: jurisdictions, channels, key account groups, venues, users
-- ============================================================

INSERT INTO jurisdictions (code, name, rg_messaging_required, default_rg_text) VALUES
  ('NSW', 'New South Wales', true, 'Gamble Responsibly. For free and confidential support, call Gambling Help 1800 858 858.'),
  ('QLD', 'Queensland', true, 'Think! About your choices. Call Gambling Help 1800 858 858.'),
  ('VIC', 'Victoria', true, 'Chances are you''re about to lose. Gambler''s Help 1800 858 858.');

INSERT INTO channels (code, name) VALUES
  ('HOTEL', 'Hotel'),
  ('CLUB', 'Club'),
  ('BOWLS', 'Bowls Club');

INSERT INTO key_account_groups (name, description, discount_rate) VALUES
  ('Coastal Hotels Group', 'Multi-venue coastal hotel operator', 0.08),
  ('Metro Clubs Alliance', 'Metro-area licensed clubs alliance', 0.05);

-- 18 venues: 3 jurisdictions x 3 channels x 2 venues
INSERT INTO venues (name, code, jurisdiction_id, channel_id, key_account_group_id, address, contact_name, contact_email, is_active) VALUES
  ('The Landmark, Eastwood', 'NSW-HOTEL-01', (SELECT id FROM jurisdictions WHERE code='NSW'), (SELECT id FROM channels WHERE code='HOTEL'), (SELECT id FROM key_account_groups WHERE name='Coastal Hotels Group'), '12 Harbour St, Sydney NSW', 'Nedine Mullan', 'dana.reed@anchorhotel.example', true),
  ('Farmers Home Hotel, Wagga Wagga', 'NSW-HOTEL-02', (SELECT id FROM jurisdictions WHERE code='NSW'), (SELECT id FROM channels WHERE code='HOTEL'), (SELECT id FROM key_account_groups WHERE name='Coastal Hotels Group'), '88 River Rd, Parramatta NSW', 'Andrew Dunstall', 'sam.kelly@riversidehotel.example', true),
  ('Seven Seas Hotel, Carrington', 'NSW-CLUB-01', (SELECT id FROM jurisdictions WHERE code='NSW'), (SELECT id FROM channels WHERE code='CLUB'), (SELECT id FROM key_account_groups WHERE name='Metro Clubs Alliance'), '5 George St, Sydney NSW', 'Bec Farrell', 'priya.nair@centralclub.example', true),
  ('Gladstone Hotel, Dulwich Hill', 'NSW-CLUB-02', (SELECT id FROM jurisdictions WHERE code='NSW'), (SELECT id FROM channels WHERE code='CLUB'), NULL, '21 High St, Penrith NSW', 'Nick Overall', 'leo.adams@westernclub.example', true),
  ('Club Hotel, Leumeah', 'NSW-BOWLS-01', (SELECT id FROM jurisdictions WHERE code='NSW'), (SELECT id FROM channels WHERE code='BOWLS'), NULL, '3 Ocean Ave, Manly NSW', 'Tegan Baker', 'grace.tan@manlybowls.example', true),
  ('Robin Hood Hotel, Orange', 'NSW-BOWLS-02', (SELECT id FROM jurisdictions WHERE code='NSW'), (SELECT id FROM channels WHERE code='BOWLS'), NULL, '77 Coal St, Newcastle NSW', 'Tim Eather', 'ollie.hart@newcastlebowls.example', true),
  ('Bli Bli Hotel', 'QLD-HOTEL-01', (SELECT id FROM jurisdictions WHERE code='QLD'), (SELECT id FROM channels WHERE code='HOTEL'), (SELECT id FROM key_account_groups WHERE name='Coastal Hotels Group'), '9 Beach Rd, Mooloolaba QLD', 'Tony Kemp', 'mia.chen@sunshinehotel.example', true),
  ('Shamrock Hotel - Mackay', 'QLD-HOTEL-02', (SELECT id FROM jurisdictions WHERE code='QLD'), (SELECT id FROM channels WHERE code='HOTEL'), NULL, '150 Queen St, Brisbane QLD', 'Troy Tomkins', 'tom.baker@brisbanehotel.example', true),
  ('Flagstone Tavern', 'QLD-CLUB-01', (SELECT id FROM jurisdictions WHERE code='QLD'), (SELECT id FROM channels WHERE code='CLUB'), NULL, '44 Surf Pde, Broadbeach QLD', 'Cass Mawson', 'nina.patel@goldcoastclub.example', true),
  ('Cairns Leagues Club', 'QLD-CLUB-02', (SELECT id FROM jurisdictions WHERE code='QLD'), (SELECT id FROM channels WHERE code='CLUB'), NULL, '10 Esplanade, Cairns QLD', 'Jack Reilly', 'jack.reilly@cairnsclub.example', true),
  ('The Prince Consort Hotel', 'QLD-BOWLS-01', (SELECT id FROM jurisdictions WHERE code='QLD'), (SELECT id FROM channels WHERE code='BOWLS'), NULL, '6 Range St, Toowoomba QLD', 'Nick Firth', 'ella.wood@toowoombabowls.example', true),
  ('South Terrace Hotel', 'QLD-BOWLS-02', (SELECT id FROM jurisdictions WHERE code='QLD'), (SELECT id FROM channels WHERE code='BOWLS'), NULL, '18 Strand Rd, Townsville QLD', 'Rita Suleiman', 'ken.ito@townsvillebowls.example', true),
  ('All Seasons International Motor Inn', 'VIC-HOTEL-01', (SELECT id FROM jurisdictions WHERE code='VIC'), (SELECT id FROM channels WHERE code='HOTEL'), NULL, '30 Fitzroy St, St Kilda VIC', 'Mark O''Brien', 'ruby.lin@stkildahotel.example', true),
  ('The Sun Hotel', 'VIC-HOTEL-02', (SELECT id FROM jurisdictions WHERE code='VIC'), (SELECT id FROM channels WHERE code='HOTEL'), NULL, '5 Moorabool St, Geelong VIC', 'Darryn Haines', 'finn.doyle@geelonghotel.example', true),
  ('Fitzroy Club', 'VIC-CLUB-01', (SELECT id FROM jurisdictions WHERE code='VIC'), (SELECT id FROM channels WHERE code='CLUB'), (SELECT id FROM key_account_groups WHERE name='Metro Clubs Alliance'), '77 Brunswick St, Fitzroy VIC', 'Zoe Marsh', 'zoe.marsh@fitzroyclub.example', true),
  ('Ballarat Club', 'VIC-CLUB-02', (SELECT id FROM jurisdictions WHERE code='VIC'), (SELECT id FROM channels WHERE code='CLUB'), (SELECT id FROM key_account_groups WHERE name='Metro Clubs Alliance'), '2 Sturt St, Ballarat VIC', 'Cody Fisher', 'cody.fisher@ballaratclub.example', true),
  ('Bendigo Bowls Club', 'VIC-BOWLS-01', (SELECT id FROM jurisdictions WHERE code='VIC'), (SELECT id FROM channels WHERE code='BOWLS'), NULL, '14 Pall Mall, Bendigo VIC', 'Ivy Shaw', 'ivy.shaw@bendigobowls.example', true),
  -- Deliberately active with no current/future promotion -> UC12 exception-flag demo target
  ('Warrnambool Bowls Club', 'VIC-BOWLS-02', (SELECT id FROM jurisdictions WHERE code='VIC'), (SELECT id FROM channels WHERE code='BOWLS'), NULL, '9 Lava St, Warrnambool VIC', 'Ana Brooks', 'ana.brooks@warrnamboolbowls.example', true);

-- Users. Shared demo password hash for all accounts: password123
INSERT INTO users (name, email, password_hash, role, venue_id) VALUES
  ('Melissa Maloney', 'admin@keno-demo.example', '$2a$10$7ftPWGT0T.4tQcSgVDqd6uE4i/jDTP/ubIYNxE3Ft1eAHusO9dXQa', 'ADMIN', NULL),
  ('Michael Osborn (BDM - NSW/QLD)', 'bdm.north@keno-demo.example', '$2a$10$7ftPWGT0T.4tQcSgVDqd6uE4i/jDTP/ubIYNxE3Ft1eAHusO9dXQa', 'BDM', NULL),
  ('Murray Dawson (BDM - VIC)', 'bdm.south@keno-demo.example', '$2a$10$7ftPWGT0T.4tQcSgVDqd6uE4i/jDTP/ubIYNxE3Ft1eAHusO9dXQa', 'BDM', NULL),
  ('Morgan Riley (Approver)', 'approver.compliance@keno-demo.example', '$2a$10$7ftPWGT0T.4tQcSgVDqd6uE4i/jDTP/ubIYNxE3Ft1eAHusO9dXQa', 'APPROVER', NULL),
  ('Taylor Quinn (Approver)', 'approver.finance@keno-demo.example', '$2a$10$7ftPWGT0T.4tQcSgVDqd6uE4i/jDTP/ubIYNxE3Ft1eAHusO9dXQa', 'APPROVER', NULL),
  ('Nedine Mullan (Venue: The Landmark, Eastwood)', 'venue.anchor@keno-demo.example', '$2a$10$7ftPWGT0T.4tQcSgVDqd6uE4i/jDTP/ubIYNxE3Ft1eAHusO9dXQa', 'VENUE', (SELECT id FROM venues WHERE code='NSW-HOTEL-01')),
  ('Bec Farrell (Venue: Seven Seas Hotel, Carrington)', 'venue.centralsydney@keno-demo.example', '$2a$10$7ftPWGT0T.4tQcSgVDqd6uE4i/jDTP/ubIYNxE3Ft1eAHusO9dXQa', 'VENUE', (SELECT id FROM venues WHERE code='NSW-CLUB-01')),
  ('Tony Kemp (Venue: Bli Bli Hotel)', 'venue.sunshinecoast@keno-demo.example', '$2a$10$7ftPWGT0T.4tQcSgVDqd6uE4i/jDTP/ubIYNxE3Ft1eAHusO9dXQa', 'VENUE', (SELECT id FROM venues WHERE code='QLD-HOTEL-01')),
  ('Zoe Marsh (Venue: Fitzroy Club)', 'venue.fitzroy@keno-demo.example', '$2a$10$7ftPWGT0T.4tQcSgVDqd6uE4i/jDTP/ubIYNxE3Ft1eAHusO9dXQa', 'VENUE', (SELECT id FROM venues WHERE code='VIC-CLUB-01')),
  ('Ravi Fernando (Venue: Cairns Leagues Club)', 'venue.cairns@keno-demo.example', '$2a$10$7ftPWGT0T.4tQcSgVDqd6uE4i/jDTP/ubIYNxE3Ft1eAHusO9dXQa', 'VENUE', (SELECT id FROM venues WHERE code='QLD-CLUB-02'));

-- Assign BDMs to venues (NSW/QLD -> Michael Osborn, VIC -> Murray Dawson)
UPDATE venues SET bdm_user_id = (SELECT id FROM users WHERE email='bdm.north@keno-demo.example')
WHERE jurisdiction_id IN (SELECT id FROM jurisdictions WHERE code IN ('NSW','QLD'));
UPDATE venues SET bdm_user_id = (SELECT id FROM users WHERE email='bdm.south@keno-demo.example')
WHERE jurisdiction_id = (SELECT id FROM jurisdictions WHERE code='VIC');

-- Hide these two demo logins from the login page's "Quick demo login" picker (accounts and
-- their historical data stay fully intact, they just don't clutter the picker).
UPDATE users SET hide_from_demo_picker = true
WHERE email IN ('venue.anchor@keno-demo.example', 'venue.fitzroy@keno-demo.example');

-- ============================================================
-- 02. Promotions core: types, template fields, sample promotions -- UC1, UC4, UC9
-- ============================================================

INSERT INTO promotion_types (code, name, approval_required, delivery_lead_time_days, digital_lead_time_days, edit_cutoff_days, prize_slots) VALUES
  ('STANDARD', 'Standard Promotion', true, 7, 2, 1, '["Prize"]'::jsonb),
  ('KEY_ACCOUNT', 'Key Account Bulk Promotion', true, 10, 3, 2, '[]'::jsonb),
  ('CELEBRATE_WIN', 'Celebrate-a-Win', false, 0, 0, 0, '[]'::jsonb);

-- Keno Prize Campaigns -- mirrors the client's live Keno Connect "Create Campaign" flow
-- (Standard / Recurring / Major & Minor / 1st,2nd&3rd), each with its own prize-slot structure.
INSERT INTO promotion_types (code, name, approval_required, delivery_lead_time_days, digital_lead_time_days, edit_cutoff_days, prize_slots) VALUES
  ('PRIZE_STANDARD', 'Standard Prize', true, 18, 2, 3, '["Prize"]'::jsonb),
  ('PRIZE_RECURRING', 'Recurring Prize', true, 18, 2, 3, '["Week 1","Week 2","Week 3","Week 4"]'::jsonb),
  ('PRIZE_MAJOR_MINOR', 'Major & Minor Prize', true, 18, 2, 3, '["Major Prize","Minor Prize 1","Minor Prize 2","Minor Prize 3","Minor Prize 4"]'::jsonb),
  ('PRIZE_PODIUM', '1st, 2nd & 3rd Prize', true, 18, 2, 3, '["1st Place","2nd Place","3rd Place"]'::jsonb);

INSERT INTO template_fields (promotion_type_id, field_key, label, field_type, is_required, default_value, sort_order)
SELECT pt.id, f.field_key, f.label, f.field_type, f.is_required, f.default_value, f.sort_order
FROM promotion_types pt
CROSS JOIN (VALUES
  ('contact_email', 'Contact Email', 'TEXT', true, NULL, 1),
  ('print_method', 'Print Method', 'TEXT', true, 'SELF_PRINT', 2),
  ('entry_mechanic', 'Entry Mechanic', 'TEXT', true, NULL, 4),
  ('draw_time', 'Draw Time', 'TEXT', true, NULL, 5),
  ('venue_logo_url', 'Venue Logo', 'IMAGE', false, NULL, 6),
  ('background_image_url', 'Background Image', 'IMAGE', false, NULL, 7)
) AS f(field_key, label, field_type, is_required, default_value, sort_order)
WHERE pt.code IN ('PRIZE_STANDARD','PRIZE_RECURRING','PRIZE_MAJOR_MINOR','PRIZE_PODIUM');

INSERT INTO template_fields (promotion_type_id, field_key, label, field_type, is_required, sort_order) VALUES
  ((SELECT id FROM promotion_types WHERE code='STANDARD'), 'pos_artwork_date', 'POS Artwork Date', 'DATE', true, 1),
  ((SELECT id FROM promotion_types WHERE code='STANDARD'), 'terms_and_conditions_url', 'Terms & Conditions Link', 'TEXT', true, 2),
  ((SELECT id FROM promotion_types WHERE code='STANDARD'), 'print_quantity', 'Print Quantity', 'NUMBER', false, 3),
  ((SELECT id FROM promotion_types WHERE code='KEY_ACCOUNT'), 'bulk_quantity', 'Bulk Order Quantity', 'NUMBER', true, 1),
  ((SELECT id FROM promotion_types WHERE code='KEY_ACCOUNT'), 'bespoke_branding_notes', 'Bespoke Branding Notes', 'TEXT', false, 2),
  ((SELECT id FROM promotion_types WHERE code='CELEBRATE_WIN'), 'venue_name', 'Venue Name', 'TEXT', true, 1),
  ((SELECT id FROM promotion_types WHERE code='CELEBRATE_WIN'), 'venue_logo_url', 'Venue Logo', 'IMAGE', false, 2),
  ((SELECT id FROM promotion_types WHERE code='CELEBRATE_WIN'), 'win_date', 'Win Date', 'DATE', true, 3),
  ((SELECT id FROM promotion_types WHERE code='CELEBRATE_WIN'), 'prize_amount', 'Prize Amount', 'NUMBER', true, 4),
  ((SELECT id FROM promotion_types WHERE code='CELEBRATE_WIN'), 'spot_number', 'Spot Number', 'TEXT', false, 5),
  ((SELECT id FROM promotion_types WHERE code='CELEBRATE_WIN'), 'rg_messaging_line', 'RG Messaging Line', 'TEXT', true, 6);

-- Promotion A: DRAFT -- live UC4 edit + UC9 submit-for-approval demo target
INSERT INTO promotions (promotion_type_id, name, description, jurisdiction_id, start_date, end_date, status, created_by) VALUES
  ((SELECT id FROM promotion_types WHERE code='STANDARD'), 'Spring Jackpot Poster Campaign', 'NSW poster campaign promoting the spring jackpot series.',
   (SELECT id FROM jurisdictions WHERE code='NSW'), CURRENT_DATE + 14, CURRENT_DATE + 45, 'DRAFT',
   (SELECT id FROM users WHERE email='admin@keno-demo.example'));
INSERT INTO promotion_versions (promotion_id, version_number, snapshot, change_reason, changed_by)
  SELECT id, 1, to_jsonb(p), 'Initial draft created', created_by FROM promotions p WHERE name='Spring Jackpot Poster Campaign';

-- Promotion B: ACTIVE, single jurisdiction -- UC1 content-scheduling demo target
INSERT INTO promotions (promotion_type_id, name, description, jurisdiction_id, start_date, end_date, status, created_by) VALUES
  ((SELECT id FROM promotion_types WHERE code='STANDARD'), 'NSW Responsible Gambling Refresh', 'Mandatory RG messaging refresh across NSW venues.',
   (SELECT id FROM jurisdictions WHERE code='NSW'), CURRENT_DATE - 5, CURRENT_DATE + 25, 'ACTIVE',
   (SELECT id FROM users WHERE email='admin@keno-demo.example'));
INSERT INTO promotion_versions (promotion_id, version_number, snapshot, change_reason, changed_by)
  SELECT id, 1, to_jsonb(p), 'Initial draft created', created_by FROM promotions p WHERE name='NSW Responsible Gambling Refresh';

INSERT INTO content_items (title, content_type, body_html, is_compliance_locked, jurisdiction_id, created_by) VALUES
  ('NSW RG Messaging Poster', 'RG_MESSAGE', '<p>Gamble Responsibly. For free and confidential support, call Gambling Help 1800 858 858.</p>', true,
   (SELECT id FROM jurisdictions WHERE code='NSW'), (SELECT id FROM users WHERE email='admin@keno-demo.example'));
INSERT INTO content_item_history (content_item_id, version_number, snapshot, changed_by)
  SELECT id, 1, to_jsonb(ci), created_by FROM content_items ci WHERE title='NSW RG Messaging Poster';

INSERT INTO content_schedules (content_item_id, target_type, venue_id, start_date, end_date, is_locked, created_by) VALUES
  ((SELECT id FROM content_items WHERE title='NSW RG Messaging Poster'), 'VENUE', (SELECT id FROM venues WHERE code='NSW-HOTEL-01'),
   CURRENT_DATE - 5, CURRENT_DATE + 25, true, (SELECT id FROM users WHERE email='admin@keno-demo.example'));
INSERT INTO content_schedules (content_item_id, target_type, key_account_group_id, start_date, end_date, is_locked, created_by) VALUES
  ((SELECT id FROM content_items WHERE title='NSW RG Messaging Poster'), 'KEY_ACCOUNT_GROUP', (SELECT id FROM key_account_groups WHERE name='Coastal Hotels Group'),
   CURRENT_DATE - 5, CURRENT_DATE + 25, true, (SELECT id FROM users WHERE email='admin@keno-demo.example'));
INSERT INTO content_schedules (content_item_id, target_type, jurisdiction_id, start_date, end_date, is_locked, created_by) VALUES
  ((SELECT id FROM content_items WHERE title='NSW RG Messaging Poster'), 'JURISDICTION', (SELECT id FROM jurisdictions WHERE code='NSW'),
   CURRENT_DATE - 5, CURRENT_DATE + 25, true, (SELECT id FROM users WHERE email='admin@keno-demo.example'));

-- Prize Campaign demo: DRAFT Keno Prize Campaign -- showcases the multi-slot prize picker (UC4/UC8 link)
-- (its promotion_prizes rows are inserted further down, once prize_catalogue_items exist -- see UC6/UC8 section)
INSERT INTO promotions (promotion_type_id, name, description, jurisdiction_id, start_date, end_date, status, created_by) VALUES
  ((SELECT id FROM promotion_types WHERE code='PRIZE_MAJOR_MINOR'), 'Ballarat Club Winter Prize Giveaway',
   '<p>Major &amp; minor prize campaign running across the Victorian club network.</p>',
   (SELECT id FROM jurisdictions WHERE code='VIC'), CURRENT_DATE + 10, CURRENT_DATE + 52, 'DRAFT',
   (SELECT id FROM users WHERE email='admin@keno-demo.example'));
INSERT INTO promotion_versions (promotion_id, version_number, snapshot, change_reason, changed_by)
  SELECT id, 1, to_jsonb(p), 'Initial draft created', created_by FROM promotions p WHERE name='Ballarat Club Winter Prize Giveaway';

INSERT INTO promotion_field_values (promotion_id, template_field_id, value_text)
SELECT (SELECT id FROM promotions WHERE name='Ballarat Club Winter Prize Giveaway'), tf.id, v.value_text
FROM (VALUES
  ('contact_email', 'admin@keno-demo.example'),
  ('print_method', 'PRINTED_DELIVERED'),
  ('entry_mechanic', '$15'),
  ('draw_time', 'Monday 10:00 AM')
) AS v(field_key, value_text)
JOIN template_fields tf ON tf.field_key = v.field_key
  AND tf.promotion_type_id = (SELECT id FROM promotion_types WHERE code='PRIZE_MAJOR_MINOR');

-- Promotion C: COMPLETED -- UC11 ratings target (survey added in finance/insights batch)
INSERT INTO promotions (promotion_type_id, name, description, jurisdiction_id, start_date, end_date, status, created_by) VALUES
  ((SELECT id FROM promotion_types WHERE code='STANDARD'), 'QLD Winter Prize Giveaway', 'Completed winter giveaway across QLD venues.',
   (SELECT id FROM jurisdictions WHERE code='QLD'), CURRENT_DATE - 60, CURRENT_DATE - 30, 'COMPLETED',
   (SELECT id FROM users WHERE email='admin@keno-demo.example'));
INSERT INTO promotion_versions (promotion_id, version_number, snapshot, change_reason, changed_by)
  SELECT id, 1, to_jsonb(p), 'Initial draft created', created_by FROM promotions p WHERE name='QLD Winter Prize Giveaway';

-- Promotion E: already-decided APPROVED -- keeps the UC9 audit report non-empty
INSERT INTO promotions (promotion_type_id, name, description, jurisdiction_id, key_account_group_id, start_date, end_date, status, created_by) VALUES
  ((SELECT id FROM promotion_types WHERE code='KEY_ACCOUNT'), 'Metro Clubs Bulk Merch Drop', 'Bulk branded merch drop for Metro Clubs Alliance.',
   (SELECT id FROM jurisdictions WHERE code='VIC'), (SELECT id FROM key_account_groups WHERE name='Metro Clubs Alliance'),
   CURRENT_DATE + 20, CURRENT_DATE + 50, 'APPROVED', (SELECT id FROM users WHERE email='admin@keno-demo.example'));
INSERT INTO promotion_versions (promotion_id, version_number, snapshot, change_reason, changed_by)
  SELECT id, 1, to_jsonb(p), 'Initial draft created', created_by FROM promotions p WHERE name='Metro Clubs Bulk Merch Drop';
INSERT INTO approvals (promotion_id, promotion_version_id, status, reason, approver_id, decided_at)
  SELECT p.id, pv.id, 'APPROVED', 'Meets key account discount policy.', (SELECT id FROM users WHERE email='approver.finance@keno-demo.example'), now() - interval '3 days'
  FROM promotions p JOIN promotion_versions pv ON pv.promotion_id = p.id WHERE p.name='Metro Clubs Bulk Merch Drop';

-- Promotion F1/F2: land exactly on CURRENT_DATE so the UC12 activation/deactivation report
-- always has at least one row in each table right after a reset, with no date picking required.
INSERT INTO promotions (promotion_type_id, name, description, jurisdiction_id, start_date, end_date, status, created_by) VALUES
  ((SELECT id FROM promotion_types WHERE code='STANDARD'), 'NSW Spring Loyalty Refresh', 'Loyalty refresh promotion activating across NSW clubs and hotels.',
   (SELECT id FROM jurisdictions WHERE code='NSW'), CURRENT_DATE, CURRENT_DATE + 31, 'ACTIVE',
   (SELECT id FROM users WHERE email='admin@keno-demo.example'));
INSERT INTO promotion_versions (promotion_id, version_number, snapshot, change_reason, changed_by)
  SELECT id, 1, to_jsonb(p), 'Initial draft created', created_by FROM promotions p WHERE name='NSW Spring Loyalty Refresh';

INSERT INTO promotions (promotion_type_id, name, description, jurisdiction_id, start_date, end_date, status, created_by) VALUES
  ((SELECT id FROM promotion_types WHERE code='STANDARD'), 'QLD Bowls Winter Wrap-Up', 'Winter promotion concluding across QLD bowls clubs.',
   (SELECT id FROM jurisdictions WHERE code='QLD'), CURRENT_DATE - 31, CURRENT_DATE, 'COMPLETED',
   (SELECT id FROM users WHERE email='admin@keno-demo.example'));
INSERT INTO promotion_versions (promotion_id, version_number, snapshot, change_reason, changed_by)
  SELECT id, 1, to_jsonb(p), 'Initial draft created', created_by FROM promotions p WHERE name='QLD Bowls Winter Wrap-Up';

-- Promotion F: already-decided REJECTED -- shows both outcomes in the audit report
INSERT INTO promotions (promotion_type_id, name, description, jurisdiction_id, start_date, end_date, status, created_by) VALUES
  ((SELECT id FROM promotion_types WHERE code='STANDARD'), 'QLD Unapproved Cross-Border Campaign', 'Campaign referencing NSW-only prize terms in QLD venues.',
   (SELECT id FROM jurisdictions WHERE code='QLD'), CURRENT_DATE + 10, CURRENT_DATE + 40, 'REJECTED',
   (SELECT id FROM users WHERE email='admin@keno-demo.example'));
INSERT INTO promotion_versions (promotion_id, version_number, snapshot, change_reason, changed_by)
  SELECT id, 1, to_jsonb(p), 'Initial draft created', created_by FROM promotions p WHERE name='QLD Unapproved Cross-Border Campaign';
INSERT INTO approvals (promotion_id, promotion_version_id, status, reason, approver_id, decided_at)
  SELECT p.id, pv.id, 'REJECTED', 'T&Cs reference NSW-only prize rules; must be jurisdiction-specific for QLD.', (SELECT id FROM users WHERE email='approver.compliance@keno-demo.example'), now() - interval '1 day'
  FROM promotions p JOIN promotion_versions pv ON pv.promotion_id = p.id WHERE p.name='QLD Unapproved Cross-Border Campaign';

-- ============================================================
-- 03. Groups & comms: bespoke venue group, EDM campaign history -- UC3, UC2, UC6
-- ============================================================

-- Promotion D: ACTIVE, spans a bespoke bowls-club pilot group -- UC3 demo target
INSERT INTO promotions (promotion_type_id, name, description, start_date, end_date, status, created_by) VALUES
  ((SELECT id FROM promotion_types WHERE code='STANDARD'), 'Bowls Clubs Pilot Activation', 'Pilot promotion for a hand-picked group of bowls clubs ahead of a wider rollout.',
   CURRENT_DATE - 2, CURRENT_DATE + 28, 'ACTIVE', (SELECT id FROM users WHERE email='admin@keno-demo.example'));
INSERT INTO promotion_versions (promotion_id, version_number, snapshot, change_reason, changed_by)
  SELECT id, 1, to_jsonb(p), 'Initial draft created', created_by FROM promotions p WHERE name='Bowls Clubs Pilot Activation';

INSERT INTO venue_groups (name, promotion_id, start_date, end_date, max_venues, created_by) VALUES
  ('Bowls Clubs Pilot Group', (SELECT id FROM promotions WHERE name='Bowls Clubs Pilot Activation'), CURRENT_DATE - 2, CURRENT_DATE + 28, 10,
   (SELECT id FROM users WHERE email='admin@keno-demo.example'));

INSERT INTO venue_group_members (venue_group_id, venue_id, eligibility_status, opted_at)
SELECT (SELECT id FROM venue_groups WHERE name='Bowls Clubs Pilot Group'), v.id, m.status,
       CASE WHEN m.status <> 'INVITED' THEN now() - interval '2 days' ELSE NULL END
FROM (VALUES
  ('NSW-BOWLS-01', 'OPTED_IN'), ('NSW-BOWLS-02', 'OPTED_IN'), ('QLD-BOWLS-01', 'OPTED_IN'),
  ('QLD-BOWLS-02', 'OPTED_OUT'), ('VIC-BOWLS-01', 'OPTED_OUT'),
  ('VIC-BOWLS-02', 'INVITED'), ('QLD-CLUB-02', 'INVITED')
) AS m(venue_code, status)
JOIN venues v ON v.code = m.venue_code;

-- EDM template + one already-sent campaign so the log has history on load -- UC2 demo
INSERT INTO edm_templates (name, subject_template, body_html_template) VALUES
  ('Monthly Venue Newsletter', 'Keno Venue Update — {{month}}',
   '<div style="font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #eee;border-radius:8px;overflow:hidden;"><div style="background:#0060ac;padding:20px;text-align:center;"><img src="/brand/keno-logo-reversed.png" alt="Keno" style="height:36px;" /></div><div style="height:4px;background:linear-gradient(90deg,#ec008c,#f04e23,#fff200,#00853a,#00aeef,#522e91);"></div><div style="padding:24px;background:#fff;"><h2 style="color:#333333;margin:0 0 12px;">{{month}} Venue Update</h2><p style="color:#666666;line-height:1.6;margin:0 0 20px;">{{highlights}}</p><p style="text-align:center;margin:0 0 20px;"><a href="{{link}}" style="background:#0060ac;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">View full details</a></p><p style="color:#999999;font-size:12px;margin:0;">Sent to {{venueName}} ({{venueCode}}) — {{jurisdictionName}} &middot; {{channelName}}</p></div></div>');

INSERT INTO edm_campaigns (edm_template_id, promotion_id, subject, body_html, audience_type, audience_filter, status, created_by)
SELECT (SELECT id FROM edm_templates WHERE name='Monthly Venue Newsletter'),
       (SELECT id FROM promotions WHERE name='NSW Responsible Gambling Refresh'),
       'Keno Venue Update — August', '<h2>August Venue Update</h2><p>Updated RG messaging is now live across NSW venues. See the attached poster pack.</p>',
       'JURISDICTION', jsonb_build_object('jurisdictionId', (SELECT id FROM jurisdictions WHERE code='NSW')), 'SENT',
       (SELECT id FROM users WHERE email='admin@keno-demo.example');

INSERT INTO edm_recipients (edm_campaign_id, venue_id, email, status, sent_at)
SELECT (SELECT id FROM edm_campaigns WHERE subject='Keno Venue Update — August'), v.id, v.contact_email, 'SENT', now() - interval '5 days'
FROM venues v WHERE v.jurisdiction_id = (SELECT id FROM jurisdictions WHERE code='NSW');

INSERT INTO email_log (edm_campaign_id, recipient_email, subject, body_snapshot, sent_to, external_system, external_ref, vm_data, sent_at)
SELECT (SELECT id FROM edm_campaigns WHERE subject='Keno Venue Update — August'), v.contact_email,
       'Keno Venue Update — August', '<h2>August Venue Update</h2><p>Updated RG messaging is now live across NSW venues. See the attached poster pack.</p>',
       v.contact_email, 'SALESFORCE', 'SF-CAMPAIGN-SEEDDEMO', jsonb_build_object('venueId', v.id, 'venueName', v.name), now() - interval '5 days'
FROM venues v WHERE v.jurisdiction_id = (SELECT id FROM jurisdictions WHERE code='NSW');

-- ============================================================
-- 04. Catalogue, stock, orders, Celebrate-a-Win, returns -- UC6, UC7, UC8, UC10
-- ============================================================

INSERT INTO prize_catalogue_items (sku, name, category, tier, unit_price) VALUES
  ('JBL-FLIP6-01', 'Portable Bluetooth Speaker', 'Electronics', 'Bronze', 49.00),
  ('SONY-EARBUDS-01', 'Wireless Sport Earbuds', 'Electronics', 'Silver', 89.00),
  ('GOOGLE-CHROMECAST-01', '4K Streaming Device', 'Electronics', 'Bronze', 59.00),
  ('RACE-READY-01', 'Race Ready Pack', 'Electronics', 'Gold', 299.00),
  ('LASER-PROJECTOR-01', 'Laser Projector Bundle', 'Electronics', 'Platinum', 399.00),
  ('RYOBI-DIY-01', 'Ryobi DIY Starter Kit', 'Electronics', 'Platinum', 349.00),
  ('NINJA-SLUSHI-01', 'Ninja - Slushi', 'Homeware', 'Gold', 249.00),
  ('NINJA-GRILLFRYER-01', 'Ninja Smart XL Grill & Air Fryer', 'Homeware', 'Silver', 129.00),
  ('IROBOT-ROOMBA-01', 'Smart Robot Vacuum', 'Homeware', 'Platinum', 449.00),
  ('WEBER-BABYQ-01', 'Weber BabyQ', 'Homeware', 'Platinum', 599.00),
  ('WEBER-BURGER-01', 'Weber Burger Pack', 'Outdoor', 'Silver', 99.00),
  ('PICNIC-PACK-01', 'Picnic Pack', 'Outdoor', 'Bronze', 69.00),
  ('NINJA-FROSTVAULT-01', 'Ninja Frostvault 47L', 'Outdoor', 'Gold', 179.00),
  ('RYOBI-YARDKIT-01', 'Ryobi Yard Maintenance Kit', 'Outdoor', 'Bronze', 45.00),
  ('GIFT-BP-01', '$50 BP Fuel Card', 'Gift Cards', 'Bronze', 50.00),
  ('GIFT-BUNNINGS-01', '$100 Bunnings E-Gift Card', 'Gift Cards', 'Silver', 100.00),
  ('GIFT-FLIGHTCENTRE-01', '$250 Getaway Gift Card', 'Gift Cards', 'Gold', 250.00),
  ('NIKE-POLO-01', 'Branded Polo Tee', 'Apparel', 'Bronze', 39.00),
  ('KATHMANDU-PUFFER-01', 'Embroidered Puffer Jacket', 'Apparel', 'Silver', 89.00),
  ('RMW-WEEKENDER-01', 'Leather Overnight Bag', 'Apparel', 'Gold', 199.00);

-- Member price defaults to 80% of RRP (always lower than unit_price); freight cost defaults to 5% of RRP.
UPDATE prize_catalogue_items SET member_price = round(unit_price * 0.8, 2), freight_cost = round(unit_price * 0.05, 2);

-- Prize picks for the "Ballarat Club Winter Prize Giveaway" demo prize campaign (inserted here,
-- not alongside the promotion itself, since it needs prize_catalogue_items to already exist).
INSERT INTO promotion_prizes (promotion_id, prize_catalogue_item_id, slot_label, sort_order)
SELECT (SELECT id FROM promotions WHERE name='Ballarat Club Winter Prize Giveaway'), pci.id, slot.label, slot.sort_order
FROM (VALUES
  ('IROBOT-ROOMBA-01', 'Major Prize', 0),
  ('RACE-READY-01', 'Minor Prize 1', 1),
  ('NINJA-GRILLFRYER-01', 'Minor Prize 2', 2),
  ('NINJA-FROSTVAULT-01', 'Minor Prize 3', 3),
  ('SONY-EARBUDS-01', 'Minor Prize 4', 4)
) AS slot(sku, label, sort_order)
JOIN prize_catalogue_items pci ON pci.sku = slot.sku;

INSERT INTO warehouses (name, jurisdiction_id) VALUES
  ('Sydney DC', (SELECT id FROM jurisdictions WHERE code='NSW')),
  ('Brisbane DC', (SELECT id FROM jurisdictions WHERE code='QLD')),
  ('Melbourne DC', (SELECT id FROM jurisdictions WHERE code='VIC'));

-- Healthy stock for most items across all 3 warehouses
INSERT INTO warehouse_stock (warehouse_id, prize_catalogue_item_id, soh_qty, committed_qty)
SELECT w.id, pci.id, 40, 0
FROM warehouses w CROSS JOIN prize_catalogue_items pci
WHERE pci.sku NOT IN ('LASER-PROJECTOR-01', 'RYOBI-DIY-01');

-- Portable Projector: low stock (below the 5-unit low-stock threshold across all warehouses combined), no ETA needed (still available)
INSERT INTO warehouse_stock (warehouse_id, prize_catalogue_item_id, soh_qty, committed_qty)
SELECT w.id, (SELECT id FROM prize_catalogue_items WHERE sku='LASER-PROJECTOR-01'), 1, 0 FROM warehouses w;

-- Drone Starter Kit: out of stock with an ETA and a substitute -- UC8 low-stock/substitution demo
INSERT INTO warehouse_stock (warehouse_id, prize_catalogue_item_id, soh_qty, committed_qty, restock_eta_date)
SELECT w.id, (SELECT id FROM prize_catalogue_items WHERE sku='RYOBI-DIY-01'), 0, 0, CURRENT_DATE + 14 FROM warehouses w;

INSERT INTO substitution_options (prize_catalogue_item_id, substitute_item_id, note) VALUES
  ((SELECT id FROM prize_catalogue_items WHERE sku='RYOBI-DIY-01'), (SELECT id FROM prize_catalogue_items WHERE sku='LASER-PROJECTOR-01'), 'Similar tier electronics prize, in stock now.');

INSERT INTO freight_charges (zone, min_qty, max_qty, rate) VALUES
  ('Small', 0, 5, 9.00),
  ('Standard', 6, 20, 19.00),
  ('Bulk', 21, NULL, 49.00);

-- Orders across varied statuses, including one split shipment and one key-account bulk order
INSERT INTO orders (venue_id, promotion_id, order_type, po_reference, status, placed_by, freight_charge_id, created_at) VALUES
  ((SELECT id FROM venues WHERE code='NSW-HOTEL-01'), NULL, 'STANDARD', 'PO-1001', 'DELIVERED',
   (SELECT id FROM users WHERE email='admin@keno-demo.example'), (SELECT id FROM freight_charges WHERE zone='Standard'), now() - interval '20 days');
INSERT INTO order_items (order_id, prize_catalogue_item_id, quantity, unit_price, warehouse_id)
  SELECT o.id, (SELECT id FROM prize_catalogue_items WHERE sku='JBL-FLIP6-01'), 10, 49.00, (SELECT id FROM warehouses WHERE name='Sydney DC')
  FROM orders o WHERE o.po_reference='PO-1001';
INSERT INTO warehouse_dispatches (order_item_id, warehouse_id, quantity, consignment_ref, courier_name, status, tracking_events, dispatched_at)
  SELECT oi.id, (SELECT id FROM warehouses WHERE name='Sydney DC'), 10, 'CN-1001', 'StarTrack', 'DELIVERED',
         jsonb_build_array(jsonb_build_object('status','PACKED','at', (now() - interval '19 days')::text),
                            jsonb_build_object('status','SHIPPED','at', (now() - interval '17 days')::text),
                            jsonb_build_object('status','DELIVERED','at', (now() - interval '14 days')::text)),
         now() - interval '17 days'
  FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.po_reference='PO-1001';
INSERT INTO order_status_history (order_id, status, changed_by, changed_at)
  SELECT o.id, s.status, (SELECT id FROM users WHERE email='admin@keno-demo.example'), s.at
  FROM orders o, (VALUES ('PLACED', now() - interval '20 days'), ('PACKED', now() - interval '19 days'), ('SHIPPED', now() - interval '17 days'), ('DELIVERED', now() - interval '14 days')) AS s(status, at)
  WHERE o.po_reference='PO-1001';

INSERT INTO orders (venue_id, promotion_id, order_type, po_reference, status, placed_by, freight_charge_id, created_at) VALUES
  ((SELECT id FROM venues WHERE code='QLD-CLUB-01'), NULL, 'STANDARD', 'PO-1002', 'SHIPPED',
   (SELECT id FROM users WHERE email='admin@keno-demo.example'), (SELECT id FROM freight_charges WHERE zone='Small'), now() - interval '8 days');
INSERT INTO order_items (order_id, prize_catalogue_item_id, quantity, unit_price, warehouse_id)
  SELECT o.id, (SELECT id FROM prize_catalogue_items WHERE sku='NINJA-GRILLFRYER-01'), 5, 129.00, (SELECT id FROM warehouses WHERE name='Brisbane DC')
  FROM orders o WHERE o.po_reference='PO-1002';
INSERT INTO warehouse_dispatches (order_item_id, warehouse_id, quantity, consignment_ref, courier_name, status, tracking_events, dispatched_at)
  SELECT oi.id, (SELECT id FROM warehouses WHERE name='Brisbane DC'), 5, 'CN-1002', 'Australia Post', 'SHIPPED',
         jsonb_build_array(jsonb_build_object('status','PACKED','at', (now() - interval '7 days')::text),
                            jsonb_build_object('status','SHIPPED','at', (now() - interval '5 days')::text)),
         now() - interval '5 days'
  FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.po_reference='PO-1002';
INSERT INTO order_status_history (order_id, status, changed_by, changed_at)
  SELECT o.id, s.status, (SELECT id FROM users WHERE email='admin@keno-demo.example'), s.at
  FROM orders o, (VALUES ('PLACED', now() - interval '8 days'), ('PACKED', now() - interval '7 days'), ('SHIPPED', now() - interval '5 days')) AS s(status, at)
  WHERE o.po_reference='PO-1002';

INSERT INTO orders (venue_id, promotion_id, order_type, po_reference, status, placed_by, freight_charge_id, created_at) VALUES
  ((SELECT id FROM venues WHERE code='VIC-CLUB-01'), NULL, 'STANDARD', 'PO-1003', 'PACKED',
   (SELECT id FROM users WHERE email='admin@keno-demo.example'), (SELECT id FROM freight_charges WHERE zone='Small'), now() - interval '3 days');
INSERT INTO order_items (order_id, prize_catalogue_item_id, quantity, unit_price, warehouse_id)
  SELECT o.id, (SELECT id FROM prize_catalogue_items WHERE sku='SONY-EARBUDS-01'), 8, 89.00, (SELECT id FROM warehouses WHERE name='Melbourne DC')
  FROM orders o WHERE o.po_reference='PO-1003';
INSERT INTO warehouse_dispatches (order_item_id, warehouse_id, quantity, consignment_ref, courier_name, status, tracking_events)
  SELECT oi.id, (SELECT id FROM warehouses WHERE name='Melbourne DC'), 8, 'CN-1003', 'StarTrack', 'PACKED',
         jsonb_build_array(jsonb_build_object('status','PACKED','at', (now() - interval '3 days')::text))
  FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.po_reference='PO-1003';
INSERT INTO order_status_history (order_id, status, changed_by, changed_at)
  SELECT o.id, s.status, (SELECT id FROM users WHERE email='admin@keno-demo.example'), s.at
  FROM orders o, (VALUES ('PLACED', now() - interval '3 days'), ('PACKED', now() - interval '3 days')) AS s(status, at)
  WHERE o.po_reference='PO-1003';

-- Simple placed order, not yet packed -- live "advance dispatch" demo target
INSERT INTO orders (venue_id, promotion_id, order_type, po_reference, status, placed_by, freight_charge_id, created_at) VALUES
  ((SELECT id FROM venues WHERE code='NSW-BOWLS-01'), (SELECT id FROM promotions WHERE name='Bowls Clubs Pilot Activation'), 'STANDARD', 'PO-1004', 'PACKED',
   (SELECT id FROM users WHERE email='venue.anchor@keno-demo.example'), (SELECT id FROM freight_charges WHERE zone='Small'), now() - interval '1 day');
INSERT INTO order_items (order_id, prize_catalogue_item_id, quantity, unit_price, warehouse_id)
  SELECT o.id, (SELECT id FROM prize_catalogue_items WHERE sku='PICNIC-PACK-01'), 4, 69.00, (SELECT id FROM warehouses WHERE name='Sydney DC')
  FROM orders o WHERE o.po_reference='PO-1004';
INSERT INTO warehouse_dispatches (order_item_id, warehouse_id, quantity, consignment_ref, courier_name, status, tracking_events)
  SELECT oi.id, (SELECT id FROM warehouses WHERE name='Sydney DC'), 4, 'CN-1004', 'StarTrack', 'PACKED',
         jsonb_build_array(jsonb_build_object('status','PACKED','at', (now() - interval '1 day')::text))
  FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.po_reference='PO-1004';
INSERT INTO order_status_history (order_id, status, changed_by, changed_at)
  SELECT o.id, s.status, (SELECT id FROM users WHERE email='venue.anchor@keno-demo.example'), s.at
  FROM orders o, (VALUES ('PLACED', now() - interval '1 day'), ('PACKED', now() - interval '1 day')) AS s(status, at)
  WHERE o.po_reference='PO-1004';

-- Split shipment: one order_item fulfilled via two dispatch rows at different progress -- UC8 demo
INSERT INTO orders (venue_id, promotion_id, order_type, po_reference, status, placed_by, freight_charge_id, created_at) VALUES
  ((SELECT id FROM venues WHERE code='QLD-HOTEL-01'), NULL, 'STANDARD', 'PO-1005', 'SHIPPED',
   (SELECT id FROM users WHERE email='admin@keno-demo.example'), (SELECT id FROM freight_charges WHERE zone='Standard'), now() - interval '6 days');
INSERT INTO order_items (order_id, prize_catalogue_item_id, quantity, unit_price, warehouse_id)
  SELECT o.id, (SELECT id FROM prize_catalogue_items WHERE sku='RYOBI-YARDKIT-01'), 10, 45.00, (SELECT id FROM warehouses WHERE name='Brisbane DC')
  FROM orders o WHERE o.po_reference='PO-1005';
INSERT INTO warehouse_dispatches (order_item_id, warehouse_id, quantity, consignment_ref, courier_name, status, tracking_events, dispatched_at)
  SELECT oi.id, (SELECT id FROM warehouses WHERE name='Brisbane DC'), 6, 'CN-1005-A', 'Australia Post', 'DELIVERED',
         jsonb_build_array(jsonb_build_object('status','PACKED','at', (now() - interval '6 days')::text),
                            jsonb_build_object('status','SHIPPED','at', (now() - interval '5 days')::text),
                            jsonb_build_object('status','DELIVERED','at', (now() - interval '3 days')::text)),
         now() - interval '5 days'
  FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.po_reference='PO-1005';
INSERT INTO warehouse_dispatches (order_item_id, warehouse_id, quantity, consignment_ref, courier_name, status, tracking_events, dispatched_at)
  SELECT oi.id, (SELECT id FROM warehouses WHERE name='Brisbane DC'), 4, 'CN-1005-B', 'Australia Post', 'SHIPPED',
         jsonb_build_array(jsonb_build_object('status','PACKED','at', (now() - interval '4 days')::text),
                            jsonb_build_object('status','SHIPPED','at', (now() - interval '2 days')::text)),
         now() - interval '2 days'
  FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.po_reference='PO-1005';
INSERT INTO order_status_history (order_id, status, changed_by, changed_at)
  SELECT o.id, s.status, (SELECT id FROM users WHERE email='admin@keno-demo.example'), s.at
  FROM orders o, (VALUES ('PLACED', now() - interval '6 days'), ('PACKED', now() - interval '6 days'), ('SHIPPED', now() - interval '5 days')) AS s(status, at)
  WHERE o.po_reference='PO-1005';

-- Key account bulk order -- UC6 demo
INSERT INTO orders (venue_id, key_account_group_id, promotion_id, order_type, po_reference, status, placed_by, discount_rate, freight_charge_id, created_at) VALUES
  ((SELECT id FROM venues WHERE code='VIC-CLUB-02'), (SELECT id FROM key_account_groups WHERE name='Metro Clubs Alliance'),
   (SELECT id FROM promotions WHERE name='Metro Clubs Bulk Merch Drop'), 'KEY_ACCOUNT_BULK', 'PO-BULK-2001', 'PACKED',
   (SELECT id FROM users WHERE email='admin@keno-demo.example'), NULL,
   (SELECT id FROM freight_charges WHERE zone='Bulk'), now() - interval '2 days');
UPDATE orders SET discount_rate = (SELECT discount_rate FROM key_account_groups WHERE name='Metro Clubs Alliance') WHERE po_reference='PO-BULK-2001';
INSERT INTO order_items (order_id, prize_catalogue_item_id, quantity, unit_price, warehouse_id)
  SELECT o.id, (SELECT id FROM prize_catalogue_items WHERE sku='NINJA-SLUSHI-01'), 25, 249.00, (SELECT id FROM warehouses WHERE name='Melbourne DC')
  FROM orders o WHERE o.po_reference='PO-BULK-2001';
INSERT INTO warehouse_dispatches (order_item_id, warehouse_id, quantity, consignment_ref, courier_name, status, tracking_events)
  SELECT oi.id, (SELECT id FROM warehouses WHERE name='Melbourne DC'), 25, 'CN-2001', 'TNT', 'PACKED',
         jsonb_build_array(jsonb_build_object('status','PACKED','at', (now() - interval '2 days')::text))
  FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.po_reference='PO-BULK-2001';
INSERT INTO order_status_history (order_id, status, changed_by, changed_at)
  SELECT o.id, s.status, (SELECT id FROM users WHERE email='admin@keno-demo.example'), s.at
  FROM orders o, (VALUES ('PLACED', now() - interval '2 days'), ('PACKED', now() - interval '2 days')) AS s(status, at)
  WHERE o.po_reference='PO-BULK-2001';

-- Celebrate-a-Win: one live demo target (PENDING) + one already-completed history item -- UC7
INSERT INTO promotion_types (code, name, approval_required, delivery_lead_time_days, digital_lead_time_days, edit_cutoff_days)
  SELECT 'CELEBRATE_WIN', 'Celebrate-a-Win', false, 0, 0, 0
  WHERE NOT EXISTS (SELECT 1 FROM promotion_types WHERE code='CELEBRATE_WIN');

INSERT INTO promotions (promotion_type_id, name, description, start_date, end_date, status, created_by) VALUES
  ((SELECT id FROM promotion_types WHERE code='CELEBRATE_WIN'), 'Spot the Difference Cash Draw', 'Ongoing in-venue cash draw promotion feeding Celebrate-a-Win automation.',
   CURRENT_DATE - 10, CURRENT_DATE + 80, 'ACTIVE', (SELECT id FROM users WHERE email='admin@keno-demo.example'));
INSERT INTO promotion_versions (promotion_id, version_number, snapshot, change_reason, changed_by)
  SELECT id, 1, to_jsonb(p), 'Initial draft created', created_by FROM promotions p WHERE name='Spot the Difference Cash Draw';

INSERT INTO win_events (promotion_id, venue_id, prize_amount, spot_number, win_date, status) VALUES
  ((SELECT id FROM promotions WHERE name='Spot the Difference Cash Draw'), (SELECT id FROM venues WHERE code='NSW-HOTEL-01'), 5000.00, 'B12', CURRENT_DATE, 'PENDING'),
  ((SELECT id FROM promotions WHERE name='Spot the Difference Cash Draw'), (SELECT id FROM venues WHERE code='QLD-HOTEL-01'), 2500.00, 'A04', CURRENT_DATE - 3, 'NOTIFIED');

INSERT INTO pos_generations (win_event_id, template_field_snapshot, format, previewed_at, generated_at)
SELECT we.id, jsonb_build_object('venue_name', v.name, 'win_date', to_char(we.win_date, 'DD Month YYYY'), 'prize_amount', '$2,500.00', 'spot_number', we.spot_number, 'rg_messaging_line', j.default_rg_text),
       'PRINT_PDF', now() - interval '2 days', now() - interval '2 days'
FROM win_events we JOIN venues v ON v.id = we.venue_id JOIN jurisdictions j ON j.id = v.jurisdiction_id
WHERE we.spot_number = 'A04';

INSERT INTO notifications (win_event_id, recipient_user_id, recipient_type, channel, message, status, sent_at)
SELECT we.id, u.id, 'BDM', 'EMAIL', v.name || ' won $2,500.00 on spot A04! POS assets are ready to download.', 'SENT', now() - interval '2 days'
FROM win_events we JOIN venues v ON v.id = we.venue_id JOIN users u ON u.id = v.bdm_user_id
WHERE we.spot_number = 'A04';

-- Returns / damaged goods -- UC10: one resolved via credit, one still in triage
INSERT INTO return_cases (order_item_id, venue_id, reason, notes, quantity_damaged, root_cause, status, resolution_type, created_by, created_at)
SELECT oi.id, o.venue_id, 'DAMAGED', 'Speaker arrived with a cracked casing.', 2, 'TRANSIT_DAMAGE', 'CREDIT_ISSUED', 'CREDIT',
       (SELECT id FROM users WHERE email='venue.anchor@keno-demo.example'), now() - interval '10 days'
FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.po_reference='PO-1001';

INSERT INTO ledger_items (amount, is_credit, order_id, venue_id, description, created_at)
SELECT oi.quantity * oi.unit_price, true, o.id, o.venue_id, 'Credit for damaged Bluetooth Speaker order', now() - interval '9 days'
FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.po_reference='PO-1001';

UPDATE return_cases SET credit_ledger_item_id = (SELECT id FROM ledger_items WHERE description='Credit for damaged Bluetooth Speaker order')
WHERE order_item_id = (SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.po_reference='PO-1001');

INSERT INTO return_case_status_history (return_case_id, status, changed_by, changed_at, note)
SELECT rc.id, s.status, (SELECT id FROM users WHERE email=s.email), s.at, s.note
FROM return_cases rc,
  (VALUES
    ('LODGED', 'venue.anchor@keno-demo.example', now() - interval '10 days', 'Case lodged by venue'),
    ('IN_TRIAGE', 'admin@keno-demo.example', now() - interval '9 days', 'Reviewed photos, approved for credit'),
    ('CREDIT_ISSUED', 'admin@keno-demo.example', now() - interval '9 days', 'Credit issued to venue account')
  ) AS s(status, email, at, note)
WHERE rc.reason = 'DAMAGED' AND rc.notes LIKE 'Speaker%';

INSERT INTO return_cases (order_item_id, venue_id, reason, notes, quantity_damaged, root_cause, status, created_by, created_at)
SELECT oi.id, o.venue_id, 'FAULTY', 'Air fryer will not power on.', 1, 'MANUFACTURING_DEFECT', 'IN_TRIAGE',
       (SELECT id FROM users WHERE email='admin@keno-demo.example'), now() - interval '2 days'
FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.po_reference='PO-1002';

INSERT INTO return_case_status_history (return_case_id, status, changed_by, changed_at, note)
SELECT rc.id, s.status, (SELECT id FROM users WHERE email=s.email), s.at, s.note
FROM return_cases rc,
  (VALUES ('LODGED', 'admin@keno-demo.example', now() - interval '2 days', 'Case lodged'),
          ('IN_TRIAGE', 'admin@keno-demo.example', now() - interval '1 day', 'Awaiting supplier fault confirmation')) AS s(status, email, at, note)
WHERE rc.reason = 'FAULTY' AND rc.notes = 'Air fryer will not power on.';

-- A broader spread of return cases (varied products/reasons/status/dates) so the UC10 reporting
-- page (over-time trend, by-reason breakdown, top-products table) has real volume to aggregate.
INSERT INTO return_cases (order_item_id, venue_id, reason, notes, quantity_damaged, priority, root_cause, status, resolution_type, created_by, created_at)
SELECT oi.id, o.venue_id, b.reason, b.notes, b.qty, b.priority,
       CASE b.reason WHEN 'DAMAGED' THEN 'TRANSIT_DAMAGE' WHEN 'FAULTY' THEN 'MANUFACTURING_DEFECT' WHEN 'WRONG_ITEM' THEN 'WAREHOUSE_HANDLING' ELSE 'OTHER' END,
       b.status, b.resolution_type,
       (SELECT id FROM users WHERE email='admin@keno-demo.example'), now() - (b.days_ago || ' days')::interval
FROM (VALUES
  ('PO-1001','DAMAGED','Second batch arrived dented.',1,'LOW','CLOSED','CREDIT',52),
  ('PO-1002','FAULTY','Unit smells of burning plastic.',1,'HIGH','REPLACEMENT_SHIPPED','REPLACEMENT',45),
  ('PO-1003','WRONG_ITEM','Received wired earbuds instead of wireless.',2,'MEDIUM','CLOSED','REPLACEMENT',40),
  ('PO-1004','DAMAGED','One chair leg snapped in transit.',1,'MEDIUM','REPLACEMENT_SHIPPED','REPLACEMENT',35),
  ('PO-1005','OTHER','Missing lid on two tumblers.',2,'LOW','CREDIT_ISSUED','CREDIT',30),
  ('PO-BULK-2001','FAULTY','Steam wand not working on delivery.',1,'HIGH','IN_TRIAGE',NULL,25),
  ('PO-1001','DAMAGED','Casing cracked again on reorder.',1,'MEDIUM','REJECTED',NULL,22),
  ('PO-1002','WRONG_ITEM','Wrong colour fryer received.',1,'LOW','CLOSED','REPLACEMENT',18),
  ('PO-1003','DAMAGED','Charging case lid broken.',1,'MEDIUM','REPLACEMENT_SHIPPED','REPLACEMENT',14),
  ('PO-1004','FAULTY','Reclining mechanism jammed.',1,'MEDIUM','APPROVED',NULL,10),
  ('PO-1005','DAMAGED','Print faded on 3 tumblers.',3,'LOW','LODGED',NULL,6),
  ('PO-1001','FAULTY','Bluetooth pairing fails intermittently.',1,'MEDIUM','LODGED',NULL,3)
) AS b(po, reason, notes, qty, priority, status, resolution_type, days_ago)
JOIN orders o ON o.po_reference = b.po
JOIN order_items oi ON oi.order_id = o.id;

INSERT INTO return_case_status_history (return_case_id, status, changed_by, changed_at, note)
SELECT id, 'LODGED', created_by, created_at, 'Case lodged by venue'
FROM return_cases
WHERE notes IN (
  'Second batch arrived dented.','Unit smells of burning plastic.','Received wired earbuds instead of wireless.',
  'One chair leg snapped in transit.','Missing lid on two tumblers.','Steam wand not working on delivery.',
  'Casing cracked again on reorder.','Wrong colour fryer received.','Charging case lid broken.',
  'Reclining mechanism jammed.','Print faded on 3 tumblers.','Bluetooth pairing fails intermittently.'
);

INSERT INTO return_case_status_history (return_case_id, status, changed_by, changed_at, note)
SELECT id, status, created_by, created_at + interval '3 days',
       CASE status
         WHEN 'CREDIT_ISSUED' THEN 'Credit issued to venue account'
         WHEN 'REPLACEMENT_SHIPPED' THEN 'Replacement shipped to venue'
         WHEN 'CLOSED' THEN 'Case closed'
         WHEN 'REJECTED' THEN 'Claim rejected -- outside policy window'
         WHEN 'APPROVED' THEN 'Approved, arranging replacement'
         WHEN 'IN_TRIAGE' THEN 'Reviewing photos and evidence'
         ELSE NULL
       END
FROM return_cases
WHERE status <> 'LODGED'
  AND notes IN (
  'Second batch arrived dented.','Unit smells of burning plastic.','Received wired earbuds instead of wireless.',
  'One chair leg snapped in transit.','Missing lid on two tumblers.','Steam wand not working on delivery.',
  'Casing cracked again on reorder.','Wrong colour fryer received.','Charging case lid broken.',
  'Reclining mechanism jammed.'
);

UPDATE return_cases SET tracking_ref = 'TNT' || (100000 + (random()*899999)::int)::text,
       customer_notified_at = updated_at + interval '2 hours'
WHERE status IN ('REPLACEMENT_SHIPPED','CREDIT_ISSUED','CLOSED','REJECTED') AND tracking_ref IS NULL AND resolution_type = 'REPLACEMENT';

UPDATE return_cases SET customer_notified_at = updated_at + interval '2 hours'
WHERE status IN ('REPLACEMENT_SHIPPED','CREDIT_ISSUED','CLOSED','REJECTED') AND customer_notified_at IS NULL;

-- ============================================================
-- 05. Finance & insights: ratings survey, exception flag, support requests -- UC5, UC11, UC12
-- ============================================================

-- Open survey against the completed QLD promotion -- UC11 live-submission + insights demo
INSERT INTO promotion_surveys (promotion_id, opens_at, closes_at, is_required)
  SELECT id, now() - interval '25 days', now() + interval '5 days', false FROM promotions WHERE name='QLD Winter Prize Giveaway';

-- Three prizes linked to this promotion so the per-prize rating flow (UC11 redesign) has real
-- data to rate/aggregate, matching the client's "rate each prize within the promotion" mockup.
INSERT INTO promotion_prizes (promotion_id, prize_catalogue_item_id, slot_label, sort_order)
SELECT (SELECT id FROM promotions WHERE name='QLD Winter Prize Giveaway'), pci.id, slot.label, slot.sort_order
FROM (VALUES ('Prize 1', 0, 'JBL-FLIP6-01'), ('Prize 2', 1, 'GIFT-BUNNINGS-01'), ('Prize 3', 2, 'RYOBI-YARDKIT-01')) AS slot(label, sort_order, sku)
JOIN prize_catalogue_items pci ON pci.sku = slot.sku;

INSERT INTO promotion_ratings (promotion_survey_id, venue_id, overall_rating, comments, submitted_at)
SELECT (SELECT ps.id FROM promotion_surveys ps JOIN promotions p ON p.id = ps.promotion_id WHERE p.name='QLD Winter Prize Giveaway'),
       (SELECT id FROM venues WHERE code='QLD-HOTEL-01'), 5, 'Great engagement from regulars, prizes arrived on time.', now() - interval '20 days';
INSERT INTO promotion_rating_prizes (promotion_rating_id, promotion_prize_id, rating)
SELECT pr.id, pp.id, r.rating
FROM promotion_ratings pr
JOIN venues v ON v.id = pr.venue_id AND v.code = 'QLD-HOTEL-01'
JOIN promotion_prizes pp ON pp.promotion_id = (SELECT id FROM promotions WHERE name='QLD Winter Prize Giveaway')
JOIN (VALUES ('Prize 1', 5), ('Prize 2', 4), ('Prize 3', 4)) AS r(label, rating) ON r.label = pp.slot_label;

INSERT INTO promotion_ratings (promotion_survey_id, venue_id, overall_rating, comments, submitted_at)
SELECT (SELECT ps.id FROM promotion_surveys ps JOIN promotions p ON p.id = ps.promotion_id WHERE p.name='QLD Winter Prize Giveaway'),
       (SELECT id FROM venues WHERE code='QLD-CLUB-01'), 3, 'Delivery was a few days late, otherwise fine.', now() - interval '18 days';
INSERT INTO promotion_rating_prizes (promotion_rating_id, promotion_prize_id, rating)
SELECT pr.id, pp.id, r.rating
FROM promotion_ratings pr
JOIN venues v ON v.id = pr.venue_id AND v.code = 'QLD-CLUB-01'
JOIN promotion_prizes pp ON pp.promotion_id = (SELECT id FROM promotions WHERE name='QLD Winter Prize Giveaway')
JOIN (VALUES ('Prize 1', 3), ('Prize 2', 3), ('Prize 3', 2)) AS r(label, rating) ON r.label = pp.slot_label;

-- Exception flag: venue is active but has no current promotion -- UC12 demo target
INSERT INTO exception_flags (type, venue_id, note, detected_at)
SELECT 'VENUE_ACTIVE_NO_PROMOTION', v.id, v.name || ' is active but has no current promotion.', now() - interval '1 day'
FROM venues v WHERE v.code = 'VIC-BOWLS-02';

-- Support requests -- UC12 demo history
INSERT INTO support_requests (requester_user_id, venue_id, order_id, issue_type, subject, description, status, priority, assigned_to_user_id, created_at)
SELECT (SELECT id FROM users WHERE email='venue.fitzroy@keno-demo.example'), (SELECT id FROM venues WHERE code='VIC-CLUB-01'),
       (SELECT id FROM orders WHERE po_reference='PO-1003'), 'ORDER', 'Order status not updating', 'We packed this three days ago but the tracker still says Packed.',
       'OPEN', 'MEDIUM', NULL, now() - interval '2 days';
INSERT INTO support_request_comments (support_request_id, author_user_id, comment, created_at)
SELECT id, (SELECT id FROM users WHERE email='admin@keno-demo.example'), 'Checked with warehouse — dispatch confirmed, updating tracker now.', now() - interval '1 day'
FROM support_requests WHERE subject='Order status not updating';
INSERT INTO support_request_status_history (support_request_id, status, changed_by, changed_at, note)
SELECT id, 'OPEN', requester_user_id, created_at, 'Request created' FROM support_requests WHERE subject='Order status not updating';

INSERT INTO support_requests (requester_user_id, venue_id, promotion_id, issue_type, subject, description, status, priority, assigned_to_user_id, created_at)
SELECT (SELECT id FROM users WHERE email='bdm.north@keno-demo.example'), (SELECT id FROM venues WHERE code='NSW-BOWLS-01'),
       (SELECT id FROM promotions WHERE name='Bowls Clubs Pilot Activation'), 'PROMOTION', 'Need updated POS artwork for pilot venues',
       'Pilot group venues need refreshed POS artwork ahead of the opt-in deadline.', 'IN_PROGRESS', 'HIGH',
       (SELECT id FROM users WHERE email='admin@keno-demo.example'), now() - interval '1 day';
INSERT INTO support_request_comments (support_request_id, author_user_id, comment, created_at)
SELECT id, (SELECT id FROM users WHERE email='admin@keno-demo.example'), 'Artwork brief sent to design team, ETA 2 days.', now() - interval '12 hours'
FROM support_requests WHERE subject='Need updated POS artwork for pilot venues';
INSERT INTO support_request_status_history (support_request_id, status, changed_by, changed_at, note)
SELECT id, 'OPEN', requester_user_id, created_at, 'Request created' FROM support_requests WHERE subject='Need updated POS artwork for pilot venues';
INSERT INTO support_request_status_history (support_request_id, status, changed_by, changed_at, note)
SELECT id, 'IN_PROGRESS', assigned_to_user_id, now() - interval '18 hours', 'Assigned and picked up by support team'
FROM support_requests WHERE subject='Need updated POS artwork for pilot venues';

-- Venue note -- UC12 demo target (Notes tab on venue detail)
INSERT INTO venue_notes (venue_id, author_user_id, note, created_at)
SELECT (SELECT id FROM venues WHERE code='VIC-BOWLS-02'), (SELECT id FROM users WHERE email='admin@keno-demo.example'),
       'Called venue manager — confirmed they are keen for the next bowls pilot round once a promotion is assigned.', now() - interval '6 hours';
