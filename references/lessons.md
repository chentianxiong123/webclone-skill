# Lessons Learned 鈥?Clone Failures (Ramp, Airbnb)

## Lesson 1: Static HTML is never acceptable for interactive sites

Always include `main.js`. The SKILL.md "HTML + CSS" default was wrong 鈥?it should
have been "HTML + CSS + vanilla JavaScript" from day one. A clone without
JavaScript for tabs, dropdowns, and navigation feels dead. Users don't say "the
CSS is great" 鈥?they say "nothing works."

## Lesson 2: Phase 3 (interactions) must be enforced structurally

Documenting that "interactions are not optional" isn't enough. The page checklist
must have an explicit `[ ] interactions` column so the extraction phase can't be
marked complete without it. If it's not in the checklist, it gets skipped.

## Lesson 3: Extraction data must be cached to disk as JSON

Build agents must READ from `./webclone-extraction-{domain}.json`, not from prompt
text. When extraction data is passed as text in a prompt, values get approximated
during the build. The JSON file is the single source of truth for every CSS
pixel value.

## Lesson 4: Never delegate the full build to a subagent without exact data files

Passing extraction data as text in a Task prompt loses precision. Always pass the
file path (`./webclone-extraction-{domain}.json`) so the subagent reads exact
values from disk. Prompt text is lossy 鈥?JSON files are not.

## Lesson 5: Every interactive element must have a JavaScript handler

Dead buttons with `cursor: pointer` are worse than no button at all. They
actively mislead the user into thinking something is broken (it is). If a tab
exists in the HTML, it MUST switch on click. If a dropdown trigger has a chevron
icon, it MUST open a menu.

## Lesson 6: Verification must include interaction testing

A pixel-perfect screenshot of a dead UI is a failure. Phase 5 verification must
test every interactive element via Playwright click 鈥?tabs switch,
dropdowns open/close, navigation navigates. Visual comparison alone misses the
most important failures.

## Lesson 7: Hover states require active extraction 鈥?getComputedStyle misses them

`:hover` is a pseudo-class that only activates on mouse interaction. Static
`getComputedStyle()` never captures hover values. You must use Playwright to
hover over the element, THEN extract the changed styles. Without this, the build
agent falls back to `opacity: 0.85` 鈥?a dead giveaway the clone is fake.

## Lesson 8: URL routing must be extracted and mirrored in file structure

Real sites use semantic URL paths (`/home/travel/bookings`), not flat file names
(`travel.html`). The extraction pipeline must document the URL sitemap, and the
build must create matching Vue Router routes. Nav hrefs must match real paths.

## Lesson 9: Sticky columns need position + offset + z-index + background

Extracting `position: sticky` is useless without `left`, `right`, `top`, `bottom`,
and `z-index`. And sticky elements MUST have explicit `background-color` 鈥?without
it, content scrolls visibly underneath them. The extraction must capture the full
sticky recipe, not just the position value.

## Lesson 10: Table cells need dedicated extraction

Tables aren't covered by generic targeted queries for nav/buttons/cards. Without
a specific table extraction step, cells inherit the page background instead of
getting their own white background 鈥?making the table blend into the page.

## Lesson 11: Box model (margin/padding/gap) must be extracted, not inferred

`getBoundingClientRect()` gives size and position but not the INTERNAL spacing.
Without extracting `margin`, `padding`, and `gap`, the build agent guesses values
like `padding: 40px 8px` when the real value is `padding: 40px 0`.

## Lesson 12: When restructuring URLs, handle the root entry point

Moving pages into subdirectories without updating or replacing the root index.html
leaves a stale file as the default entry point. The server serves it at `/`, users
see broken links, navigation fails. Always redirect or replace the root when
restructuring.

## Lesson 13: Overview expense rows 鈮?expenses table cells

The overview page's `.expense-row` elements inherit the page background (off-white).
Only the expenses page's `.data-table td/th` elements need explicit white backgrounds.
Adding white backgrounds to overview rows creates a color band mismatch.

