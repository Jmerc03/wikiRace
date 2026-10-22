# WikiRace beta on your Windows 11 laptop

Selected path as of October 22, 2026: use the existing home laptop, keep the beta
ad-free, and defer Render. No hosting subscription, domain purchase or public
tunnel has been started. A stable hostname is still required before packaging
the public extension. This setup keeps one API and its own PostgreSQL database
in Docker; the normal local development database is separate.

## Before leaving work

The code and store materials can be prepared now. The remaining physical steps
require your home laptop: check its RAM/virtualization, install prerequisites,
test reboot and sleep behavior, and run two-network multiplayer checks. Container
tests on a Mac do not qualify Windows or your home internet connection.

## Install at home

1. Use a currently supported Windows 11 release, at least 8 GB RAM, hardware
   virtualization enabled, and WSL 2. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
   using its WSL 2 backend and **Linux containers**. Start Docker Desktop and wait
   for its engine. Personal-use licensing is free; review the terms if this is
   later operated as a business. Do not install it on a managed work computer
   for this home deployment.
2. Install [Node.js 24 LTS](https://nodejs.org/en/download) and
   [Git for Windows](https://git-scm.com/downloads/win). Open a fresh PowerShell.
3. Extract the supplied **home-beta source ZIP**, or obtain the verified source
   checkpoint from Git. The branch is
   `codex/ad-free-beta`; confirm it contains `compose.beta.yml` and this guide.
   A checkout of the earlier `50bca40` Render preparation does not include them.
   Keep the checkout in a private local folder outside OneDrive/shared folders.
   If using the ZIP, open PowerShell in its extracted folder and skip cloning.

```powershell
git clone --branch codex/ad-free-beta https://github.com/Jmerc03/wikiRace.git
cd wikiRace
node scripts/home-beta.mjs doctor
node scripts/home-beta.mjs init
```

No host-side `npm install`, PostgreSQL installation or PowerShell script policy
change is required for these commands. Docker builds the app dependencies.
`init` can run before you have a domain. It creates a random database password
and empty tunnel-token file under ignored `.local/home-beta`; rerunning it keeps
the existing password. Keep this folder private. On Windows, file security
depends on your account's folder permissions; Unix modes are not a Windows ACL.
Do not paste either credential in chat or add this folder to Git.

## Choose the address, then start locally

Choose a domain you control and add it to Cloudflare DNS. One domain can use
different subdomains for your future projects. Domain renewal and electricity
remain costs; no annual registration price or service plan has been accepted.
Do not build a store release against a temporary/random tunnel address.

Replace the example below with your actual hostname. Example domains deliberately
fail the configuration check.

```powershell
node scripts/home-beta.mjs configure --origin https://play.example.com
node scripts/home-beta.mjs start
node scripts/home-beta.mjs status
```

Open `http://127.0.0.1:4100/`, `/ready`, `/deployment` and `/privacy` on the laptop.
The beta metadata must identify `home-cloudflare`, your chosen HTTPS origin and
ad-free operation. The privacy page must identify WikiRace and
`jaxmerc03@gmail.com`. The local HTTP page is an operator check; its beta download
is already configured for the chosen HTTPS hostname.

Only port 4100 on loopback is published. PostgreSQL has **no published port**.
Do not forward router ports or expose PostgreSQL. The API applies existing beta
limits and keeps only scoring articles. Finished matches are pruned after 30 days
while the server runs. Keep a single API instance: realtime rooms are in memory.

## Connect the public address when ready

In Cloudflare's dashboard, create a remotely managed tunnel. Add a published
application route for the exact hostname with HTTP service **`http://api:4000`**.
The name `api` resolves inside this Compose network; `localhost` in the tunnel
container would point to the wrong container. Keep the route dedicated to this
app. An interactive Cloudflare Access login in front of the API will prevent
the extension's normal requests unless that integration is separately designed.

Save only the tunnel token in `.local/home-beta/tunnel-token` using a local text
editor. Do not put the token in commands, source, screenshots or support email.
The pinned cloudflared image uses its supported
[`--token-file` option](https://developers.cloudflare.com/tunnel/reference/run-parameters/).
Logs are bounded and use warning level; do not enable debug request-header logs.

The next command starts public access through the route you just configured:

```powershell
node scripts/home-beta.mjs tunnel --confirm-public
node scripts/home-beta.mjs public-check
```

Starting the API alone does not start a new tunnel. Once enabled, the tunnel's
restart policy can restart it with Docker; use `stop` to deliberately take the
whole beta offline. Home internet/ISP restrictions and the actual Cloudflare
plan must be checked in your account. No paid plan is required by this config.

## Daily operation and recovery

Keep the laptop plugged in and ventilated. Configure Windows sleep and lid
behavior deliberately for hosting; a sleeping or disconnected laptop cannot
serve games. The display can turn off. Enable Docker Desktop startup at sign-in
if desired, then test an actual reboot. This package does not enable automatic
Windows login or promise unattended availability after a reboot.

```powershell
node scripts/home-beta.mjs status
node scripts/home-beta.mjs backup
node scripts/home-beta.mjs restore-check "C:\path\to\wikirace-backup.dump"
node scripts/home-beta.mjs stop
```

Use the exact backup path printed by `backup`. The binary PostgreSQL archive is
streamed directly to a file, avoiding PowerShell text-redirection corruption.
Its adjacent JSON file records a checksum. `restore-check` verifies that checksum,
restores to a **new temporary database**, reads game/player/migration counts,
then drops only that temporary database. It never replaces the live database.
A successful restore rehearsal is not a tested whole-laptop disaster recovery.

Back up daily during beta and before updates. Copy the `.dump` and `.dump.json`
privately off the laptop; keep recovery copies of `.local/home-beta` separately.
This version does not schedule or prune backups automatically. Remove manual
copies older than seven days, and account for all copies when handling deletion
requests. Restoring old data also requires reapplying later deletion requests.

For updates, finish active games, make and check a backup, run `stop`, update the
verified source, then `start`, `status`, and explicitly restart the tunnel.
`start` applies committed Prisma migrations. No schema migration was added for
home hosting. `stop` preserves the database volume. Never use `down -v`, Docker's
volume pruning, or delete `.local/home-beta` as an update procedure. Losing the
password file does not reset the password in an existing database volume.

## Gates before inviting testers

- On Windows: initial build, healthy API, authenticated play, backup/restore,
  container restart and full laptop reboot with identities preserved.
- On the real hostname: HTTPS privacy, readiness, download origin/checksum and
  WebSockets. `public-check` checks deployment/package metadata; it is not a
  multiplayer playtest.
- Use two external networks to prove independent client rate limits and verify
  spoofed `X-Forwarded-For` cannot select another allowance. The configured one
  proxy hop still needs this real-edge evidence.
- Two computers: Normal and Lockout, teams, host controls, readiness, timers,
  spectator, scored history, rematch and real Wikipedia navigation; recover
  sessions across browser/server restarts.
- Build the final release with the exact live origin using `npm run release:beta`
  on a checkout with dependencies installed. Check its SHA-256 against the hosted
  download. Follow [the store packet](store/LISTING.md), complete developer
  registration/disclosures, submit and wait for Chrome approval.

The current package is preparation for a small invited beta. The laptop's
measured capacity, internet availability and public security checks remain to
be established before expanding access.
