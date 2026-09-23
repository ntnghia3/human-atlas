# Vietnamese UI Localization & Evidence UX Report

Date: 2026-09-23  
Scope: Vietnamese UI copy, anatomy detail evidence presentation, source metadata disclosure, search behavior, responsive behavior, and English regression safety.

## 1. Localization key inventory

- Before: 86 canonical UI message keys.
- After: 179 canonical UI message keys (+93).
- Vietnamese message parity: 179/179 keys populated after the change.
- Before, two ordinary UI labels remained in English: `controls.skeleton` and `controls.organs`.
- After, those labels are `Hệ xương` and `Cơ quan`; no ordinary Vietnamese UI string is missing.
- Deliberate English values such as the language option `English`, English anatomical originals, brand names, and technical identifiers remain bilingual by design rather than being treated as missing translations.

## 2. Files and components audited

- `app/localization.ts`: message registry, English/Vietnamese parity, system labels, detail copy, evidence copy, and source metadata labels.
- `app/page.tsx`: search, system controls, about panel, selected-structure detail sheet, evidence summary, source disclosure, and technical disclosure.
- `app/terminology.ts`: localization resolution and the presentation adapters `getEvidencePresentation` and `getSourceDisplay`.
- `app/terminology-data.ts`, anatomy data, and the M04B2I localization catalog: terminology, provenance, source references, variants, and blockers.
- `app/anatomy.ts`: system names, descriptions, and structure explanations used by the UI.
- `app/scene.tsx`, `components/ui/combobox.tsx`, and `components/ui/sheet.tsx`: accessible labels and responsive interaction surfaces.
- `app/globals.css`: bilingual search results, evidence/source cards, disclosure styling, wrapping, and narrow viewport behavior.
- `scripts/validate-localization.mjs` and the existing M04B2I final-QA checks.

## 3. Evidence presentation model

The UI now derives a compact evidence presentation from the record’s evidence status, translation method, source disposition, variants, provenance, and blockers. Raw catalog enums are not used as the default user-facing copy.

| Record condition | Vietnamese presentation |
| --- | --- |
| Verified direct source | `Đã xác minh nguồn` |
| Verified multi-authority | `Đã xác minh nguồn`, with a description stating that the term is recorded in two independent sources |
| Controlled derived | `Suy dẫn từ thuật ngữ đã xác minh`, with an explicit note that the full phrase may not appear verbatim in a source |
| Provisional source candidate | `Có nguồn tham khảo` + `Chưa xác minh đầy đủ` |
| Generated/provisional translation | `Bản dịch tạm` + `Chưa xác định nguồn` |
| Source conflict or variant | `Có biến thể nguồn` + the provisional qualifier where applicable |

All 3,432 catalog records have a Vietnamese value. The no-translation message remains available as a safe presentation fallback for future records that do not.

## 4. Status wording and honesty rules

- Verified wording is reserved for records with verified source evidence.
- `Chưa xác minh đầy đủ` distinguishes a source candidate from a verified source.
- `Chưa xác định nguồn` is used for generated translations and does not imply that a fabricated source exists.
- Derived terminology is labeled as derived, not presented as a verbatim quotation.
- English anatomical names remain visible as a secondary original term for scientific traceability.

## 5. Source behavior

- Source IDs are resolved through the source catalog and displayed as human-readable names.
- Compact evidence shows at most two source names and then `+N nguồn` when more are present.
- Source counts are based on unique source IDs.
- Generated translations show no fake or inferred source.
- Conflicting and variant records keep their source variants and show them in the expanded evidence section.
- Unknown source IDs fall back to `Chưa có thông tin chi tiết về nguồn tham khảo.` in the compact UI; the raw ID remains available only in technical details.

## 6. Known source display names

| Source ID | Compact Vietnamese display | Full metadata available on expansion |
| --- | --- | --- |
| `NVH2008` | Nguyễn Văn Huy và cộng sự (2008) | `Thuật ngữ giải phẫu Anh - Việt`, authors, year, edition/publisher where present, locators |
| `HMU2022` | Đại học Y Hà Nội (2022) | `Giải phẫu người: dùng cho sinh viên hệ bác sĩ`, institution, editor, year, edition, locators |
| `UMP2023_T2` | Đại học Y Dược TP.HCM (2023) | Institution, `Tập 2`, year, edition, locators |
| `NATIONAL_BODY_TERMS_2025` | Sở Y tế Đắk Nông (2025) | Institution, title, year, and available locators |

## 7. Default versus expanded source information

The default detail view contains the Vietnamese anatomical name, the English original, a plain-language evidence label, a short qualifier/description, and a compact source summary. It does not expose raw status enums, source IDs, revision hashes, rules, blockers, or atlas codes.