## Lesson 14: Verify plan assumptions before implementing

The plan said "remove 8px horizontal padding from right-sidebar" but the math
doesn't add it up: 298px sidebar - 282px buttons = 16px = 8px per side. The 8px
padding was creating the correct button width. Always sanity-check spacing math
before deleting padding values.

## Lesson 15: Transitions must be explicitly extracted from computed styles

The rule "ALWAYS extract transitions" existed but the extraction step never queried
`transition`, `transitionDuration`, or `transitionTimingFunction`. Rules without
data = guesswork. Every rule in Phase 4 must have a matching extraction step in
Phase 2.

## Lesson 16: Extraction JSON must cover ALL pages

A 3KB extraction JSON for a 3-page app means most content was guessed. Each page
needs its own extraction pass with dedicated JSON data. If the JSON doesn't have
values for a page, that page was built from imagination 鈥?and it shows.

## Lesson 17: Never build from memory 鈥?re-extract if the JSON doesn't have it

If the extraction JSON doesn't have a specific value (column width, padding, font
weight), go back to the live site and extract it. Writing CSS from memory or
"what looks right" produces values that are consistently 2-8px off 鈥?enough to
feel wrong but not obviously broken.

## Lesson 18: Interaction depth must be defined upfront

Tabs without content are worse than no tabs at all. Before extracting, define how
deep each page's interactions go. If a page has tabs, every tab must have panel
content extracted and built. An empty tab panel tells the user the clone is fake.

## Lesson 19: Hotels 鈮?Flights 鈥?tab switching that doesn't change form content is broken

When different tabs show different forms (Flights vs Hotels), the extraction must
capture form fields for EACH tab state. Building one form and reusing it for both
tabs means the Hotels tab shows flight fields 鈥?a functional failure, not just a
visual one.

## Lesson 20: SVG icons must be extracted verbatim

Feather/lucide/heroicon substitutions are visible to anyone who knows the real site.
Extract the actual `outerHTML` of each `<svg>` element and use it directly. Icon
libraries approximate the visual intent but never match the exact paths, stroke
widths, and viewBox of the original.

## Lesson 21: Right sidebar padding must be verified with math

sidebar_width - button_width = padding * 2. If the grid column is 362px, the inner
content is 298px, and buttons are 282px, then 298 - 282 = 16px = 8px per side.
Don't remove padding that the math says is correct just because the plan says to.

## Lesson 22: Every fix must flow back to SKILL.md

A lesson that stays in lessons.md but doesn't update SKILL.md will repeat on the
next clone. Every lesson must trace to a specific SKILL.md rule, extraction step,
or validation check. If there's no structural change to prevent recurrence, the
lesson is incomplete.

## Lesson 23: Pre-built extraction scripts beat inline JS in skill prompts

Inline JS in SKILL.md meant Claude regenerated extraction code from prose descriptions
on every run 鈥?8+ separate `page.evaluate` calls per page, each one an LLM-mediated
roundtrip where Claude writes JS from scratch. This was slow, inconsistent across runs,
and burned context window on boilerplate.

The fix: bundle extraction JS as standalone `.js` files in `scripts/`, load them via
Glob + Read at runtime, and pass the file contents to `page.evaluate`. This reduces
static extraction to 2 calls per page (structure + visual) with deterministic code.

Key design decisions:
- Scripts use `var` and `Array.from()` instead of `const`/`let`/spread 鈥?broader
  browser compatibility in Playwright's evaluate context
- Each script includes a size guard (20KB limit, truncates with `_truncated` flag)
- Hover and interaction scripts are parameterized (SELECTOR_PLACEHOLDER / BOUNDS_PLACEHOLDER)
  because they need per-element customization after page.hover/page.click
- Fallback to `extraction-reference.md` if Glob can't find scripts (plugin cache issue)

Official docs confirm: skills can bundle and run scripts in any language, and all files
in the skill directory are included in the plugin cache on install.

## Lesson 24: Scripts must NOT use IIFE wrappers

