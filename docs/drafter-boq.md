# Drafter and room BOQ

## Delivery status

- Implemented in the local workspace on 2026-10-01.
- Account `muhammadrifaldi711@gmail.com` (UID `DrKbdoeUq7h6hTCP8ER6tP42Xgs1`) has a confirmed Firestore profile write setting `role: drafter` and a verified Firebase Auth custom claim `role: drafter`.
- Existing profile fields and other custom claims were preserved.
- Firebase Admin service-account authentication failed with Invalid JWT Signature. The account update succeeded through the existing Firebase CLI OAuth login.
- Frontend, security rules and Go backend changes have not been deployed. The user explicitly chose to keep these changes local.
- 2026-10-21: per-equipment Update BOQ with field check, built from "Progres BOQ TERBARU 1.xlsx" (see below). Needs `firestore:rules` deployed before hosting, because the app now writes `checked`. Same day: confirmation pop-ups for "Ada" / "Tidak ada" and corrections in both directions.

## Interface

Drafter sees exactly two modules: Management File and Update BOQ. The general AI widget and other dashboards are excluded.

Update BOQ is organised per equipment (one workbook sheet), coloured like the workbook tabs:

| Tab | Status | What the drafter does |
| --- | --- | --- |
| Merah | Cek ke lapangan | Check every item on site: "Ada" marks it checked, "Tidak ada" deletes it (both with confirmation, both correctable). |
| Kuning | Cek kembali | Same as red. |
| Biru | Samakan data Habib | Data is not yet equal to Habib's fixed data, which will follow. Edit and photos only; no delete. |
| Ungu | Fix | Data is final. Full access as before (edit, photos, delete). |

1. Overview: one section per colour, red first, then yellow, blue and purple; categories added in the app that are not a sheet come last ("Item tambahan"). Red/yellow cards show a progress bar ("x belum dicek · y ada · z dihapus"); the section heading sums it ("2/434 item sudah dicek"). Typing in the search shows matching equipment and matching assets (name, S/N, TAG, room, Excel note, any BOQ column).
2. Equipment page: the colour's instruction, progress (red/yellow), a search, a room filter (each room shows how many items are still unchecked) and filter chips. Red/yellow sheets open on "Belum dicek"; the other chips are "Ada", "Semua" and "Dihapus". Purple/blue sheets show "Semua" / "Dihapus" once something was deleted. Sheets with a second table (Genset & Fuel System, Load & Cap Bank, Lift & Dock Level) list it under its own heading. 40 rows load at a time. Rows on red/yellow sheets carry "Ada" (or "Batal ada" once checked) / "Tidak ada" / camera buttons; others a camera and (except blue) a delete button.
3. "Ada" and "Tidak ada" open a confirmation showing the item's name, equipment, room, S/N/TAG/capacity and Excel note; "Batal" has the focus. A wrong mark can be corrected at any time:
   - Marked "Ada" by mistake: "Tidak ada" stays available (the pop-up says the item was marked Ada; deleting clears the Ada mark), and "Batal ada" returns it to "Belum dicek" without a pop-up.
   - Marked "Tidak ada" by mistake: the "Dihapus" chip lists deleted items with who deleted them and when, with "Ternyata ada" (restore and mark Ada, with confirmation) and "Kembalikan" (restore to "Belum dicek").
   - Every change shows a toast with "Batalkan" that returns the item to its previous state. A newer change to the same item replaces that toast, so an outdated "Batalkan" cannot be pressed.
4. Each item shows its Excel note ("Catatan Excel"), the remark next to QTY in the workbook such as "Panel tidak ditemukan", "double dengan no 6", "PERUBAHAN NAMA MENJADI …". Notes that say an item is missing or duplicated are red.
5. Item page: status banner, Excel note and, on red/yellow sheets, "Unit ini ada di lapangan? Ada / Tidak ada"; then photos first, then the editable data. "Ambil foto" opens the same live camera as the engineer reports (`CameraModal`: watermark with asset name, room, time and GPS; Ulangi / Download / Pakai Foto), with `fullResolution` so it asks the camera for up to 4096×3072 and keeps "Kamera HP" photos at full size. "Upload" picks files from the gallery. The original workbook values are not repeated there; the Excel export keeps every other BOQ column in "Data BOQ lainnya". The editor fills the screen on small devices, supports Escape, and blocks closing during a save/upload.

CI Name, CI Description, Capacity, Serial Number, Production Year, Manufacturer / Principle, Asset ID, TAG and Model/Version are editable, as far as the item's BOQ table has that column (CI Name always). Items whose text differs from the workbook carry a "Diedit" badge, and edited cells are highlighted in the Excel export. File Management uses the existing files collection and excludes corrective-report aggregation. Upload/download and requests to QC for file deletion remain available; permanent deletion remains a QC action.

Export Excel writes one worksheet per equipment in workbook order, with the sheet's own columns and tab colour, plus "Ruangan (aplikasi)", "Status cek" (red/yellow: Ada / Belum dicek / Tambahan), "Catatan Excel" and the photos. A second table in a sheet gets its own title and header row. The first worksheet "Ringkasan" lists per equipment: status, items, Ada, Belum dicek, Dihapus, items with photos. "Item Dihapus" lists deleted items with who deleted them and when.

