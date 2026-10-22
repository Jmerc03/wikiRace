# Ad-free beta preparation — delivery review

Date: 2026-10-22. Engineering preparation: complete under WR-EWP-016 r1.
Public deployment and product-owner acceptance: pending. Owner: Jaxson Mercer.

The user redirected work from the daily challenge to an ad-free beta, selected
Render and supplied jaxmerc03@gmail.com for public support. Extension 1.10.0
preserves all earlier multiplayer features. A new hosted profile limits traffic,
connections and saved games, stores only articles earning squares, and deletes
finished results after 30 days. Local data behavior stays unchanged. The beta
ZIP uses one HTTPS game server and only storage/alarms plus required hosts.

The Render blueprint, privacy policy, store text, icons, actual UI screenshots,
optional original promotional art, release preflight and deployment/backup/
rollback runbook are prepared. The release command requires live beta readiness,
privacy and exact hosted/local package identity. No real upload candidate is
issued before a real hosted origin is available. Test candidates under ignored
evidence folders are explicitly simulations.

Evidence: full build; 55 unit, 86 PostgreSQL/HTTP/WebSocket and 41 actual Chromium
checks; forced-worker and bounded database-stall recovery; clean installation,
Prisma generation and beta build; reproducible local ZIP; positive and mismatch
release CLI rehearsals; official Render schema validation; zero production npm
audit findings. The beta Chromium profile uses a local HTTPS proxy and synthetic
Wikipedia content. It proves neither Render's edge behavior nor live-site access.
The final screenshot-only fixture refinement also passed its targeted browser
check. Store images and privacy layout were visually inspected.

The managed local API was restarted on the checked build. It is ready at
http://127.0.0.1:4000, serves the matching 1.10.0 local package, and retains exact
original row hashes and all thirteen migrations. The original database had zero
game rows; all owned test schemas were removed. Reload installed extensions to
use the updated local build. No user Chrome profile was changed.

The first hosted CI execution remains pending. The workflow prepares Ubuntu,
Node 24.15.0 and PostgreSQL 16 checks with read-only repository permissions and
pinned actions. No Render resources, billing, public code push, extension
publication or Chrome approval is represented by this review. The remaining
steps are exact-source push, account/provisioning, real two-network play and proxy
attribution, managed database restore, and private Chrome submission/review.

See [launch guide](../docs/BETA_LAUNCH.md), [store packet](../docs/store/LISTING.md)
and [evidence index](evidence/BETA_20261022.json). Historical local acceptance is
unchanged. JES Core reporting remains pending because its local API was unavailable;
no Core execution or human approval has been fabricated.