Playwright's `page.evaluate` wraps your code in `() => { ... }` automatically.
If the script uses an IIFE pattern `(function() { ... return result; })()`, the IIFE's
return value gets swallowed 鈥?the outer arrow function has no `return`, so the result
is `undefined`. Scripts must use bare `return` statements at the end so they work
inside Playwright's wrapper.

## Lesson 25: Use Write tool for JSON caching, never Bash/Python

Writing extraction JSON to disk via Bash generates 100+ line Python scripts in the
permission prompt. Users see an intimidating wall of code they can't evaluate. The
Write tool does the same thing with a clean one-line prompt: "Write to
./webclone-extraction-ramp.json". Always prefer Write for file creation.

## Lesson 26: Measure time-to-build as a quality metric

End-to-end wall clock time from `/webclone <url>` to verified clone is a core quality
metric. Fewer tool calls = less latency. Fewer permission prompts = less user
friction. Pre-built scripts should reduce both. Track this per site in
`tests/{site}/metrics.json` alongside tool call counts and extraction JSON size.

## Lesson 27: Sidebar container styles need dedicated extraction

Sidebar items (nav links) were extracted but the container (border-right, background-color,
padding, width) was not. The build agent had item styles but no container frame 鈥?so it
guessed the border. Add container styles to extract-visual.js sidebar section.

## Lesson 28: Per-section background colors must be in the structure map

extract-structure.js captured layout properties but no colors. The build agent used a single
background for the whole page instead of the real off-white main / white cards pattern.
Add backgroundColor to the structure extraction return object.

## Lesson 29: Progress bars need dedicated extraction like tables

Budget bars, loading indicators, and progress meters aren't covered by any generic query.
Without a specific extraction step, they're invisible to the build. Add a progress bar
section to extract-visual.js.

## Lesson 30: Status indicators may use CSS pseudo-elements, not SVGs

Policy status dots on Ramp are `::before` pseudo-elements with background-color, not SVG
icons. The SVG extractor finds nothing. Add a status indicator section that checks both
the element and its ::before pseudo-element.

## Lesson 31: extract-visual.js MUST have a size guard

extract-structure.js had a 20KB size guard. extract-visual.js did not. It returned 69K
chars on the Ramp test, exceeding tool output limits. Every extraction script must have
a size guard that progressively trims the largest arrays.

## Lesson 32: Hover extraction must be mandatory with a minimum count

SKILL.md said "extract hover states" but didn't enforce a minimum. Claude skipped it
entirely on all 3 pages. Enforcement requires: a checklist of element categories, a
minimum count (5+ per page), and a verification print statement.

## Lesson 33: Dropdown options must be extracted, never fabricated

The travel page showed "Multi-city" as a radio option that doesn't exist on the real site.
Claude fabricated it because the interaction extraction never clicked the radio group.
Add explicit rules: never fabricate options, and if not extracted, build in closed state.

## Lesson 34: Never use inline Python/Node scripts via Bash

Claude used `node -e` and `cat | python3 -c` to parse extraction results and write the
cache JSON. These produce terrifying 20+ line Bash permission prompts with import
statements, file paths, and string manipulation that users cannot evaluate. The fix:
use Read tool to read files, compose JSON in reasoning, use Write tool to save. Ban
`python3 -c`, `node -e`, and all inline scripts entirely 鈥?no exceptions.

## Lesson 35: Do not resize the browser viewport

Resizing Playwright to 1920脳1080 clips content on laptops with smaller screens. The
right side of the page moves off-screen, and extraction misses those elements. Use
whatever viewport the browser opens with 鈥?getBoundingClientRect() captures exact
values regardless of viewport size.

## Lesson 36: Deduplicate SVGs instead of capping outerHTML

Most pages have 30-50 SVG elements but only 8-12 unique SVGs. The same icon
repeats dozens of times. Instead of capping outerHTML at a fixed char limit
(which truncates large logos), deduplicate by content hash and store each
unique SVG once with full fidelity. This keeps the payload small without
losing data. The size guard strips large SVG markup only as a last resort,
with a fallback batch script to retrieve them separately.