## Source data

Source: `Progres BOQ TERBARU 1.xlsx` (the updated "Progres PM Q3 - 2026"), imported on 2026-10-21. The earlier import (2026-10-05, Google Sheets `1WGV1Mr9Zv0mG4OdQuU6XH8gOsVcHdH1V`) had the same 41 tables and 2,652 item IDs; only Grounding rows 139/140 ("Perubahan CI Name" swapped) and the two hyperlink names below changed, so saved edits and photos stay attached.

- Imported: the 38 equipment sheets (Trafo … Lighting), 41 asset tables, 2,652 items.
- Tab colour → status (`STATUS_BY_TAB` in the importer): `FF7030A0` fix (27 sheets), `FFFF0000` cek-lapangan (LV Panel, Grounding, LDB-RDB Panel, PREACTION, Water Softener, STP & Plumbing, Pompa), `FF00B0F0` samakan-habib (Genset & Fuel System, Exhaust Fan, CT Water Treatment), `FFFFC000` cek-kembali (Physical Cooling Automation & T). A sheet with an unknown or missing tab colour stops the import.
- Excel note: text in the columns right of PM DATE/QTY under a numeric or empty heading, up to the first labelled PM column (240 items). "Report on Process" (PM progress) is skipped.
- Hyperlink cells with rich text (LDB-RDB Panel rows 100/101) are read as text: "PB ORG OFF 2", "PB.CC.2" (previously "[object Object]").
- Not imported: the planning sheets Progress MOS & Instal CM, consumable parts 2026, Plan ManPower Agu/Sep, Progress, Resume Q3, 2026 Schedule and Sheet1; and in every sheet the PM block from the `PM DATE` column to the right (QTY, progress, Dokumen Service Report OCS/TDE, TOTAL, STATUS, REMARK).
- Each sheet's asset table starts at its header row (`No` plus `Class Id`/`CI Name*`). A later header row in the same sheet starts a second table (Genset → Fuel System, Load Bank → Cap Bank, Lift → Dock Leveler). A row carrying its own `PM DATE` heading starts a titled block (Water & Fuel Leak → Fuel Leak).
- The signature block (`Cikarang, …`, `Disiapkan oleh`, …) ends a sheet. In FSS, the rows after `Note : Tidak termasuk dalam BOQ` are therefore excluded.
- Sheets that repeat the same assets per month (Lift: July/August/September; CT Water Treatment: Juli/Agustus/September) keep only the first month block.
- Vertical merges propagate their value to every row. A vertically merged CI Name means the row is another module of the item above (UPS); its values are joined as extra lines on that item and its row number is kept in `sourceRows`.
- Sheets without a CI Name column name the asset in Class Id (or CI Description). Columns with a numeric or empty header right before `PM DATE` are progress helpers and are dropped; other unlabeled columns with data are kept as `Kolom <letter>`.
- Room is the sheet's `Room` column. When a sheet has no Room column or it is empty/`N/A`/`-`, the room is looked up in the earlier "BOQ PER RUANGAN" workbook by CI Name, used only when that name maps to exactly one room (1,079 items). The page marks these items with a door icon; the original Room cell is left unchanged. 760 items remain without a room.
- Rooms are grouped ignoring case, spaces, hyphens, a leading `1F` prefix and a few typos (CHILER, TRAFOO, INTERCONECTING, KORIDOOR), so "Crac Room 1", "1f crac room 1" and "1F-CRAC ROOM 1" are one room (278 spellings → 222 rooms). Each room is labelled with its most common spelling; all-lowercase names are re-cased.
- Stable ID: `boq-v2-{sheet key}-{sourceRow}`, e.g. `boq-v2-lv-panel-7`. Items added in the app use `boq-v2-custom-{32 hex}` and may carry a `category`.

The generated baseline is `frontend/data/boqItems.json` (tables with column definitions, status and tab colour; items with positional values and the Excel note). Regenerate with `node scripts/import-boq.cjs "<path to Progres BOQ TERBARU 1.xlsx>"`; the room lookup reads `scripts/data/boqRoomItems.v1.json` (the former v1 baseline). Do not regenerate from a workbook whose rows were reordered without a migration, because IDs are row-based.

Firestore documents of the former v1 baseline (`room-v1-room-*`, `room-v1-no-room-*`) and their photos are no longer listed. Custom items created under v1 (`room-v1-custom-*`) still appear, under "Item Tambahan".

## Firestore

`boq_items/{itemId}` stores only edited text, source identity, revision, updatedBy and server updatedAt. The initial workbook is bundled locally; opening the page never seeds 2,652 documents. Overrides are fetched only for listed items not fetched before (in batches of 30 IDs); "Muat ulang" clears them.

All writes go through the offline outbox (see below); the stored `revision` must increase by exactly one, which the rules enforce together with immutable source identity. `updatedByName` records who saved last, for the conflict screen and the deleted list.

