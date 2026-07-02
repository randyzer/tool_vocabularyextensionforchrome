# Third-party notices

## ECDICT

This product includes data derived from ECDICT:
https://github.com/skywind3000/ECDICT

ECDICT is distributed under the MIT License. A copy of that license is
included at `public/dictionary/LICENSE`.

The runtime dictionary shards are generated from the base `ecdict.csv` and
filtered to single-word entries that are included in Oxford or curriculum
lists, or rank within the first 50,000 entries of ECDICT's BNC or contemporary
frequency data. The pinned ECDICT commit, source URL, and source-file SHA-256
are recorded in `public/dictionary/manifest.json`.

Reviewed entries from `data/custom-words.csv` may override matching ECDICT
entries, and `data/dictionary-blocklist.txt` may exclude reviewed entries.
The application does not contact ECDICT or any dictionary server at runtime.
