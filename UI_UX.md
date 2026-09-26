# UI_UX.md

## Screens
1. **Upload Screen** (home)
   - Drag-n-drop zone (or click to browse), accepts multiple images
   - Thumbnail preview grid after selection
   - "Extract" button

2. **Processing State**
   - Per-thumbnail status: `Queued → Processing → Done / Failed`
   - Non-blocking — user can keep adding images while others process

3. **Review/Edit Table** (main working screen)
   - Columns: Thumbnail | Company Name | Email | Phone | Website | Source Type | Reviewed ✓
   - Low-confidence fields highlighted (e.g. yellow border) — see `EVALUATION.md` confidence scores
   - Inline edit on click, no separate edit modal
   - Row-level "Mark Reviewed" checkbox

4. **Export Screen / Action**
   - Button: "Export CSV" / "Export Excel"
   - Optional filter: export only "Reviewed" rows

## States to handle
- Empty state (no uploads yet)
- Upload error (wrong file type / too large)
- Extraction failed for an image (show retry button on that row)
- All fields null (image unreadable) — flag clearly, don't show blank silently

## Notes
- Single-page app feel: upload → table → export, no multi-page navigation needed for v1
- Mobile not a priority for v1 (this is used by Hamza/team at a desk after the expo, not on-site)
