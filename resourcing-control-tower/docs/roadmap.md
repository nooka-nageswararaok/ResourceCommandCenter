Resource Fulfilment — Enhancement Roadmap
Phase 1 — Operational Depth (Near-term, high-value)
1. Configurable Fulfilment Action Rules (like PP Rule Config)
The PP module has a full rule-config screen; Fulfilment doesn't. Add a /resource-fulfilment/rule-config page where business users can tune:

SLA days per stage (Profile Sourcing, TP1, TP2, Customer Feedback, Onboarding)
Aging thresholds for Watch/Critical severity
Action flag messages
Customer-specific TP3 toggle (already partially coded in action logic)

2. Demand & Candidate Comments Persistence
RAS and PP already persist PM remarks in comments.json. Extend this to Fulfilment:

Editable remarks on Active Demand heatmap cards
Editable action owner + due date per demand
Remarks visible in snapshot exports and email drafts

Phase 2 — Leadership Intelligence (Mid-term)
4. PM / Hiring Manager Accountability Board (Fulfilment)
Parallel to the RAS PM Accountability view, build a PM-wise fulfilment scorecard:

Open demands, aging >30/60, zero-profile demands, fulfilment %, stale demands per PM
Sortable/filterable — drives weekly review conversations

5. Pipeline Confidence Score
Per-demand composite score based on: pipeline depth (profiles vs. remaining positions), stage velocity (avg days per stage), rejection rate, and billing loss flag. Surfaces "at risk" demands before they cross aging thresholds.
6. Offer & Renege Analytics Dashboard
Dedicated view tracking:

Offer-to-join conversion rate by customer, month, internal vs. external
Renege reasons and patterns (stage code 5.7 already captured)
Repeat-renege candidate detection (if candidate appears across multiple demands)

7. Cross-Demand Candidate Deduplication Flag
Flag candidates appearing in the Candidate Tracker against multiple Legacy Job Req Ids. Helps prevent double-counting in pipeline health metrics and identifies candidates being worked across multiple demands simultaneously.

Phase 3 — Forecasting & Automation (Longer-term)
8. Demand Closure Forecasting
Based on Trend Dashboard historical data (new demands, open demands, onboarding counts), project expected closures for the next 1–3 months per customer group. Simple linear extrapolation is sufficient given the offline/Excel context.
9. SLA Breach Desktop Notifications
Use Electron's Notification API to surface Windows toast alerts for:

New critical-aging demands since last refresh
Demands crossing zero-profile threshold
Stage SLA breaches detected on refresh

10. Fulfilment + RFS + PP Combined Action Sheet
The RFS-to-PP connection is partially built (Total Revenue flag). Extend this into a cross-module leadership sheet:

Demands where billing loss + weak RFS pipeline → revenue risk
Low GM% customers with high unfulfilled demand aging → combined flag
Exportable as an additional sheet in the weekly snapshot


Structural / Quality Enhancements (Ongoing)

12. Comment Export/Import Round-trip
Add clear/export/import controls for comments.json (already listed as a known gap). Allows a team lead to export remarks, share via email, and import on another machine — meaningful given the offline, no-backend architecture.