## Lesson 37: Single-shot scrollTo misses progressive-load content

`window.scrollTo(0, document.body.scrollHeight)` fires once and reaches the
initial bottom 鈥?but on pages like Airbnb, new content loads as you scroll,
which increases `scrollHeight`. A single shot never triggers that lazy loading.
The fix: scroll incrementally by `window.innerHeight`, wait 1.5s for content
to load, check if `scrollHeight` changed, repeat until stable. This is the
root cause of missing swimlanes (2 of 9), missing footer, and missing
category bar on the Airbnb clone 鈥?the extraction only captured 29% of text
nodes because 71% of the page was never scrolled into view.

**SKILL.md change:** Phase 1.3 now uses `extract-scroll-to-bottom.js` instead
of single-shot `scrollTo`. Falls back to single-shot if the script isn't found.

## Lesson 38: Scroll-driven UI needs dedicated extraction

Headers that hide on scroll-down, search bars that collapse into compact pills,
category bars that become sticky 鈥?these behaviors are driven by JavaScript
scroll listeners and IntersectionObserver, not static CSS. `getComputedStyle()`
on a page at `scrollY=0` captures the resting state but completely misses the
transitions. The fix: after loading the full page, scroll back up and scroll
down slowly, capturing element state at each position. Diff the snapshots to
find which elements change and at what scroll threshold.

**SKILL.md change:** New Step 2.2.2 uses `extract-scroll.js` to capture scroll
behaviors. New build rules tell the build agent to implement these behaviors.

## Lesson 39: Never fabricate navigation controls

The Airbnb clone had "See all" links and "7 of 9 items showing" counters that
don't exist on the real site. The build agent invented them to make carousels
feel complete. But fabricated navigation is the clearest tell that a clone is
fake 鈥?it's UI that the user KNOWS isn't real because they use the real product.
If the extraction doesn't have it, don't build it. A carousel with just arrows
is better than one with fake navigation.

**SKILL.md change:** New build rule "NEVER fabricate navigation UI" added to
Step 4.4. Explicit ban on "See all", counters, and pagination unless extracted.

## Lesson 40: Extract CSS custom properties from :root

Sites like Airbnb define their design system as CSS custom properties on `:root`
(e.g., `--color-primary`, `--font-sans`, `--spacing-unit`). Without extracting
these, the build agent invents semantic variable names from the color palette,
which often don't match the site's actual design tokens. The fix: read
`document.styleSheets` for `:root` rules and extract all `--` prefixed properties.
This gives the build agent the exact variable names and values the site uses.

**SKILL.md change:** `extract-visual.js` now includes a `cssCustomProperties`
section. New build rule tells the build agent to use these as the foundation
for `variables.css`.

## Lesson 41: Verification must be quantitative, not subjective

Phase 5 originally said "take screenshots and compare visually" 鈥?which means the
LLM eyeballs two images and says "looks close." This produces false positives every
time. The fix: extract quantitative fingerprints (color grids, element counts, landmark
positions) from both original and clone, diff the numbers, and apply pass/warn/fail
thresholds. A number like "78% color grid match" is actionable. "Looks similar" is not.

**SKILL.md change:** Phase 5 rewritten to use `verify-structure.js` and `verify-visual.js`
with explicit acceptance thresholds.

## Lesson 42: Annotated screenshots solve the "which element?" problem

When comparing two screenshots, the LLM says "the button on the right side is too wide"
鈥?but which button? On a dense page there are 30+ buttons. Numbered annotations
(`verify-annotate.js`) inject red circle labels on every interactive element so both
the LLM and the user can reference elements by number: "Element #7 is 15px wider in
the clone." This removes ambiguity from the verification report.

**SKILL.md change:** Phase 5 Step 5.4 uses annotated screenshots with element matching.

## Lesson 43: Structural fingerprints catch completeness failures that screenshots miss

