# Notebooks

A password-locked web reader for our Obsidian vaults: https://stevennoyce.github.io/notebooks/

This repo is **built output**. It's published by the workflow in the private repo `stevennoyce/notebooks-source`, where the viewer's source (`site/`) and the notebooks live. Don't edit it by hand: the next publish overwrites it.

- `index.html` is the whole viewer: lock screen, notebook picker, notes, search, tools, per-device checkmarks, and a small Dataview subset.
- `<id>/vault.bin` is each notebook, encrypted (AES-256-GCM, key from the passphrase via PBKDF2). Only the notebook names and taglines in `projects.json` are public.