`Xem chi tiết nguồn` reveals full source titles, institutions, authors, year, edition, publisher, page/section/entry locators, links, and preserved source variants. A nested `Chi tiết kỹ thuật` disclosure exposes the machine-readable identifiers and provenance needed for auditability without making them the primary learning experience.

## 8. Representative concepts tested

| Concept | Case | Result |
| --- | --- | --- |
| `FMA3736` — ascending aorta / Động mạch chủ lên | Direct source | Verified label and human-readable HMU source |
| `FMA3947` — internal carotid artery / Động mạch cảnh trong | Multi-authority | Verified label, two-source description, two compact source names |
| `FMA3988` — right superior epigastric artery / Động mạch thượng vị trên phải | Controlled derived | Derived wording and non-verbatim explanation |
| `FMA3710` — vascular tree / mạch máu cây | Generated translation | Temporary label, no-source qualifier, no fabricated citation |
| `FMA9600` — prostate / Tuyến tiền liệt | Source conflict | Variant label, provisional qualifier, all source variants preserved |
| `FMA9625` — stylohyoid / Cơ trâm-móng | Source variant | Variant source disclosure and source cards |
| `FMA5022` — muscle organ / cơ cơ quan | M04B2I human-review overlay | Preserved for final-QA review and regression coverage |

## 9. Mobile and narrow viewport checks

The live UI was checked at a 639×546 viewport. The document scroll width remained 639px, with no horizontal overflow. The search panel, bilingual result rows, evidence summary, source cards, long source titles, and locator text wrapped within their containers. The detail sheet remained usable at approximately 300px wide, and source cards stayed inside the sheet bounds.

## 10. Search behavior

- Vietnamese placeholder: `Tìm theo tên tiếng Việt, tiếng Anh hoặc mã…`.
- Search matches Vietnamese names, English originals, and anatomical IDs.
- Vietnamese results show the Vietnamese name as primary text and the English original as a smaller secondary line.
- Result counts and piece labels remain localized.
- No-result copy is `Không có cấu trúc phù hợp.`.
- The existing English search path remains available and unchanged in meaning.

## 11. English regression

English mode was checked after the Vietnamese pass. The UI retained `Human Atlas 3D`, `Search anatomy`, `Reset`, the existing English system/action labels, English source wording, and the established English interaction flow. Vietnamese-only evidence presentation is selected by language, while the underlying terminology resolution and English originals remain intact.

## 12. Invariants verified

- Total concepts: 3,432.
- Vietnamese UI coverage: 3,432/3,432.
- Verified records: 841.
- Provisional sourced records: 86.
- Provisional translated records: 2,505.
- Records without a Vietnamese value: 0.
- Source dispositions reconcile to 3,432: 1,983 no-safe-candidate, 472 direct-source, 522 scope-review, 14 multi-authority, 432 controlled-derived, 7 source-conflict, and 2 source-variant records.
- The existing M04B2I data, final-QA overlays, hashes, and review records were preserved.

## 13. Tests and verification

All of the following passed after the implementation:

```text
npm run test:terminology
npm run test:localization
npm run test:m04b2g
npm run test:m04b2h
npm run test:m04b2i
npm run test:m04b2i:final-qa
npm run check
npm run build
```

The localization validator also checks message-key registration, Vietnamese parity, representative evidence cases, raw-code suppression in the compact UI, bilingual search copy, accessibility labels, and the M04B2I final-QA integration hooks.

## 14. Files changed for this UI task

- `app/localization.ts`
- `app/terminology.ts`
- `app/page.tsx`
- `app/globals.css`
- `scripts/validate-localization.mjs`
- This report: `docs/en-vi/VIETNAMESE_UI_LOCALIZATION_UX_REPORT.md`

The worktree also contains pre-existing M04B2I research, data, QA, and package changes. They were preserved and were not reset or rewritten as part of the UI cleanup.

## 15. Git diff summary

At the time of this report, the tracked worktree diff covered 10 files with approximately 1,793 insertions and 858 deletions. That aggregate includes the pre-existing M04B2I catalog/research/package changes as well as the UI localization patch; it should not be interpreted as UI-only authorship. The new report is an untracked documentation file until the user chooses how to commit the work.

## 16. Unresolved UI issues

No blocking UI defect was found in the desktop, narrow viewport, search, evidence disclosure, or English regression checks.

The remaining provisional/generated terminology and unresolved source variants are data-quality and research follow-ups, intentionally surfaced by the UI rather than hidden. External source URLs were not live-validated as part of this local UI pass; the interface preserves them when present and exposes them as source links only in the expanded view.

## 17. Acceptance result

Vietnamese UI localization, bilingual search identity, evidence labeling, human-readable source metadata, technical provenance disclosure, responsive behavior, and English regression coverage are complete for the current M04B2I-backed catalog.
