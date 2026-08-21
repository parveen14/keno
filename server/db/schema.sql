-- Keno RFP demo schema. Reset-and-reseed friendly: safe to run repeatedly.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- ============================================================
-- Shared core
-- ============================================================

CREATE TABLE jurisdictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  rg_messaging_required boolean NOT NULL DEFAULT true,
  default_rg_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL
);

CREATE TABLE key_account_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  discount_rate numeric(5,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
  channel_id uuid NOT NULL REFERENCES channels(id),
  key_account_group_id uuid REFERENCES key_account_groups(id),
  address text,
  contact_name text,
  contact_email text,
  bdm_user_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('VENUE','BDM','APPROVER','ADMIN')),
  venue_id uuid REFERENCES venues(id),
  -- Hides an account from the login page's "Quick demo login" picker without deleting it --
  -- the account (and all its historical orders/returns/audit history) stays fully intact.
  hide_from_demo_picker boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE venues ADD CONSTRAINT venues_bdm_fk FOREIGN KEY (bdm_user_id) REFERENCES users(id);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  changed_by uuid REFERENCES users(id),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_record ON audit_log(table_name, record_id);

-- ============================================================
-- Promotions core -- UC1, UC4, UC9
-- ============================================================

CREATE TABLE promotion_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  approval_required boolean NOT NULL DEFAULT true,
  delivery_lead_time_days int NOT NULL DEFAULT 7,
  digital_lead_time_days int NOT NULL DEFAULT 2,
  edit_cutoff_days int NOT NULL DEFAULT 1,
  -- Ordered slot labels (e.g. ["Prize"] or ["1st Place","2nd Place","3rd Place"]) for types that
  -- let a BDM pick prize-catalogue products when building the promotion. Empty = no prize picker.
  prize_slots jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_type_id uuid NOT NULL REFERENCES promotion_types(id),
  name text NOT NULL,
  description text,
  jurisdiction_id uuid REFERENCES jurisdictions(id),
  key_account_group_id uuid REFERENCES key_account_groups(id),
  venue_group_id uuid,
  prize_catalogue_item_id uuid,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','ACTIVE','COMPLETED','CANCELLED')),
  current_version_no int NOT NULL DEFAULT 1,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE promotion_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  snapshot jsonb NOT NULL,
  change_reason text,
  changed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_type_id uuid NOT NULL REFERENCES promotion_types(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('TEXT','DATE','NUMBER','IMAGE','RICHTEXT')),
  is_required boolean NOT NULL DEFAULT false,
  regex_validation text,
  default_value text,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE(promotion_type_id, field_key)
);

CREATE TABLE promotion_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  template_field_id uuid NOT NULL REFERENCES template_fields(id),
  value_text text,
  UNIQUE(promotion_id, template_field_id)
);

CREATE TABLE campaign_blackout_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid REFERENCES jurisdictions(id),
  channel_id uuid REFERENCES channels(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text
);

CREATE TABLE approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_type_id uuid NOT NULL REFERENCES promotion_types(id),
  jurisdiction_id uuid REFERENCES jurisdictions(id),
  spend_threshold numeric(12,2),
  order_count_threshold int,
  rolling_window_days int,
  required_role text NOT NULL DEFAULT 'APPROVER' CHECK (required_role IN ('APPROVER','ADMIN')),
  precedence_order int NOT NULL DEFAULT 0
);

CREATE TABLE approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  promotion_version_id uuid REFERENCES promotion_versions(id),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  reason text,
  approver_id uuid REFERENCES users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Content & compliance -- UC1
-- ============================================================

