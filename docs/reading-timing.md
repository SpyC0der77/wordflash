# Reading timing

Playback and reading-time estimates both use `getWordTiming` from `@wordflash/core`. A token's display duration is its base time plus attention time plus a boundary pause. All additions scale by `250 / WPM`; the base is `60000 / WPM`, with a 30 ms minimum. Delays are rounded to whole milliseconds. The last word receives its full duration before playback completes.

These are deterministic, English-oriented reading heuristics, not measured speech durations or a linguistic parser. The WPM setting describes the base pace; pauses and attention adjustments make effective throughput lower.

## Boundary pauses

| Boundary | Delay at 250 WPM with default settings |
| --- | ---: |
| Comma | 250 ms |
| Colon, semicolon, em dash, en dash, double hyphen | 313 ms |
| Closing parenthesis or bracket without sentence punctuation | 125 ms |
| Period, question mark, exclamation mark, ellipsis | 500 ms |
| Manual line break | 1,000 ms |

Comma pauses use the speech-break setting. Stronger clause boundaries use 1.25 times that setting; closing asides use half. Sentence pauses use the sentence-end setting, and line breaks use twice that setting. Overlapping boundaries use the strongest pause, so a period before a newline does not add a second sentence pause. Repeated punctuation does not stack delays. Closing straight or curly quotes and nested brackets do not hide the punctuation inside them.

Periods inside decimal numbers are not sentence boundaries. Titles and initials followed by another token are treated as continuations. Common abbreviations and dotted acronyms normally continue a sentence; a following capitalized sentence-start word, such as “The” or “Bring”, can indicate a new sentence. At the end of the document, a final period receives a sentence pause. These rules cannot resolve every ambiguity: “U.S. Army” and “U.S. Morgan arrived” may look structurally similar without deeper language analysis.

The existing parser splits attached em dashes and double hyphens after the dash, retaining it on the preceding word. Ordinary hyphenated words, dates, and numeric ranges stay intact. Standalone punctuation remains a displayed token, preserving reader-view word indices.

## Article markup

Article playback and word highlighting share the same text stream. Inline tags
do not insert spaces: `un<em>believ</em>able` is one word, and punctuation after
bold text or a link stays attached. Fragments of a word share one highlight
index while retaining their original markup. Paragraphs, headings, list items,
and table rows create line breaks; adjacent table cells create word boundaries.
Explicit `<br>` breaks remain intact. Script, style, template, and explicitly
hidden content do not receive reading indices. Supported hiding mechanisms are
`hidden`, `aria-hidden="true"`, and inline `display: none` or `visibility: hidden`.
Stylesheet-based hiding is not evaluated by the detached article parser.

## Attention time

Only the largest attention adjustment applies to a token:

| Trigger | Extra time at 250 WPM |
| --- | ---: |
| First unfamiliar proper-noun component | 250 ms |
| Digits | 80 ms for the first digit, plus 30 ms per additional digit |
| Formatted numeric token | Additional 60 ms within the numeric adjustment |
| Long word | 20 ms per letter beyond eight, capped at 180 ms |

Numeric attention is capped at 360 ms. Formatting includes decimal/grouping separators, currency, percentages, dates, times, signs, and fractions. Trailing sentence punctuation does not make a number more complex. Unicode decimal digits are counted. Numeric values receive attention each time they appear, since a later number may differ by only one digit.

Proper-noun recognition uses the existing gazetteer and document context. Familiar English words, including names such as Will, May, and Hope, remain excluded. For a multiword name, one unfamiliar component receives the first-mention dwell. If an earlier component is already familiar, the dwell moves to the new component. Commas, dashes, and sentence punctuation prevent adjacent names from being merged into one span. ALL CAPS is not automatically classified as a proper noun. A partial reading-time estimate uses the full document's first-mention flags, so seeking does not reclassify every repeated name as new.

For example, at 250 WPM with default settings:

| Token | Base | Attention | Pause | Total |
| --- | ---: | ---: | ---: | ---: |
| `word` | 240 | 0 | 0 | 240 ms |
| `word,` | 240 | 0 | 250 | 490 ms |
| `word—` | 240 | 0 | 313 | 553 ms |
| `2026` | 240 | 170 | 0 | 410 ms |
| `$1,234.50,` | 240 | 290 | 250 | 780 ms |
| First `Morgan` | 240 | 250 | 0 | 490 ms |

Setting both punctuation delays to zero disables boundary pauses while retaining attention time. Invalid or negative delay settings become zero; invalid or sub-one WPM becomes one.

## Validation

Run `bun run test`, `bun run lint`, and `bun run build` from the repository root. Timing regressions cover punctuation and quotes, abbreviation context, numeric formatting, first mentions, bounded adjustments, WPM scaling, invalid settings, and agreement between playback durations and full/partial reading-time estimates.
