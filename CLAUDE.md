# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

EngQuest — a gamified, Russian-language web app that teaches English from zero. Pure static
HTML/CSS/vanilla JS, no build step, no backend, no package.json. All progress is stored in the
browser's `localStorage`, scoped per device (no sync). Designed for easy future GitHub Pages
hosting and Electron/Capacitor wrapping without rewriting any logic.

## Commands

There is no build, lint, or test tooling (no `package.json`). Workflow:

- **Run locally**: serve the folder with a static server and open `index.html`, e.g.
  `python -m http.server 8765` from the project root, then visit `http://localhost:8765/index.html`.
  Opening `index.html` directly via `file://` also works for quick checks.
- **Syntax-check a JS file after editing**: `node --check js/<file>.js` (or `data/units.js`). This
  is the fastest way to catch a stray comma/brace before reloading the browser — there is no other
  static analysis configured.
- **Manual/browser testing**: there is no automated test suite. Verification in this project is
  done by scripting Playwright against the local static server (write a throwaway `.js` driver
  script, e.g. in a scratch dir, that launches Chromium, exercises the UI, and asserts on
  `page.evaluate(...)` results / screenshots). Useful in-page entry points for such scripts:
  `Exercises.buildLessonExercises(lesson)` to check exercise generation for a lesson without
  clicking through the UI, and reading/writing `localStorage` keys (see below) to simulate a
  player's prior progress.

## Architecture

### No modules — script order is the dependency graph

Every file defines one `const Foo = (() => { ... return {...}; })();` IIFE attached to the global
scope; there is no `import`/`export`. `index.html` loads scripts in a fixed order, and later
scripts assume earlier globals already exist:

```
data/units.js → progress.js → srs.js → sound.js → achievements.js → journal.js
→ speech.js → exercises.js → lesson.js → main.js
```

`main.js` is the entry point: it wires up event listeners and calls `showMap()` at the bottom of
the file. When adding a new module, add its `<script>` tag in the right place in `index.html`
relative to what it depends on / is depended on by.

### Content model (`data/units.js`)

The entire curriculum is one array: `UNITS = [{ id, title, icon, level, independent?, lessons: [{
id, title, grammarFocus: {title, text}, phrases: [{en, ru, note?}] }] }]`.

- `level` is the CEFR badge shown on the map (`Pre-A1`, `A1`, `A2`, `B1`, `B2`, or `IT`).
- `independent: true` marks a unit that doesn't participate in the sequential unlock chain
  (currently `alphabet` and `tech-english`) — always unlocked regardless of array position.
- Within the chain (all non-independent units), order in the array **is** the learning order.
  Vocabulary and grammar units for the same CEFR level are interleaved deliberately (e.g.
  `greetings` → `grammar-a1-basics` → `numbers` → ... → `grammar-a2-past` → `shopping` → ...) —
  don't move grammar units to the end "for tidiness"; the pedagogical intent is words and grammar
  of the same level mixed together, matching the level plan in `English_Learning_Plan.docx`.
- `phrase.note` is an optional grammar/spelling explanation shown to the player after they answer
  (correct → collapsed "ℹ️ Почему так?" toggle; incorrect → always shown in the mistake panel).
  Write notes only when there's a non-obvious *why*, not for plain vocabulary.
- Content convention: never use apostrophes in `en:` fields (write `will not`, `cannot`, not
  `won't`/`can't`) — keeps `Exercises.normalizeAnswer()` simple and avoids string-escaping bugs.
- All UI strings and lesson content are Russian-facing (the learner reads Russian, answers in
  English) — keep new content/UI text in Russian.

### Unlock logic (`main.js: isLessonUnlocked`)

Two separate rules, checked in this order:
1. If the lesson is already completed (`Progress.isLessonCompleted`), it's always shown unlocked —
   this is a deliberate safety net so that re-ordering `UNITS` (which changes what "the previous
   lesson/unit" means) can never re-lock something a player already finished.
2. Otherwise: within a unit, lesson *N* unlocks when lesson *N-1* is completed. The first lesson of
   a unit unlocks when the last lesson of the *previous chain unit* is completed (independent
   units are excluded from this chain entirely via `UNITS.filter(u => !u.independent)`).

If you reorder or insert units in `data/units.js`, you generally don't need to touch this logic —
but be aware existing completed-lesson state is what prevents regressions, not the ordering itself.

### Exercise generation vs. lesson playback

`exercises.js` is pure data transformation (phrase → exercise object); `lesson.js` is the only
place that renders exercises and mutates UI/progress state. Two different exercise-list builders
exist and are *not* interchangeable:

- `buildLessonExercises(lesson)` — used for a fresh lesson. Implements a "Presentation → Practice"
  batching rule (`BATCH_SIZE = 4`): phrases are processed in batches of 4, and *within a batch*
  every phrase first gets a `flashcard` exercise (plain en+ru+audio reveal, no question — see
  `renderFlashcard` in `lesson.js`), then an easy recognition exercise (`choice`, en→ru, text mode),
  and only after both of those does it appear in a harder/production exercise (listening, ru→en
  choice, sentence-build, or free-typing) of that same batch. The `flashcard` step exists because
  the recognition quiz alone is unguessable on a word's first exposure — without seeing the
  translation first, picking it out of random multiple-choice options is blind chance, not
  recognition. Do not shuffle this list, and do not change the batching without preserving the
  flashcard-before-quiz-before-production ordering guarantee.
- `buildReviewExercises(phrases)` — used only for SRS review sessions, where the player has already
  learned the words; one exercise per phrase, type chosen by a round-robin cycle, shuffled by the
  caller (`Lesson.start` shuffles review sessions but never fresh lessons).

### Progress, SRS, achievements, sound — separate localStorage-backed modules

Each concern is its own module/key, all independent of each other and of `UNITS`:

| Module | localStorage key | Responsibility |
|---|---|---|
| `progress.js` | `engquest_progress_v1` | XP, hearts, streak, per-lesson stars, daily XP goal tracking |
| `srs.js` | `engquest_srs_v1` | Simplified SM-2 spaced repetition (`STEPS = [1,3,7,14,30,60]` days) for the review mode; also the source of truth for "words learned" count |
| `achievements.js` | `engquest_achievements_v1` | Static `DEFS` list of badges with `check(stats)` predicates; `main.js` calls `Achievements.checkAndUnlock(stats)` after lesson/review completion and on app load |
| `sound.js` | `engquest_sound_muted_v1` | Synthesized Web Audio tones (no audio files) for correct/wrong/lesson-complete/achievement; mute flag |
| `journal.js` | `engquest_journal_v1` | Free-text "output practice" entries, rendered with manual HTML-escaping (`escapeHtml` in `main.js`) since entries are user-authored |

`Progress.getStats()` + `SRS.getWordCount()` together form the `stats` object that
`Achievements.checkAndUnlock` evaluates — if you add a new achievement condition that needs new
data, extend `getStats()` rather than reaching into other modules' internals from `achievements.js`.

### Routing (`main.js`)

There's no router/framework — `main.js` has one `#app` container and a set of `show*()` functions
(`showMap`, `showLessonIntro`, `startLesson`, `startReview`, `showResult`, `showJournal`,
`showResources`, `showAchievements`) that each fully replace `app.innerHTML` and (re)attach event
listeners. The `#toast-host` element (achievement toasts) lives outside `#app` so it survives
screen transitions. `findLesson(lessonId)` does a linear search across all `UNITS` — fine at this
content scale, no index is maintained.