CREATE TABLE content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('POSTER','RG_MESSAGE','BANNER','OTHER')),
  body_html text,
  file_url text,
  thumbnail_url text,
  is_compliance_locked boolean NOT NULL DEFAULT false,
  jurisdiction_id uuid REFERENCES jurisdictions(id),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content_item_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('VENUE','KEY_ACCOUNT_GROUP','JURISDICTION','CHANNEL')),
  venue_id uuid REFERENCES venues(id),
  key_account_group_id uuid REFERENCES key_account_groups(id),
  jurisdiction_id uuid REFERENCES jurisdictions(id),
  channel_id uuid REFERENCES channels(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_locked boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (target_type = 'VENUE' AND venue_id IS NOT NULL AND key_account_group_id IS NULL AND jurisdiction_id IS NULL AND channel_id IS NULL) OR
    (target_type = 'KEY_ACCOUNT_GROUP' AND key_account_group_id IS NOT NULL AND venue_id IS NULL AND jurisdiction_id IS NULL AND channel_id IS NULL) OR
    (target_type = 'JURISDICTION' AND jurisdiction_id IS NOT NULL AND venue_id IS NULL AND key_account_group_id IS NULL AND channel_id IS NULL) OR
    (target_type = 'CHANNEL' AND channel_id IS NOT NULL AND venue_id IS NULL AND key_account_group_id IS NULL AND jurisdiction_id IS NULL)
  )
);

-- ============================================================
-- EDM / comms -- UC2
-- ============================================================

CREATE TABLE edm_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject_template text NOT NULL,
  body_html_template text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE edm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edm_template_id uuid REFERENCES edm_templates(id),
  promotion_id uuid REFERENCES promotions(id),
  subject text NOT NULL,
  body_html text NOT NULL,
  audience_type text NOT NULL CHECK (audience_type IN ('JURISDICTION','CHANNEL','KEY_ACCOUNT_GROUP','ALL')),
  audience_filter jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','QUEUED','SENT')),
  scheduled_send_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE edm_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edm_campaign_id uuid NOT NULL REFERENCES edm_campaigns(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SENT','FAILED')),
  sent_at timestamptz
);

CREATE TABLE email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edm_campaign_id uuid REFERENCES edm_campaigns(id),
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body_snapshot text,
  sent_to text,
  cc text,
  bcc text,
  external_system text NOT NULL DEFAULT 'SALESFORCE',
  external_ref text,
  vm_data jsonb,
  sent_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Bespoke venue groups -- UC3
-- ============================================================

CREATE TABLE venue_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  promotion_id uuid REFERENCES promotions(id),
  start_date date,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  max_venues int NOT NULL DEFAULT 10,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE promotions ADD CONSTRAINT promotions_venue_group_fk FOREIGN KEY (venue_group_id) REFERENCES venue_groups(id);

CREATE TABLE venue_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_group_id uuid NOT NULL REFERENCES venue_groups(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id),
  eligibility_status text NOT NULL DEFAULT 'INVITED' CHECK (eligibility_status IN ('INVITED','OPTED_IN','OPTED_OUT')),
  opted_at timestamptz,
  UNIQUE(venue_group_id, venue_id)
);

-- ============================================================
-- Prize catalogue / stock / orders -- UC6, UC8
-- ============================================================

CREATE TABLE prize_catalogue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  tier text NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  -- Member price shown alongside RRP in the catalogue/cart -- always lower than unit_price (RRP).
  member_price numeric(10,2) NOT NULL DEFAULT 0,
  -- Per-product freight cost, shown under the RRP in the catalogue.
  freight_cost numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE promotions ADD CONSTRAINT promotions_prize_fk FOREIGN KEY (prize_catalogue_item_id) REFERENCES prize_catalogue_items(id);

-- One row per prize slot a promotion has been given a product for (e.g. "1st Place" -> DJI Tello Drone).
-- Slot labels/count come from the promotion's type (promotion_types.prize_slots).
CREATE TABLE promotion_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  prize_catalogue_item_id uuid NOT NULL REFERENCES prize_catalogue_items(id),
  slot_label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE(promotion_id, sort_order)
);

CREATE TABLE warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  jurisdiction_id uuid REFERENCES jurisdictions(id)
);

CREATE TABLE warehouse_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  prize_catalogue_item_id uuid NOT NULL REFERENCES prize_catalogue_items(id),
  soh_qty int NOT NULL DEFAULT 0,
  committed_qty int NOT NULL DEFAULT 0,
  restock_eta_date date,
  UNIQUE(warehouse_id, prize_catalogue_item_id)
);

CREATE TABLE substitution_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_catalogue_item_id uuid NOT NULL REFERENCES prize_catalogue_items(id),
  substitute_item_id uuid NOT NULL REFERENCES prize_catalogue_items(id),
  note text
);

