# Notebooks site: notes for Claude

Public repo, served by GitHub Pages at https://stevennoyce.github.io/notebooks/. It's a password-locked reader for the user's private Obsidian vaults.

## How it works
- **Viewer:** `index.html`, one self-contained file plus `marked.min.js` (marked v15, vendored). Hash routes:
  - `#/`: notebook picker
  - `#/<id>`: a notebook's home
  - `#/<id>/n/<path>`: a note (`?h=` jumps to a heading, `?hl=` highlights a term)
  - `#/<id>/t/<tool>`: a tool
  - `#/<id>/s?q=`: search
- **Packer:** `pack.mjs` (Node 20+, no dependencies). Each vault's own Action clones this repo with a write deploy key, runs the packer and pushes. It reads `<vault>/site.json`, which lists the notebook's excluded paths, folder order and icons, tools (HTML pages with `inline` script substitutions, or an `ics` subscribe card) and `codeLinks`.
- **Encryption:** AES-256-GCM, with the key from PBKDF2-SHA256 (600k iterations, salt `notebooks-v1`). The IV is derived from the content, so rebuilding unchanged notes gives the same file. `SALT`, `ITERATIONS` and `MAGIC` must match in `pack.mjs` and `index.html`.
- **One passphrase for every notebook:** the `SITE_PASSPHRASE` secret, the same value in each vault repo. The browser can remember the derived key (`nb:key` in localStorage). To change the passphrase, set the new value in every vault repo and re-run each publish workflow.
- **Checkmarks are per device** (`nb:checks:<id>:<path>` in localStorage) and never write back to a vault. The site is read-only by design (the user chose this on 2026-09-26).
- **Dataview:** the viewer runs a subset of `TABLE` queries: FROM, WHERE (`=`, `!=`, bare field, `!field`, joined with AND), SORT, LIMIT and GROUP BY with `length(rows)` or `length(filter(rows.x, (d) => d))`. Anything else shows an "only in Obsidian" note.
- **Tool pages** run in a `srcdoc` iframe. They can open a note with `parent.postMessage({ openNote: "Title" }, '*')`.

## Notebooks published here
| id | vault repo (private) | deploy key title |
|---|---|---|
| `dates` | stevennoyce/date-nights | `date-nights action` |
| `home-education` | stevennoyce/home-education | `home-education action` |

To add a vault:
1. Add a `site.json` to it.
2. Generate an ed25519 key. Add it here as a write deploy key, and store the private half as `NOTEBOOKS_DEPLOY_KEY` in the vault repo.
3. Set `SITE_PASSPHRASE` in the vault repo.
4. Copy the publish workflow from `home-education/.github/workflows/publish-site.yml`.

## Testing locally
Run `SITE_PASSPHRASE=test node pack.mjs --vault ../dates --out .`, then `python3 -m http.server`. **Never commit a locally packed `vault.bin`**, since it would be encrypted with the test passphrase. Delete the `<id>/` folders and reset `projects.json` to `[]` first.
