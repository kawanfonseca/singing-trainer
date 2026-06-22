# Pitch Replay Task Report

## Summary

Implemented Pitch Replay with a Teacher View / Vocal Coach Insights layer for client-side free-singing analysis. Users can record or import audio, replay and download it, inspect pitch-centering and teacher-oriented measurements, review prioritized moments, and export a structured JSON report. The current implementation includes both Simple View and Teacher View and reuses the pitch detector already installed in the project.

## Product Goal

Pitch Replay helps a singer record or import singing and understand how close the detected voice stayed to the nearest note in the 12-tone chromatic scale. It deliberately does not compare the performance with a song's original melody. A centered note can therefore still be the wrong note for a particular melody.

## Route

The new page is available at `/pitch`. A shared navigation bar was added to the training course, `/range`, and `/pitch`, with Pitch Replay linked from the existing app and vocal-range page.

## Implementation Details

- **Browser recording:** `MediaRecorder` captures the original microphone stream, preferring Opus WebM, Opus OGG, then MP4 according to browser support. Recording uses unprocessed microphone constraints where supported, shows a timer, and retains the resulting blob for playback and download.
- **Audio import:** A local audio picker accepts browser-friendly audio MIME types and common filename extensions. `AudioContext.decodeAudioData` validates and decodes both imports and recordings.
- **Pitch detection:** `src/lib/pitchAnalysis.ts` reuses the existing `pitchy` package. It downmixes audio to mono and analyzes 2,048-sample windows with 1,024-sample hops. RMS, frequency-range, and clarity gates suppress silence, noise, and low-confidence frames.
- **Smoothing:** A local five-frame median (limited across time gaps) reduces attacks, consonants, short transitions, and visually chaotic detections. This also avoids treating individual low-confidence frames as full-strength evidence. Vibrato is assessed around the nearest-note center rather than automatically classified as an error.
- **Scoring:** Confidence-weighted voiced frames are classified into 0–15 cents (excellent), 15–30 (good/acceptable), 30–45 (needs attention), and 45–50 (between notes/very unstable). The headline score is the confidence-weighted percentage inside 30 cents; supporting metrics include average absolute deviation, signed bias, and voiced time.
- **Timeline and markers:** An SVG curve plots cents from the nearest note. Prioritized centering windows, sustained-note instability, flat/sharp sustained areas, phrase-ending drops, and a positive centered reference become clickable review markers that seek playback to 1.5 seconds before the event.
- **Export:** The original recorded/imported blob is downloadable. The schema-version-3 JSON report includes summary, pitch zones, samples, lesson-useful and observed ranges, tessitura, note distribution, sustained notes, attack insights, phrase-ending drops, calibrated phrase analysis, tonal-center estimate, saved-range comparison, and merged review markers with severity.
- **Dependencies:** No package was added. The existing `pitchy`, React, and `lucide-react` packages were reused.

## Sub-task Progress