CREATE TABLE freight_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone text NOT NULL,
  min_qty int NOT NULL DEFAULT 0,
  max_qty int,
  rate numeric(10,2) NOT NULL
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id),
  key_account_group_id uuid REFERENCES key_account_groups(id),
  promotion_id uuid REFERENCES promotions(id),
  order_type text NOT NULL DEFAULT 'STANDARD' CHECK (order_type IN ('STANDARD','KEY_ACCOUNT_BULK')),
  po_reference text,
  job_id text,
  status text NOT NULL DEFAULT 'PLACED' CHECK (status IN ('PLACED','PACKED','SHIPPED','DELIVERED','CANCELLED')),
  placed_by uuid REFERENCES users(id),
  discount_rate numeric(5,4),
  freight_charge_id uuid REFERENCES freight_charges(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  prize_catalogue_item_id uuid NOT NULL REFERENCES prize_catalogue_items(id),
  quantity int NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  member_price numeric(10,2) NOT NULL DEFAULT 0,
  warehouse_id uuid REFERENCES warehouses(id)
);

CREATE TABLE order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);

CREATE TABLE warehouse_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES warehouses(id),
  quantity int NOT NULL,
  consignment_ref text,
  courier_name text,
  status text NOT NULL DEFAULT 'PACKED' CHECK (status IN ('PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED')),
  tracking_events jsonb NOT NULL DEFAULT '[]',
  dispatched_at timestamptz
);

-- ============================================================
-- Invoicing / reconciliation -- UC5
-- ============================================================

CREATE TABLE ledger_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric(12,2) NOT NULL,
  is_credit boolean NOT NULL DEFAULT false,
  promotion_id uuid REFERENCES promotions(id),
  order_id uuid REFERENCES orders(id),
  venue_id uuid NOT NULL REFERENCES venues(id),
  description text,
  date_expires date,
  used_id uuid REFERENCES ledger_items(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vendor_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_account_group_id uuid REFERENCES key_account_groups(id),
  jurisdiction_id uuid REFERENCES jurisdictions(id),
  year int NOT NULL,
  month int NOT NULL,
  budget_amount numeric(12,2) NOT NULL
);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id),
  key_account_group_id uuid REFERENCES key_account_groups(id),
  period_month int NOT NULL,
  period_year int NOT NULL,
  po_reference text,
  job_id text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_total numeric(12,2) NOT NULL DEFAULT 0,
  freight_total numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','FINALIZED','EXPORTED')),
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id),
  promotion_id uuid REFERENCES promotions(id),
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  category text NOT NULL CHECK (category IN ('PRODUCT','DISCOUNT','FREIGHT'))
);

-- ============================================================
-- Celebrate-a-Win -- UC7
-- ============================================================

CREATE TABLE win_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id),
  venue_id uuid NOT NULL REFERENCES venues(id),
  prize_amount numeric(10,2) NOT NULL,
  spot_number text,
  win_date date NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','POS_GENERATED','NOTIFIED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pos_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  win_event_id uuid NOT NULL REFERENCES win_events(id) ON DELETE CASCADE,
  template_field_snapshot jsonb NOT NULL,
  format text NOT NULL CHECK (format IN ('PRINT_PDF','DIGITAL_PNG')),
  file_url text,
  previewed_at timestamptz,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  win_event_id uuid REFERENCES win_events(id),
  recipient_user_id uuid REFERENCES users(id),
  recipient_type text NOT NULL CHECK (recipient_type IN ('VENUE','BDM')),
  channel text NOT NULL DEFAULT 'EMAIL' CHECK (channel IN ('EMAIL','SMS')),
  message text,
  status text NOT NULL DEFAULT 'SENT' CHECK (status IN ('QUEUED','SENT','FAILED')),
  sent_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Returns / damaged goods -- UC10 (new, no ZincStore precedent)
-- ============================================================

