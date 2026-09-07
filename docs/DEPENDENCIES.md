# Dependency review — 2026-09-07

The local delivery retains Prisma/client 6.19.3 and the existing Fastify 5 architecture. Compatible dependency fixes update Fastify, routing/URI parsing, and WebSocket packages. The extension bundler and tsx loader use patched esbuild 0.28.2. Full builds, Prisma generation/validation/migrations and real database/browser suites validate these changes.

Prisma's configuration helper pins deepmerge-ts 7.1.5, affected by [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). The root override selects upstream 8.0.0. Prisma uses this during developer configuration merging; plain JSON cannot construct the advisory's recursive-object trigger. The patch is still adopted and tested rather than relying solely on that limited reachability.

npm 11.12.1 can drop overrides reached only through workspace links, matching [npm/cli #9659](https://github.com/npm/cli/issues/9659). Prisma CLI therefore belongs to root development tooling and API scripts resolve that same installation. `npm ls deepmerge-ts` must show `8.0.0 overridden`. An override declaration without the matching installed/locked version is not proof of remediation.

No Prisma downgrade, preview major release, manual node_modules patch, or global npm replacement is used. Revisit the override when Prisma's supported configuration dependency adopts the upstream fix. The retained audit result is `.jes/local/ewp-004/audit-final.json`; final clean-install verification is recorded in the EWP closeout.
