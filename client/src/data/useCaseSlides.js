// Static content sourced from the client's RFP deck
// ("Keno RFP Presentation_Use Case Slides.pptx") -- one entry per use case slide,
// used to power the in-app "Use Case Slides" walkthrough page.
export const useCaseSlides = [
  {
    uc: 1,
    title: "Content Scheduling",
    route: "/content",
    useCases: [
      "Personalised and individual content scheduling for individual venues, key account groups, jurisdictions or channel type (eg. hotels/bowls club/Clubs etc.) such as jurisdictional posters, responsible gambling POS.",
      "Ability to set targeted content to individual venues, key accounts groups, channel and jurisdiction.",
    ],
    scenario:
      "It is a requirement and future strategy to schedule and deliver content to venues dependent on legislation (eg. Responsible Gambling) or promotions or content that may only be available to certain jurisdictions or channels.",
  },
  {
    uc: 2,
    title: "EDM / Newsletters",
    route: "/edm",
    useCases: [
      "Monthly newsletter is sent to venues or jurisdictions or channel type (eg. hotels/bowls club/Clubs etc.).",
      "Ability to send targeted content to individual venues and jurisdiction.",
    ],
    scenario:
      "A content author publishes new content (e.g., new promo assets or how-to guide) and triggers a targeted EDM to selected audiences (jurisdiction/channel/key account). The EDM includes an overview and deep links to relevant items. The send is recorded against the venue/account in Salesforce (or exported for ingestion if direct write-back is not available).",
  },
  {
    uc: 3,
    title: "Venue Groups",
    route: "/venue-groups",
    useCases: [
      "Create a bespoke venue group for a promotion, then communicate and report to that group.",
    ],
    scenario:
      "An internal user creates a custom group of venues for a bespoke promotion (e.g., pilot, event, or key account activation). The user assigns eligibility rules (opt-in/opt-out if needed), publishes a dedicated promo pack for that group, and sends a targeted communication. Reporting is available at group level (orders, participation, fulfilment status).",
  },
  {
    uc: 4,
    title: "Promotions",
    route: "/promotions",
    useCases: [
      "Edit a promotion after setup (date change / asset update) with controlled impact.",
    ],
    scenario:
      "A venue (or internal user) sets up a promotion and later needs to change start/end dates and/or selected prize/POS. The platform allows edits up to a defined cutoff (e.g., day prior), automatically updates dependent items (POS artwork dates, T&Cs references, print quantities) and maintains an audit trail of changes.",
  },
  {
    uc: 5,
    title: "Invoicing",
    route: "/invoices",
    useCases: ["Promotion invoicing and reconciliation."],
    scenario:
      "Internal users generate monthly invoices (or downloadable statements) with a breakdown by venue, promotion, discounts and freight. Data can be exported for finance reconciliation and includes supporting references (PO/job ID where applicable).",
  },
  {
    uc: 6,
    title: "Key Accounts",
    route: "/key-accounts",
    useCases: [
      "Key Account group promotion with bulk ordering and bespoke requirements.",
    ],
    scenario:
      "A Key Accounts user creates a promotion for a defined key account group requiring bulk quantities, bespoke branding, and potentially discounts. The platform supports group eligibility, differentiated prize packs, and reporting by key account group and venue.",
  },
  {
    uc: 7,
    title: "Celebrate-a-Win",
    route: "/celebrate-win",
    useCases: [
      "Celebrate-a-Win automation (dynamic POS generation + notifications).",
    ],
    scenario:
      "When a qualifying prize is won, the system generates venue-specific POS (print-ready and digital) using dynamic placeholders (venue name/logo, date, prize amount, spot number, jurisdiction messaging). Assets are made available for download, and automated notifications are sent to the venue and BDM. A preview is available before printing.",
  },
  {
    uc: 8,
    title: "Prize Catalogue & Orders",
    route: "/catalogue",
    useCases: [
      "Prize catalogue ordering with live stock visibility, substitution and delivery tracking.",
    ],
    scenario:
      "A venue browses the prize catalogue, filters/sorts (category, tier, price, event), checks live stock availability, and places an order. If stock is low/unavailable, the platform provides ETA and/or substitution options. The venue can track delivery status, including split shipments.",
  },
  {
    uc: 9,
    title: "Approvals",
    route: "/approvals",
    useCases: [
      "Promotion approvals and compliance controls (jurisdiction-aware).",
    ],
    scenario:
      "A venue drafts a promotion and submits it for approval. Internal approvers review the promotion, including mandatory compliance content (RG messaging, disclaimers) based on jurisdiction. Approvals are recorded with version control; any material changes re-trigger approval.",
  },
  {
    uc: 10,
    title: "Returns",
    route: "/returns",
    useCases: ["Damaged goods / returns management with resolution tracking."],
    scenario:
      "A venue receives a damaged item and lodges a return/replacement request through the platform with photos and notes. The request is triaged, tracked, and resolved (replacement shipped / credit issued). Status updates are visible to the venue and internal teams.",
  },
  {
    uc: 11,
    title: "Ratings & Insights",
    route: "/ratings",
    useCases: [
      "Post-promotion rating and insights (including venue benchmarking view).",
    ],
    scenario:
      "After a promotion ends, the venue is prompted to rate the promotion and prizes. Internal users can view aggregated feedback and compare outcomes across venues/groups (e.g., participation, on-time delivery, rating). Reports can be exported for wider analysis.",
  },
  {
    uc: 12,
    title: "Operational Reporting",
    route: "/reporting",
    useCases: [
      "Operational reporting and exception management (activation/deactivation + support intake).",
    ],
    scenario:
      "The platform produces automated operational reports (e.g., activation/deactivation lists) and flags exceptions (e.g., venue appears active but has no current promotion). Venues and internal users can raise support requests linked to the relevant promotion/order.",
  },
];