A screenshot of a page with 3 tabs looks identical whether the other 2 tab panels
have content or not 鈥?they're hidden. `verify-structure.js` counts interactive elements,
headings, text nodes, nav links, and form fields. If the original has 12 interactive
elements and the clone has 7, that's a measurable gap. Structural comparison catches
missing tabs, missing form fields, and incomplete navigation that visual comparison
can't see.

**SKILL.md change:** Phase 5 Step 5.2 diffs element counts, heading hierarchies,
and interactive inventories with thresholds.

## Lesson 44: Visual fingerprints work without pixel-level image comparison

`page.screenshot` saves images to disk 鈥?but those images can't be loaded
into a canvas for `pixelmatch`-style comparison inside `page.evaluate`. The workaround:
sample a 16脳12 grid of background colors via `elementFromPoint()` on both pages. Two
cells match if each RGB channel differs by 鈮?0. This gives a quantitative "color grid
match %" without needing pixel-level image access. Combined with landmark position
comparison, this catches layout shifts, color mismatches, and missing sections.

**SKILL.md change:** Phase 5 Step 5.3 uses color grid and landmark position comparison.

## Lesson 45: Interaction testing needs a testable inventory, not ad-hoc clicking

Phase 5 originally said "click every interactive element" but didn't tell the agent
which elements to click or what to expect. `verify-interactions.js` classifies every
interactive element by type (tab/dropdown/accordion/button/input) and provides the
best CSS selector and expected behavior. The agent clicks each one, takes a snapshot
before/after, and evaluates whether the expected behavior occurred. This makes
interaction testing deterministic instead of exploratory.

**SKILL.md change:** Phase 5 Step 5.5 uses interaction inventory with per-element
pass/fail reporting.

## Lesson 46: Verification scripts must follow the same conventions as extraction scripts

The `verify-*.js` scripts use the same conventions as `extract-*.js`: `var` declarations,
`function` keyword, `Array.from()`, no IIFE wrapper, bare `return result` at the end,
size guard with `_truncated` flag, header comment with filename/purpose/return type.
Consistency means the Phase 5 instructions don't need special handling 鈥?the agent
already knows how to load and run these scripts from Phase 2 experience.

**SKILL.md change:** Step 5.0 loads verify scripts the same way Step 2.0 loads
extraction scripts.

## Lesson 47: Prose rules get ignored 鈥?action gates don't

The Ramp clone test (Feb 2025) violated 6 different SKILL.md rules, all of which
existed as prose instructions. The agent skipped them when context filled up. The
fix: every critical rule must be an ACTION (Read file 鈫?print result 鈫?STOP if wrong),
not prose ("remember to check"). Action gates force the agent to perform a verifiable
step that produces output 鈥?you can see whether it was done. Prose rules produce no
evidence of compliance.