CREATE TABLE return_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES order_items(id),
  venue_id uuid NOT NULL REFERENCES venues(id),
  reason text NOT NULL CHECK (reason IN ('DAMAGED','FAULTY','WRONG_ITEM','OTHER')),
  notes text,
  quantity_damaged int NOT NULL DEFAULT 1,
  -- Staff-only triage fields (UC10 redesign) -- distinct from the venue-visible `notes` description.
  root_cause text CHECK (root_cause IN ('TRANSIT_DAMAGE','MANUFACTURING_DEFECT','PACKAGING_FAILURE','WAREHOUSE_HANDLING','OTHER')),
  priority text NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH')),
  assigned_to_user_id uuid REFERENCES users(id),
  tracking_ref text,
  customer_notified_at timestamptz,
  status text NOT NULL DEFAULT 'LODGED' CHECK (status IN ('LODGED','IN_TRIAGE','APPROVED','REPLACEMENT_SHIPPED','CREDIT_ISSUED','REJECTED','CLOSED')),
  resolution_type text CHECK (resolution_type IN ('REPLACEMENT','CREDIT','NONE')),
  credit_ledger_item_id uuid REFERENCES ledger_items(id),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE return_case_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_case_id uuid NOT NULL REFERENCES return_cases(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- Free-form staff notes thread on a return case (UC10 redesign) -- separate from the structured
-- status_history timeline below, matching the mockup's distinct Notes vs. History tabs.
CREATE TABLE return_case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_case_id uuid NOT NULL REFERENCES return_cases(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id),
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE return_case_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_case_id uuid NOT NULL REFERENCES return_cases(id) ON DELETE CASCADE,
  status text NOT NULL,
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);

-- ============================================================
-- Ratings / insights -- UC11 (new, no ZincStore precedent)
-- ============================================================

CREATE TABLE promotion_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  is_required boolean NOT NULL DEFAULT false
);

CREATE TABLE promotion_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_survey_id uuid NOT NULL REFERENCES promotion_surveys(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id),
  overall_rating int NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  -- Superseded by promotion_rating_prizes (one star rating per prize within the promotion).
  -- Kept nullable for older rows; the new rating flow no longer collects a single aggregate value.
  prize_rating int CHECK (prize_rating BETWEEN 1 AND 5),
  delivery_on_time boolean,
  comments text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(promotion_survey_id, venue_id)
);

CREATE TABLE promotion_rating_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_rating_id uuid NOT NULL REFERENCES promotion_ratings(id) ON DELETE CASCADE,
  promotion_prize_id uuid NOT NULL REFERENCES promotion_prizes(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  UNIQUE(promotion_rating_id, promotion_prize_id)
);

-- ============================================================
-- Operational reporting / exceptions -- UC12
-- ============================================================

CREATE TABLE exception_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'VENUE_ACTIVE_NO_PROMOTION',
  venue_id uuid REFERENCES venues(id),
  promotion_id uuid REFERENCES promotions(id),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  note text
);

CREATE TABLE support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid REFERENCES users(id),
  venue_id uuid REFERENCES venues(id),
  promotion_id uuid REFERENCES promotions(id),
  order_id uuid REFERENCES orders(id),
  exception_id uuid REFERENCES exception_flags(id),
  issue_type text NOT NULL DEFAULT 'GENERAL' CHECK (issue_type IN ('GENERAL','EXCEPTION','PROMOTION','ORDER','DELIVERY','OTHER')),
  subject text NOT NULL,
  description text,
  resolution_note text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  priority text NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH')),
  assigned_to_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_request_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_request_id uuid NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id),
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_request_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_request_id uuid NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
  status text NOT NULL,
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);

CREATE TABLE venue_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id),
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Activation/deactivation report: computed view, not a stored table.
CREATE VIEW venue_activation_report AS
SELECT
  v.id AS venue_id,
  v.name AS venue_name,
  v.is_active,
  j.name AS jurisdiction_name,
  c.name AS channel_name,
  (
    SELECT count(*) FROM promotions p
    WHERE (p.jurisdiction_id = v.jurisdiction_id OR p.jurisdiction_id IS NULL)
      AND p.status = 'ACTIVE'
      AND CURRENT_DATE BETWEEN p.start_date AND p.end_date
  ) AS active_promotion_count
FROM venues v
JOIN jurisdictions j ON j.id = v.jurisdiction_id
JOIN channels c ON c.id = v.channel_id;