| Sub-task | Status | Notes |
| --- | --- | --- |
| New `/pitch` route | Done | Explicit path selection in `src/main.tsx`. |
| Microphone recording | Done | `getUserMedia` and `MediaRecorder` with supported-format selection. |
| Recording timer | Done | Tenths updated during capture and displayed as minutes/seconds. |
| Audio playback | Done | Native browser audio controls for recordings and imports. |
| Audio download/export | Done | Original blob download plus JSON analysis export. |
| Audio import | Done | Common audio formats accepted and decoded client-side. |
| Pitch detection | Done | Offline `pitchy` analysis with RMS, frequency, and clarity filtering. |
| Nearest note calculation | Done | Frequency is mapped to rounded MIDI and chromatic note name. |
| Cents deviation calculation | Done | Fractional MIDI distance from the nearest semitone, in cents. |
| Pitch-centering score | Done | Confidence-weighted acceptable percentage inside ±30 cents, with four nearest-note zones. |
| Bias detection | Done | Signed weighted average reports flat, sharp, or balanced. |
| Issue detection | Done | Prioritized windows, sustained-note instability, flat/sharp areas, phrase-ending drops, and positive centered references. |
| Timeline visualization | Done | Responsive, horizontally scrollable SVG pitch curve and good zone. |
| Click-to-play issue markers | Done | Timeline and list markers seek 1.5 seconds before the event. |
| Error handling | Done | Covers unsupported recording, denied microphone, short/empty audio, decoding failure, and no pitched voice. |
| Responsive styling | Done | Two mobile breakpoints collapse actions, cards, audio, and result columns. |
| Regression check for `/range` | Done | Production build succeeds and the route remains explicitly mapped; browser smoke check documented below. |
| Recalibrated nearest-note zones | Done | 0–15, 15–30, 30–45, and 45–50-cent bands match nearest-note analysis. |
| Range used in take | Done | Reliable and sustained limits plus practical semitone span. |
| Tessitura estimate | Done | Central 70% by voiced time, relative low/middle/high distribution, and most-used octave. |
| Note distribution | Done | Duration and voiced-time percentage for the ten most-used notes. |
| Sustained-note analysis | Done | Same-note, high-confidence segments include drift, stability, attack, and classification. |
| Phrase-level analysis | Done | Voiced regions separated by 650 ms gaps include range, centering, bias, and largest signal. |
| Tonal-center estimate | Done | Duration-weighted major-profile estimate with relative minor, confidence, and explicit caveat. |
| Saved range comparison | Done | Uses the saved reliable or usable `/range` result when present; otherwise shows a link to run the test. |
| Simple / Teacher views | Done | Simple View preserves concise results; Teacher View exposes detailed lesson measurements. |
| Rich JSON schema | Done | Schema version 3 exports structured summary, calibrated phrases, range source, and merged review moments with severity and separate drift/drop metrics. |

## User Experience

1. The user opens `/pitch` and reads the honest nearest-note explanation.
2. The user records singing or imports an audio file.
3. The same page provides native listen-back controls and an audio download.
4. Pitch analysis shows centering score, deviation, bias, voiced duration, bands, and a pitch curve.
5. The user clicks a weak moment in the chart or list to hear its context.
6. The user downloads the original audio or a JSON report.

## Scoring Method

Each valid detected frequency is converted to fractional MIDI with `69 + 12 × log2(frequency / 440)`. Rounding fractional MIDI selects the nearest chromatic note, while the fractional difference multiplied by 100 produces signed cents deviation. Because nearest-note deviation is bounded at approximately ±50 cents, the score now uses 0–15 cents as excellent, 15–30 as good/acceptable, 30–45 as needs attention, and 45–50 as between notes/very unstable. The headline score is the confidence-weighted share inside 30 cents.

Silence and unvoiced audio are excluded using an RMS threshold of 0.008, a pitch-clarity threshold of 0.78, and a vocal frequency range of 70–1,200 Hz. Valid samples are weighted by clarity, with a small lower bound, so uncertain detections contribute less. Median smoothing reduces transient penalties before metrics and issues are calculated. Analyzed singing time counts retained voiced hops, not the full file duration.

## Known Limitations

- This does not compare singing against a song's original melody or intended notes.
- A note can be well centered and still be melodically wrong.
- Noise, room reverb, microphone quality, consonants, breath, vibrato, slides, polyphonic accompaniment, and unstable input can affect pitch tracking.
- Issue labels, phrase boundaries, sustained segments, attacks, and endings are acoustic heuristics, not musical or technical diagnoses.
- Broad vibrato can appear in the instability insight even when centered; it is not automatically added as an off-center issue.
- Long files are analyzed on the UI thread and may take noticeable time on slower mobile hardware.
- Real-user testing is needed to tune RMS, confidence, cent thresholds, and issue-duration thresholds across voice types and devices.

## Files Changed

- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\pages\PitchPage.tsx` — recording/import workflow, UI states, results, visualization, playback markers, and exports.
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\lib\pitchAnalysis.ts` — offline pitch detection, smoothing, scoring, bias, and issue analysis.
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\main.tsx` — `/pitch` route selection.
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\App.tsx` — navigation entry to Pitch Replay.
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\pages\RangePage.tsx` — shared route navigation while preserving the range tool.
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\App.css` — responsive Pitch Replay and navigation styling.
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\docs\pitch-replay-task-report.md` — this implementation report.
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\.codegraph\` — local CodeGraph index initialized at the user's request; ignored by project source control configuration.

## Dependencies

No new dependencies were added. `pitchy` was already present and is reused. Locked project dependencies were installed locally with `npm ci` for compilation and verification.

## Testing / Verification

- `npm run build`: passed; TypeScript compilation and Vite production build completed successfully. Vite reports only the existing bundle-size advisory.
- `npm run lint`: passed.
- Browser smoke tests: `/pitch`, navigation, responsive layout at 390 px, `/range`, and the default course route were checked locally with no console errors.
- A deterministic synthetic-audio test used three sustained pitched regions and silence gaps. It returned all schema-v3 fields, four pitch zones, lesson-useful range A4–C5, sustained notes, calibrated phrases, and deduplicated review moments.
- Recording and microphone permission behavior require a real user gesture/device; the UI paths and browser API errors are implemented, while acoustic accuracy needs real-device testing.
- A personal audio file was not uploaded automatically. Real file-picker import, playback seeking, and downloads remain explicit manual checks because the browser test surface cannot programmatically assign a local file safely.
- No automated test framework exists in this repository, so no automated unit tests were added.

## Remaining Work / Next Steps

- Optional comparison against a known reference melody, MIDI, or reference track.
- Saved analysis history, teacher/share mode, and calibration controls.
- More advanced vibrato and phrase-boundary detection.
- Move long-file analysis into a Web Worker and add progress reporting.
- Broader mobile-browser and real-microphone testing.
- Tune thresholds using diverse singers, devices, rooms, and vocal registers.

## Teacher View / Vocal Coach Insights Update

### What changed

The `/pitch` page offers Simple View and Teacher View after analysis. Simple View is intentionally short: headline centering, deviation, bias, voiced time, sustained/lesson-useful range, main singing zone, and the top three review moments. Teacher View contains zones, the full timeline and moment list, range detail, tessitura, note distribution, sustained-note tables, attack signals, phrase-ending drops, phrase-level cards, a possible tonal-center estimate, and comparison with a saved `/range` result. UI copy continues to state that no original melody is known and that these measurements do not diagnose technique, voice type, support, passaggio, strain, or health.

### Scoring and review thresholds

`src/lib/pitchAnalysis.ts` defines nearest-note zones as 0–15 cents (excellent), 15–30 (good), 30–45 (needs attention), and 45–50 (between notes/very unstable). Low-confidence frames remain down-weighted. Review candidates use rolling voiced windows above 30 cents, unstable or biased sustained notes, phrase-ending falls, and the best centered comparison region. Overlapping candidates for the same note are merged into one moment with combined signals. Severity uses average deviation, percentage of frames above 30 cents, duration, and maximum deviation; an isolated peak cannot create a strong result by itself.

### Sustained notes and attacks

A sustained note is a contiguous run with the same rounded MIDI note, no frame gap above 2.5 analysis hops, at least 0.35 seconds duration, and average confidence of at least 0.82. Each segment includes average/start/end cents, maximum deviation, drift, cents standard deviation, confidence, and a stability classification. Attack labels require at least six frames and high initial confidence; they distinguish centered, corrected flat/sharp, sliding, unstable, and unclear entries. Intentional portamento can resemble a sliding or corrected attack, so the UI presents these as signals.

### Tessitura and note distribution

Reliable take limits require confidence of at least 0.82 and at least three frames on the boundary note, preventing a single noisy frame from defining the range. Sustained limits use the sustained segments above. Tessitura is the 15th–85th percentile of rounded MIDI values, representing the central 70% of voiced time. Relative low, middle, and high percentages split the take into thirds of its own observed distribution. Note distribution aggregates analysis-hop duration by octave-specific chromatic note.

### Phrase segmentation and endings

Approximate phrases are contiguous voiced samples separated by at least 650 ms of unvoiced audio. Phrases shorter than 0.7 seconds are omitted. Each phrase reports its 15th–85th percentile note region, acceptable-centering percentage, average deviation, signed bias, and largest detected signal. End-of-phrase drops require a sustained note ending within 300 ms of a phrase boundary and a start-to-end fall of at least 15 cents.

### Tonal-center estimate

The optional estimate combines duration per pitch class with extra duration/confidence weight for sustained notes, then compares all 12 rotations of a standard major key profile. Medium/High results show the candidate as the main value. Low-confidence results instead lead with “Tonal center: not reliable enough” and demote the candidate to supporting text. Fewer than three pitch classes or less than three seconds of voiced material returns “Not enough reliable tonal information.” This remains uncertain without accompaniment or a reference melody.

### Saved vocal-range comparison

Comparison was possible using the existing `singing-trainer-vocal-range` local-storage result. The implementation prefers `analysis.reliableRange`, falls back to `analysis.usableRange`, and finally uses the saved absolute low/high values. It reports time inside the saved detected range, time within two semitones of either limit, and take extremes relative to those limits. With no saved value it links to `/range` and does not create substitute data.

### JSON and implementation files

The JSON report now uses schema version 3 and includes summary, pitch zones, range used and its source, tessitura, note distribution, sustained notes, attack insights, phrase-ending drops, calibrated phrase analysis, tonal-center estimate, saved-range comparison, merged issue markers, and pitch samples. Review markers separate nearest-note average/max deviation from drift and end-drop movement.

- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\lib\pitchAnalysis.ts`
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\pages\PitchPage.tsx`
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\App.css`
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\docs\pitch-replay-task-report.md`

### Testing and limitations

Build and lint pass. Local browser smoke tests cover `/pitch`, `/range`, `/`, disclaimer copy, file control presence, navigation, desktop layout, 390 px responsive layout, and console errors. Synthetic audio validates the full analysis schema and segmentation without using private user audio. Real microphone capture, OS file-picker import, actual acoustic tuning, audio download, JSON download, and click-to-seek should still be manually checked on target browsers. The current heuristic does not distinguish an intentional melodic fall from an unintended phrase-ending fall and cannot determine whether a detected note belongs to the intended song.

## Calibration and UX Cleanup Update

- **Simple View:** Reduced to six lesson-facing measurements and the top three review moments. Zones, timeline, full moments, distribution, sustained-note details, phrases, tonal estimate, and saved-range comparison now live only in Teacher View.
- **Moment consolidation:** Candidates for the same note are merged when their ranges overlap or are within 200 ms. The merged JSON/UI record contains combined `signals`, signed `averageCents`, bounded `maxDeviation`, `percentAbove30`, optional `driftCents`, `stabilityCents`, optional `endDropCents`, and `severity`.
- **Severity:** Minor/moderate/strong classification combines average deviation, percentage of local frames above 30 cents, duration, and maximum deviation. Maximum deviation only adds severity when at least 25% of the moment is above 30 cents, preventing one short peak from dominating the card.
- **Timestamps:** Sub-second moments render as “Around m:ss · 0.xs”; longer ranges within one clock second use decimal timestamps. Integer ranges no longer display identical start/end values.
- **Drop metrics:** End-drop amount is retained as pitch movement and is never substituted for nearest-note average deviation or maximum deviation. Nearest-note deviations shown in cards remain bounded to 50 cents.
- **Range calibration:** Observed reliable extremes remain visible but do not drive the main lesson range. The lesson-useful range prefers sustained limits when at least two sustained notes exist, otherwise the central 70% usable range. The JSON identifies the source as `sustained range` or `central usable range`.
- **Phrase labels:** Phrase classification is based directly on within-30-cent share: 90%+ strong/reference, 80–89% mostly stable, 70–79% review lightly, and below 70% needs review. High-scoring phrases now use positive reference copy.
- **Teacher summary:** Added best phrase, most review-worthy phrase, highest sustained note, main singing zone, and most recurring review signal above the detailed Teacher View.
- **Schema:** JSON schema version advanced from 2 to 3 to reflect merged moment fields, calibrated phrases, range-source metadata, and separated movement/deviation values.
- **Calibration verification:** Synthetic notes confirmed schema 3, no overlapping same-note review duplicates, deviations bounded to 50 cents, sustained-range sourcing, and a 100% phrase classified as `strong/reference phrase`.

## Review Package Export

### Purpose and UI

The results header now keeps the regular **Export JSON report** action and adds **Download review package** with helper text explaining that the package replaces manual copying of Simple View and Teacher View. The action appears only after a completed analysis because the entire results section is analysis-gated. Package-generation failures show a dedicated friendly error without discarding the completed analysis or audio player.

### Filename and versioning

The downloaded file uses `pitch-replay-review-package-YYYY-MM-DD-HH-mm.json`, based on local download time; for example, `pitch-replay-review-package-2026-06-22-17-42.json`. The package has `packageType: "pitch-replay-review-package"`, `packageVersion: 1`, and records the embedded analysis contract as `app.reportSchemaVersion: 3`.

### Included fields

`src/lib/pitchReviewPackage.ts` builds the package from the existing `PitchAnalysis` schema and shared display-metric builders. It includes:

- app route, environment, user agent, viewport, report schema version, and generation time;
- audio source type, original filename/MIME type, decoded duration, voiced duration, sample rate, and channel count;
- the exact six Simple View headline metrics and top three formatted review moments;
- the exact Teacher View lesson summary, detailed range, tessitura, tonal estimate, saved-range comparison, top note distribution, top sustained notes, phrase label counts, best/review-worthy phrases, concerns, and caveats;
- full schema-3 structured analysis, including samples, zones, range source, sustained notes, attacks, phrase-ending drops, phrases, tonal estimate, range comparison, and merged review moments;
- a self-contained `reviewerSummaryMarkdown` with quick summary, review moments, Teacher View highlights, and caveats;
- a `qaChecklist` with data-presence flags and warnings for short voiced time, missing sustained/phrase/moment data, low tonal confidence, incomplete audio metadata, or absent saved range.

Simple and Teacher metrics are generated by the same `buildSimpleViewMetrics` and `buildTeacherLessonSummary` functions used by the React UI, preventing export wording/value drift.

### Intentionally excluded

Audio bytes are not embedded or base64-encoded. `audio.downloadableAudioIncluded` is always `false`; the existing separate audio download remains the explicit path for sharing the recording. This keeps the package small and avoids silently duplicating potentially private audio. There is no include-audio toggle in this implementation.

### Difference from the regular report

The regular JSON report remains a compact machine-oriented schema-3 analysis export. The review package wraps that analysis with decoded-audio metadata, exact UI summaries, a Markdown report, QA checklist, environment context, and explicit caveats so one file is sufficient for manual QA, teacher/developer review, or later comparison tooling.

### Manual QA use and limitations

Run or import a take, download the review package, and upload/send that single JSON file for external review. A deterministic synthetic-audio verification confirmed package type/version, schema version, Simple/Teacher sections, full analysis, Markdown presence, timestamped filename, and that no audio bytes are present. Browser-specific download permissions and real microphone/file-import behavior still require a user gesture on the target browser. Environment and user-agent fields may contain browser/device-identifying information and should be reviewed before sharing outside the intended recipient.

Files added or updated for this export:

- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\lib\pitchReviewPackage.ts`
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\pages\PitchPage.tsx`
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\App.css`
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\docs\pitch-replay-task-report.md`

## Final Ranking, UX, and pt-BR Localization Update

### Brazilian Portuguese as the primary UI language

All user-facing `/pitch` copy now uses natural Brazilian Portuguese: navigation, recording/import states, buttons, helper text, errors, disclaimers, Simple View, Teacher View, zones, review cards, sustained-note tables, phrase cards, tonal estimate, saved-range comparison, empty states, and exports. “Pitch Replay” remains the product name. Navigation labels shared by `/`, `/range`, and `/pitch` were aligned to `Curso de canto` and `Extensão vocal`.

The caveats remain explicit in Portuguese: the tool does not know the original melody; a centered note may still be melodically wrong; tonal-center estimation may fail without accompaniment/reference; and acoustic signals are not diagnoses of technique, voice type, support, strain, or vocal health.

### Lesson priority versus technical severity

`ReviewMoment` now contains a separate numeric `lessonPriority` while retaining the machine-readable `severity`. Technical severity still reflects centering statistics. Lesson priority ranks contextual value in this order: phrase-level issues, meaningful sustained instability/drift, phrase-ending drops, recurring flat/sharp sustained patterns, positive comparison regions, and finally isolated centering windows.

The Simple View top three is selected by `getLessonReviewMoments`, sorting by `lessonPriority`, duration, and maximum deviation. Teacher View continues to show the complete technically ranked list. This prevents a valid but musically weak 0.2–0.3 second event from displacing a phrase or sustained-note pattern useful in a lesson.

### Short blip handling

An isolated moment below 0.35 seconds whose only signal is `pitch-centering` is forced to technical severity `minor` and receives a lesson-priority penalty. It can remain in the Teacher View details, but it cannot be promoted as strong without being merged into a larger sustained or phrase context. Short display times remain localized, for example `Por volta de 0:19 · 0,5s`, and never show identical integer endpoints.

### Phrase candidates and merged moments

Phrases below 80% within 30 cents now create explicit `phrase issue` review candidates, allowing phrase context to participate in lesson ranking. Same-note overlapping candidates remain merged with combined signals. Display signals are localized (`frase para revisar`, `instável`, `sustentada alta`, `queda no fim da frase`, and related labels), while internal enum values remain English for code/schema stability.

### Review package language and schema stability

The package keeps `packageType`, `packageVersion: 1`, `reportSchemaVersion: 3`, JSON keys, enum values, and structured field names in English. Human-readable content is pt-BR:

- Simple View labels/details;
- Teacher View labels/details and display classifications;
- review timestamps, display signals, and display severity;
- moment explanations, concerns, warnings, and caveats;
- tonal display label/confidence;
- `reviewerSummaryMarkdown`, now headed `Pacote de revisão do Pitch Replay`, `Resumo rápido`, `Principais momentos para revisar`, `Destaques da visão do professor`, and `Ressalvas`.

Additional display-only fields (`displaySeverity`, `displayLabelCounts`, `displayClassification`, `displayAttack`, `displayLabel`, and `confidenceLabel`) provide localized values without replacing stable machine-readable fields.

### Files changed in this calibration

- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\lib\pitchAnalysis.ts` — phrase candidates, lesson-priority calculation, short-blip severity guard, and Portuguese explanations.
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\lib\pitchReviewPackage.ts` — shared lesson ranking, localization helpers, Portuguese human-readable package content, and Markdown.
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\pages\PitchPage.tsx` — complete pt-BR UI and lesson-ranked Simple View.
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\App.tsx` — localized shared navigation.
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\src\pages\RangePage.tsx` — localized shared navigation.
- `C:\Users\Kawan\OneDrive\Área de Trabalho\singing-trainer\docs\pitch-replay-task-report.md` — this calibration report.

### Verification performed

- TypeScript/Vite production build.
- ESLint and `git diff --check`.
- Deterministic synthetic take with centered sustained notes, a sustained 36-cent pattern, and an isolated 0.25-second 48-cent event.
- Confirmed top lesson ranking: phrase issue, sustained instability, then sustained sharp pattern; the isolated blip did not dominate the top three.
- Confirmed package/report schema versions remain 1/3, human metric labels and display signals are pt-BR, Markdown is Portuguese, and audio remains excluded.
- Local smoke tests cover `/`, `/range`, `/pitch`, disclaimer/navigation copy, and approximately 390 px mobile width. Real microphone permission, personal-file import, and browser download still require an explicit user gesture on the target device.

## Final Status

**Complete.** The Pitch Replay and Teacher View acceptance criteria are implemented. Remaining items are accuracy, performance, and product extensions that require broader real-user testing rather than missing core functionality.