Field check: `checked: true` marks an item confirmed on site ("Ada"); "Tidak ada" sets the existing `deleted: true` tombstone and clears `checked`; "Kembalikan" writes the document again without either, "Ternyata ada" without `deleted` and with `checked: true`. These flag-only changes (`queueBOQFlags`) keep the base and fields of a text edit still queued for the same item. While Update BOQ is open, two listeners follow the documents with `checked == true` and with `deleted == true` for the progress counts, so other drafters' work shows up live; those documents are not read again per list. The first listen costs one read per document; a listener resumed within 30 minutes (persistent cache) is billed only for changed documents, unlike a repeated query. In the outbox, `checked` is set only by an explicit change and otherwise keeps the server value, and restore is its own `restore` flag, because queued edits from earlier versions carry `deleted: false` without meaning "restore". Clients still on an older version rewrite a document without `checked`, so drafters should take the app update ("Perbarui Sekarang") after deploy.

Photos are separate immutable documents at `boq_items/{itemId}/photos/{sha256}`. They can exist before the baseline item's first text edit. There are no photo arrays or base64 images in the item document. Photo metadata is read 20 records per page. Photo writes do not change the text revision.

Search covers the source inventory plus edited values already loaded in the current browsing session. It is not a global full-text search over unloaded Firestore overrides.

## Offline outbox (weak signal)

Drafters work where the signal drops or lags (Android + Chrome). `frontend/utils/boqOutbox.ts` makes every change local-first:

- Text edits, item creation/deletion, photo uploads and photo deletions are stored in IndexedDB (`dwimitra-boq-outbox-v1`) first, so a save never fails in front of the drafter. The browser is asked to keep this storage (`navigator.storage.persist`).
- `DrafterApp` starts the sync engine after login. It sends while the app is open on any tab, retries with backoff (5 s doubling to 5 min), and resumes immediately when the browser goes online. Requests time out (20–60 s) instead of hanging on a lagging link.
- There is no global status bar (removed at the team's request). Assets show "⏳ Belum terkirim" or "⚠️ Bentrok". Logging out or closing the tab with queued work shows a warning; the queue stays on the device and continues after the same account logs in again.
- Photos (option agreed with the team): original resolution, re-encoded as JPEG quality 85% (the original is kept if that is not smaller), max 10 MB after compression, plus a 360 px thumbnail (~10–40 KB) stored in the photo document. Uploads go in 256 KB chunks, two at a time; finished chunks are recorded, so an interrupted upload resumes from the first missing chunk. The photo document (manifest) is written last and the SHA-256 ID keeps retries idempotent. Photo lists show thumbnails; the full image is downloaded only to view, download or crop.
- Text conflicts: each queued edit keeps the version the drafter started from. Before writing, the engine reads the server version and merges per field. Fields changed by only one side are combined automatically; a field changed differently by both becomes a conflict, shown in the editor with both values, who changed it and when. Nothing is sent until the drafter chooses. Photos never conflict.
- Unsaved text in the form is also kept as a localStorage draft and restored when the item is reopened.
- Verified with a flaky fake backend (40% failed requests): saves arrive, per-field merge and conflicts behave as above, a 7.9 MB 4000×3000 photo became 2.5 MB at 4000×3000 and uploaded in 11 chunks over 15 attempts, and a queue created offline was delivered after the browser was closed and reopened.

Drafter routine: open the app once with good signal (or install it via "Add to Home screen") so it works offline, and after leaving the area keep it open until no asset shows "⏳ Belum terkirim".

## Authorization

Firestore blocks Drafter access to unrelated authenticated collections, while preserving existing public reads. Drafter can read its own profile, manage the allowed files operations, submit file deletion notifications to QC, and access BOQ.

Storage BOQ authorization uses signed role claims and does not perform Firestore profile reads. Role provisioning must update both the profile and the Auth claim. The role assignment script and backend role update do this. New claims require login/token refresh.

Backend supports Drafter as an allowed role, preserves unrelated custom claims, prevents login sync from resetting roles when profile reads fail, and restricts Drafter access to unrelated HTTP and voice APIs.

## Compilation and rollout

- TypeScript compile check: `node node_modules/typescript/bin/tsc --noEmit --ignoreDeprecations 6.0`.
- Production frontend: `npm run build:prod`.
- Backend: `go build ./...` from `backend`.
- Rules compiled using Firebase Rules API without creating a ruleset or release.
- A CLI dry run initially failed due a serviceusage.googleapis.com connection timeout; direct rules compiler validation succeeded.
- No live BOQ edits or photo uploads were performed.
- Firestore quota exhaustion still prevents reads/transactions. The interface reports failed saves and preserves local work; this feature does not bypass Firebase quota.
- Deploy after rollout approval, rules first: `firebase deploy --only firestore:rules --project report-utt`, then `firebase deploy --only hosting --project report-utt`. A new frontend on old rules gets every "Ada" rejected (it stays queued on the phone and is retried). Deploy the Go backend through its normal release process.
