# What makes a preaching lesson good — the standard a lesson is judged by

The goal this file serves (2026-11-10, the user): _chatbot completely smart
enough to help prepare a best preaching lesson_. "Best" is not the
assistant's own reading of its own lessons. It is this standard, written from
the homiletics textbooks seminaries teach preaching from, applied by a reader
who did not write the lesson and is told nothing about how it was made
(BN-66).

Two halves:

- **Structure, by machine** — `scripts/lesson-rubric.mjs` reads the note the
  chatbot wrote (`owa_note_edit read`) and checks ten things a script can
  hold: the passage printed, every part present, three numbered points each
  with its verses and more than a line, questions, a memory verse, no empty
  line, a length that fits the form, nothing written twice.
- **Quality, by a blind reader** — the twelve criteria below, scored 0–2,
  on the lesson as text (`toLessonText`), with the ask that produced it and
  nothing else.

A lesson the chatbot writes is a DRAFT for a preacher — an elderly lay
preacher, often — to read, pray over and make their own. So the standard asks
whether it is a draft a good preacher would be glad to start from, and
whether anything in it would mislead the people who hear it.

## The sources

- Haddon W. Robinson, _Biblical Preaching: The Development and Delivery of
  Expository Messages_ (Baker Academic, 3rd ed. 2014). A sermon carries ONE
  big idea, drawn from the passage: a subject (what it is talking about) and
  a complement (what it says about it). Each part of the passage is developed
  by three questions: what does it mean (explanation), is it true (meeting a
  hearer's honest doubt), and what difference does it make (application).
- Bryan Chapell, _Christ-Centered Preaching: Redeeming the Expository Sermon_
  (Baker Academic, 3rd ed. 2018). The Fallen Condition Focus: the need in
  the hearers, shared with the passage's first readers, that the passage's
  grace answers. Each main point carries explanation, illustration and
  application; application says what to do, where, why and how. The sermon
  shows where its passage stands in God's work of redemption in Christ,
  growing out of the text rather than added to it.
- John R. W. Stott, _Between Two Worlds: The Art of Preaching in the
  Twentieth Century_ (Eerdmans, 1982). Preaching builds a bridge between the
  world of the Bible and the hearers' world: true to the first, plain in the
  second.

## The twelve criteria (0 = missing or wrong, 1 = present but weak, 2 = done well)

| # | Criterion | 2 looks like | 0 looks like |
| --- | --- | --- | --- |
| A | **Faithful to the passage** (Robinson) | Every statement about the text is what it says and means in its context; references and quotations right | A verse misquoted or misattributed, a detail the passage does not have, a meaning it does not carry |
| B | **One big idea** (Robinson) | One sentence, subject + complement, drawn from this passage; the lesson serves it | None, or one so general it fits any passage |
| C | **Background** (Stott) | Accurate setting — who, when, why written, where it sits in the book — that changes how the passage is heard | Missing, or wrong history |
| D | **Points from the text** | The points follow the passage's own movement, each anchored to its verses, parallel, building toward the big idea | Points imposed on the passage, or no order |
| E | **Explanation** (Robinson: what does it mean?) | Each point explains its verses — words, images, customs — and meets a hearer's honest question | Restates the verse |
| F | **Illustration** (Chapell) | A concrete, believable example from life for each point, fit for the hearers | None, or clichés |
| G | **Application** (Robinson, Chapell) | Specific: what to do, where, this week; for these hearers; resting on grace, not effort alone | "Trust God more" |
| H | **The human need** (Chapell's FCF) | Names, early, the need in us the passage answers, and the lesson answers it | No need named |
| I | **Christ and grace** (Chapell) | Shows how the passage leads to Christ's work, grown from the text | Moralism with no grace, or Jesus tacked on |
| J | **Introduction** (Robinson) | Catches attention, raises the need, leads into the passage | Missing, or a summary of the sermon |
| K | **Conclusion and response** | Gathers the big idea, calls for one clear response; a prayer that fits | Missing, or a list of everything again |
| L | **Fit for hearers and preacher** | Plain words; the form and length asked for (sermon, devotion, children's); preachable as written; questions that open the text and life; a memory verse that carries the big idea | Not usable as asked |

**Total out of 24.** The bands:

- **Best** — 20 or more, A scored 2, no criterion 0.
- **Good** — 16 or more, A at least 1.
- **Needs work** — anything else. A lesson with any factual error about the
  Bible (A = 0) is never better than this, however well it reads: a preacher
  trusting the draft would carry the error into the pulpit.

## How a run is judged

1. `scripts/run-lesson-asks.mjs` asks each line of `references/lesson-asks.json`
   through the real help window on a SCRATCH profile: a new empty note, its
   **Open in Chatbot**, the ask typed as a person types it (or, for a
   `finish` row, a partial lesson written first and _finish my sermon_
   asked). One JSON line a lesson: the ask, the calls, the answer, the note's
   blocks, the seconds.
2. `node scripts/lesson-rubric.mjs <results.jsonl>` prints the structure
   checks; `--text <dir>` writes each lesson as text for the reader.
3. A reader who did not write the lessons — a sub-agent told only this file,
   the ask and the lesson, never the model, the prompt or what was changed —
   scores each criterion with one quoted line of evidence, lists every
   factual error with its reference, gives the band and the one change that
   would most improve the lesson. Two readers on different models agree or
   the lesson is read a third time.
4. A criterion most lessons miss is a BN item on the shape the chatbot is
   given (`PREACHING_LESSON_SHAPE`, `LESSON_OUTLINE`), never a change to this
   standard to pass.

A `finish` row is held to the same standard plus one rule of its own: every
line the preacher wrote is still there, expanded in place, and none of it is
written twice.
