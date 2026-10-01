# Drafter and room BOQ

## Delivery status

- Implemented in the local workspace on 2026-10-01.
- Account `muhammadrifaldi711@gmail.com` (UID `DrKbdoeUq7h6hTCP8ER6tP42Xgs1`) has a confirmed Firestore profile write setting `role: drafter` and a verified Firebase Auth custom claim `role: drafter`.
- Existing profile fields and other custom claims were preserved.
- Firebase Admin service-account authentication failed with Invalid JWT Signature. The account update succeeded through the existing Firebase CLI OAuth login.
- Frontend, security rules and Go backend changes have not been deployed. The user explicitly chose to keep these changes local.

## Interface

Drafter sees exactly two modules: Management File and Update BOQ. The general AI widget and other dashboards are excluded.

Update BOQ provides room and Class Id filters, CI Name, CI Description, Capacity, and a photo/edit action beside each row. On small screens, rows become cards and the editor fills the screen. The editor traps keyboard focus, supports Escape, and blocks closing during a save/upload.

CI Name, CI Description, and Capacity are editable. Room, Class Id, source sheet/row, model and floor identify the original item. File Management uses the existing files collection and excludes corrective-report aggregation. Upload/download and requests to QC for file deletion remain available; permanent deletion remains a QC action.

## Source data

Source: `D:/Users/Downloads/BOQ PER RUANGAN (1).xlsx`.

- ROOM: 1,680 actual CI records.
- NO ROOM: 679 actual CI records.
- Total: 2,359 CI groups, preserving 2,415 source detail rows.
- Stable ID: `room-v1-room-{sourceRow}` or `room-v1-no-room-{sourceRow}`.
- Merged grouping cells resolve to their masters. Vertically merged CI Name cells do not generate duplicate parent item records. All 56 continuation rows contain UPS module descriptions; these are joined as separate description lines on their parent CI, with their source row numbers retained. Thus 2,359 CI groups preserve all 2,415 source detail rows.
- Repeated CI names in different rooms or source rows remain distinct.

The generated baseline is `frontend/data/boqRoomItems.json`. Regenerate only from this source/version using `node scripts/import-room-boq.cjs`. Changing the workbook structure requires an explicit migration; do not reuse row-based IDs for a reordered replacement workbook.

## Firestore

`boq_items/{itemId}` stores only edited text, source identity, revision, updatedBy and server updatedAt. The initial workbook is bundled locally; opening the page never seeds 2,359 documents. Each displayed page requests at most 20 item overrides.

Saves use a transaction with the revision that was loaded for editing. If another editor changes the record, the revision check fails and the user's draft remains visible. The user explicitly reloads the latest version. Rules enforce the same revision increment and immutable source identity.

Photos are separate immutable documents at `boq_items/{itemId}/photos/{sha256}`. They can exist before the baseline item's first text edit. There are no photo arrays or base64 images in the item document. Photo metadata is read 20 records per page. Photo writes do not change the text revision.

Search covers the source inventory plus edited values already loaded in the current browsing session. It is not a global full-text search over unloaded Firestore overrides.

## Photo uploads and recovery

Objects: `boq_photos/{itemId}/{sha256}`.

- JPG, PNG and WebP only; at most 10 MB per photo.
- Three upload workers, resumable Storage uploads, per-file progress and errors.
- The file is persisted in IndexedDB before upload. Workers fetch one persisted file each instead of retaining all queued file contents in React state.
- Metadata is committed after the Storage upload. The queue record is removed only after metadata succeeds.
- The SHA-256 key makes retries and repeated selection of identical bytes idempotent for the same item.
- If metadata fails after Storage succeeds, the object may temporarily be unreferenced. Its queued file and stable path support retry; this release does not provide automatic orphan deletion.
- Failed queues can be resumed by opening the same item on the same browser/device. Clearing browser storage removes local drafts and queued files.

Text drafts are stored separately in localStorage, scoped to UID/item/revision. Unavailable local storage is explicitly reported.

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
- Deploy frontend and rules together after rollout approval: `firebase deploy --only hosting,firestore:rules,storage --project report-utt`. Deploy the Go backend through its normal release process.
