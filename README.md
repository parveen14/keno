# Keno — RFP Demo (Node/Express + React + Postgres)

Sales demo covering the 12 use cases on Tab "5. Use Cases" of the RFP workbook. Architecture rationale and ZincStore mapping: see `.claude` plan history, or ask for a recap. This file is just the run book.

## Start it up

```bash
docker compose up -d                              # Postgres on :5432
cd server && cp .env.example .env                  # first time only
npm run db:reset                                   # applies schema.sql + seed.sql (safe to re-run any time)
npm run dev                                         # API on :4000
```

In a second terminal:

```bash
cd client
npm run dev                                         # UI on :5173
```

To reset the demo data back to pristine between rehearsals: `cd server && npm run db:reset`.

## Logging in

Login screen has one-click "quick demo login" buttons per seeded persona — no password needed. Roles: `ADMIN` (Alex Morgan), `BDM` (Jordan Blake / Casey Lane), `APPROVER` (Morgan Riley / Taylor Quinn), `VENUE` (Dana Reed, Priya Nair, Mia Chen, Zoe Marsh). Password for direct email/password login on any seeded account is `password123`.

## Click-path per use case

| UC | Page | Live action to demo |
|---|---|---|
| 1 | Content Scheduling | Open "NSW RG Messaging Poster" → Schedule targets → shows existing venue/KAG/jurisdiction schedules; use the compliance window check to pick "The Anchor Hotel" and show all 3 rules resolving |
| 2 | EDM / Newsletters | New campaign → pick audience → Send now → check Send log tab for the mocked Salesforce entries |
| 3 | Venue Groups | Open "Bowls Clubs Pilot Group" → flip an INVITED venue to OPTED_IN/OUT → group-level report updates live |
| 4 | Promotions | Open "Spring Jackpot Poster Campaign" (DRAFT) → demo edit → Submit for approval |
| 5 | Invoicing | Generate invoice for a venue/month with existing orders → Finalize → Export CSV |
| 6 | Key Accounts | Select a key account group → member venues + promotions |
| 7 | Celebrate-a-Win | Open "The Anchor Hotel — $5,000" (PENDING) → Generate print/digital POS → Preview → Notify venue + BDM |
| 8 | Prize Catalogue / Orders | Try ordering "Drone Starter Kit" (out of stock) → use suggested substitute → place order → jump to Orders & Delivery → simulate dispatch advance; open PO-1005 for the split-shipment view |
| 9 | Approvals | Submit UC4's promotion above, then Approve/Reject it here — RG compliance text shown inline; Approval audit report tab has history |
| 10 | Returns | Open "Air Fryer — Gold Coast Club" (IN_TRIAGE) → attach a photo → move through Approved → Credit Issued/Replacement Shipped |
| 11 | Ratings & Insights | Sign in as a venue (e.g. Mia Chen) → Submit a rating against the open QLD survey → sign back in as Admin → Aggregated insights tab |
| 12 | Reporting | Activation report tab; Exceptions tab has one pre-flagged venue + a live "Scan for new exceptions" button; Support requests tab to raise/comment/resolve |

## Notes for whoever runs the next demo

- All 3rd-party integrations (Salesforce, courier tracking, print pipeline) are mocked with realistic Postgres data — nothing calls out to the internet.
- If Docker Desktop isn't running, `docker compose up -d` will fail with a clear connection error — start Docker Desktop first.
- `.claude/launch.json` (in your home directory, not this repo) is wired for the Claude Code browser preview tool if you're iterating with an agent; it's not needed to just run the app normally.
