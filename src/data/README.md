# Meteorite catalogue snapshot

`meteorite-catalogue.json` is a normalized snapshot of the Meteoritical Bulletin Database via [SweetEyesBirb/Meteorite-Landings-Map](https://github.com/SweetEyesBirb/Meteorite-Landings-Map). The mirror identifies its coverage as October 2024. It is not a current official export.

Pinned source file: [CSV at commit 2b2161f](https://raw.githubusercontent.com/SweetEyesBirb/Meteorite-Landings-Map/2b2161f784e63da749835aa524318b8e77199b34/data/meteoritical_bulletin_data_final.csv).

Source SHA-256: `da3f674b23e64f84086273794b71c4c480b4da72963d2f4fb5dc24fc13e2a00f`.

Of 83,625 source entries, retain 76,372 Official, 6,385 Provisional, and 97 Relict* entries (82,854 total). Exclude 771 Pseudo, Doubtful, Crater, Discredited, Undocumented, and Artifact* entries. Preserve naming status separately from Fell/Found status. Preserve Fellp and Foundd without relabelling them as certain falls/finds.

There are 50,951 usable coordinate pairs and 31,903 records without usable locations. Missing, non-finite, out-of-range, and zero-zero placeholder coordinates become null. Do not invent points from country centroids. Shared collection-site coordinates are retained; a catalogue entry is not necessarily an independent impact.

Convert `Mass(kg)` to grams (positive finite values only). Keep the catalogue year, including ancient dates; Found years usually record discovery. Checks: Aachen = 21 g, Chelyabinsk = 1,000,000 g, Hoba = 60,000,000 g. Row identifiers are unique Meteoritical Bulletin codes extracted from the source links. Fields are listed in `meta.fields`; array indices 0–7 match the existing VISITORS catalogue schema, with naming status and place appended.

The existing renderer, archive, and coordinate conversion consume this file. Animation samples one representative trail per batch; regional counts include every mapped record once. The source CSV and detailed validation files are retained in the local `Meteor_Catalogue_20261118` workspace folder.
