# Local backup and restore

This procedure uses the selected managed local profile and native PostgreSQL tools. It preserves the original database and restores into a new database before any cutover. Keep the PostgreSQL major version compatible with the archive tooling; the current Mac qualification used PostgreSQL 18.

## Create a backup

```bash
npm run local:backup
```

The command creates a new timestamped directory under `.local/backups`, writes a custom PostgreSQL archive of the selected database’s `public` schema, checks that its archive directory is readable, and records a SHA-256 manifest. Successful backups contain `manifest.json` with `complete: true` and `wikirace.dump`. A failed attempt retains `failure.json` and any partial file; it is not a completed backup. Nothing is overwritten.

The archive includes game history and private session hashes. Its directory and files have restrictive local permissions. Copy the completed directory to storage independent of the machine when you need protection from disk loss; the command itself only creates a local copy. An archive alone cannot reconstruct a private player token lost with an extension profile.

## Restore into a new database

Stop the managed API before changing its selected database. PostgreSQL may remain running.

```bash
npm run local:stop
```

Choose an unused name such as `wikirace_restore_20260908`. `createdb` must succeed; if the name already exists, choose another. Replace the archive path with the completed backup printed above. These POSIX examples use the default local port; use your profile’s port if different.

```bash
createdb -h 127.0.0.1 -p 55432 -U wikirace wikirace_restore_20260908
pg_restore --dbname postgresql://wikirace@127.0.0.1:55432/wikirace_restore_20260908 --clean --if-exists --exit-on-error --no-owner --no-privileges /absolute/path/to/wikirace.dump
```

`--clean --if-exists` is for this **new target database only**, including its default empty `public` schema. Never substitute the original database in that restore command. The original stays available for rollback. Before restoring, compare the archive’s SHA-256 with its manifest (`shasum -a 256 /absolute/path/to/wikirace.dump` on macOS, or `Get-FileHash` in PowerShell).

Select the restored database, apply any newer checked-in migrations, and restart at the same API address:

```bash
WIKIRACE_DATABASE_NAME=wikirace_restore_20260908 npm run setup:local
npm run local:start
npm run local:status
```

In PowerShell, set `$env:WIKIRACE_DATABASE_NAME = 'wikirace_restore_20260908'` before setup, then remove that temporary environment override after setup. The selection persists in `.local/runtime.json`. Supported names begin with `wikirace`, contain only lowercase letters/digits separated by underscores, and have at most 63 characters.

Use the original API origin so existing extension sessions reconnect with their saved tokens. Verify `/ready`, the expected board/roster/outcome, and a known player’s session. Progress after the backup timestamp is outside that backup. Keep the original database until you have accepted the restored state.

## Return to the original database

For the default original database:

```bash
npm run local:stop
WIKIRACE_DATABASE_NAME=wikirace npm run setup:local
npm run local:start
```

Substitute the prior database name if the original profile already selected a different one. No database is deleted by profile selection. Do not run Docker volume removal or `prisma migrate reset` as part of recovery.

## Qualification

`npm run test:backup` creates historical fixture data in an isolated schema, archives it, restores into a uniquely created disposable database, compares all game rows, and authenticates five retained sessions through the compiled API. It also recovers all five original create/join requests using their retained private admission keys, rejects conflicting requests, verifies unchanged restored rows/revisions after replay, and exercises a restored host action without changing the source records. An extension must still retain its original private key; the archive contains hashes, not recoverable plaintext keys.

`node scripts/verify-restore.mjs` verifies the complete managed operator cutover to a restored clone and back. It briefly stops/restarts the operator API, creates one named test game, restores the exact original profile, removes only its own marker and clone, and preserves the original game count. Run this only during a local maintenance window, separately from active play. PostgreSQL remains running, so isolated database tests can continue.

These are local Mac evidence profiles. Docker runtime, native Windows and remote backup storage are not implied by the instructions.