Specific failures: only 1/3 pages extracted (despite 4 prose rules), 0 SVGs used
verbatim (despite 3 prose rules), systematic font-size downshift (despite "values
must be verbatim" rule), 0 hover states (despite minimum count rule).

**SKILL.md change:** Added Zero Tolerance Rules section, converted all checkpoints
to Read-Print-STOP action gates, added post-build value audit.

## Lesson 48: Heredoc scripts are inline scripts in disguise

The ABSOLUTE RULE banned `node -e`, `python3 -c`, and `cat | python3` 鈥?but the
agent found TWO loopholes:

1. **File-write heredoc**: `cat << 'EOF' > /tmp/script.mjs ... EOF && node /tmp/script.mjs`
   Writes a 60+ line Node script to a temp file via heredoc, then executes it.
2. **Piped heredoc**: `cat << 'PYEOF' | python3`
   Pipes a 160-line Python script directly to the interpreter. Used for color grid
   comparison in Phase 5 鈥?which Step 5.3 already says to do in reasoning.

Both produce the same terrifying wall of code in the Bash permission prompt 鈥?identical
UX to the banned patterns.

**SKILL.md changes:**
- Added both heredoc patterns to ban table (file-write and piped)
- Strengthened ABSOLUTE RULE intro to list heredoc scripts alongside other banned patterns
- Added "piping a heredoc to an interpreter IS an inline script" clarification
- Added multi-page combination workflow to Step 2.4 (compose incrementally, Write once)
- Added explicit "do NOT write a validation script" instruction to Step 2.6
- Added explicit "do this in your reasoning, not with a script" to Step 5.3 color grid

## Lesson 49: Context window exhaustion from monolithic pipeline

A 3-page Ramp clone consumed 400-800K tokens total, but the context window is ~200K.
The agent hit 0% context by Phase 2 of 5 鈥?the build and verification phases never
got a full context window.

**Fix:** Split the pipeline into subagent phases. SKILL.md becomes a lean orchestrator
(~200 lines) that runs Phases 0鈥? inline, then delegates Phases 2鈥?, 4, and 5 to
subagents via the Task tool. Each subagent gets a fresh ~200K context window. Data
flows between phases via disk files (`./webclone-scope-{domain}.json`,
`./webclone-extraction-{domain}.json`, `./webclone-output-{domain}/`).

**Architecture:**
- Phase files live in `skills/webclone-skill/references/`
- `extract.md` 鈥?self-contained Phases 2鈥? instructions
- `build-vue.md` 鈥?self-contained Phase 4 instructions (Vue version)
- `verify.md` 鈥?self-contained Phase 5 instructions
- Orchestrator constructs subagent prompts = variable header + phase file contents
- Inter-phase gates run in main context (lightweight: `ls`, `wc`, Read first 50 lines)
- Gates never read the full extraction JSON into main context

## Lesson 50: Three structural gaps from Round 1 Ramp clone

Round 1 found 12 issues. 7 were context exhaustion bugs (fixed by subagent split in
Lesson 49). 3 required structural changes:

1. **Parent container clipping missed on images.** `extract-visual.js` captured
   `borderRadius` on `<img>` elements (always 0px for avatars) but missed the parent
   container's `border-radius: 50%` and `overflow: hidden` that creates the circular
   shape. Fix: added `parentShape` field to image extraction 鈥?captures parent's
   borderRadius, overflow, width, height when parent clips the image. Build rule added
   to wrap images in a clipping container `<div>` when parentShape is present.

2. **Straddle-positioned elements had no build rule.** A button visually half-in,
   half-out of a card (e.g., "Add to your Ramp" CTA that straddles the card boundary)
   had no guidance. The build agent flattened it inside the card. Fix: added build rule
   to detect when an element's rect extends beyond its parent and recreate the straddle
   with `transform: translateY(50%)` or negative margin.

3. **Padding values silently rounded to "standard" increments.** Extracted padding of
   40px was built as 24px 鈥?the agent substituted a more "standard" value. Fix: added
   explicit build rule that padding values are exact and never rounded. 40px 鈮?24px.

**SKILL.md changes:** `extract-visual.js` parentShape field, `build-vue.md` Step 4.4
straddle + padding rules, `build-vue.md` Step 4.5 parentShape wrapping rule.

## Lesson 51: Single page first, multi-page later

**Source:** try.ramp.com clone (March 2026, Opus 1M context)

Cloning 3 pages simultaneously (Overview, Expenses, Travel) produced mediocre results
across the board. The Travel page was notably poor 鈥?extraction data spread thin across
3 pages, the build agent rushed through each, and verification was superficial.

The better model: clone ONE page + shared layout (sidebar/nav) perfectly first. The user
can add pages incrementally ("now add expenses") after verifying the first page is solid.

**Why this matters:**
- Extraction gets full context budget for one page's depth (hover states, interactions,
  scroll behaviors) instead of 1/3 of the budget per page
- Build agent can spend full attention on one page component, not juggling three
- Verification is thorough for one page instead of superficial for three
- Matches real usage: users care most about ONE page for their prototype

**SKILL.md change:** Phase 0 should default to single-page scope. The menu should
offer: (1) One page + sidebar, (2) Add another page (only after first is verified).
Multi-page should never be the default option.

