# Notebooks

A password-locked web reader for our Obsidian vaults: https://stevennoyce.github.io/notebooks/

- `index.html` is the whole viewer: lock screen, notebook picker, notes, search, tools, per-device checkmarks, and a small Dataview subset.
- `pack.mjs` is run by each vault's GitHub Action. It encrypts that vault (AES-256-GCM, key from the passphrase via PBKDF2) into `<id>/vault.bin` and updates `projects.json`.
- Everything under `<id>/` is encrypted. Only the notebook names and taglines in `projects.json` are public.

See `CLAUDE.md` for how the pieces fit together.
