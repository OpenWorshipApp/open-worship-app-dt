---
name: corpus-run-in-a-shared-dev-app
description: "A script that asks the help window many questions must own its tab, type nothing, undo only its own doing, stop by its STOP file and pace under the spend guard — a run on 2026-10-12 emptied the user's own chat tab, filled their Alt+Up history and hid another session's test screen four times"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5b07f182-3f35-46de-a795-58cdc0a98502
  modified: 2026-10-13T16:16:04.815Z
---

Rules for any driver that asks the corpus through the real 🤖 window — the
kept one is `.claude/skills/owa-enhance-chatbot/scripts/corpus-run.mjs`, and
each rule below is a mistake its first version made on 2026-10-12, with the
user's dev app and a second session's live test on the same machine.

- **It owns its tab, or it stops.** The first version emptied "the tab in
  front" with `/clear` between questions and closed "the last tab" at start.
  With two drivers alive at once (next rule) the tab in front was the USER's
  own conversation, and its seven messages were cleared — nothing on disk to
  bring them back. Now: a tab per question, closed only after it is shown to
  be that tab (its place in the strip, the tab count, this question as its
  first message); anything else exits without a press.
- **Stopping the task does not stop the driver.** On Windows the background
  task's stop killed the shell and left `node` running: two old drivers ran
  on under a third. A pid lock file keeps it to one, a STOP file ends it
  after the question in flight, and anything left is ended by process id
  (`Get-CimInstance Win32_Process` filtered on the script's name) — and
  counted afterwards.
- **It types nothing.** A question typed into the box goes into the
  window's Alt+↑ history — thirty entries, one list for the whole window — and
  a typed run pushed every question of the user's out of it. Questions are
  pressed in **More… — everything it can answer**, as a person picks one:
  not recorded, and it tests that list row by row.
- **It undoes only what its own question did.** The dev app is shared. A
  screen that came on during a question had been shown by another session for
  its own test, and hiding it "to put things back" broke that test four
  times. What a question left behind is recorded; only a walkthrough card the
  question's own tool call started is closed. The driver contains no
  `owa_hide_screens` at all.
- **The spend guard counts it as a runaway, and it is right.** 150 model
  calls in a rolling hour pause the assistant until a person presses **Allow
  more** — never a script ([[chatbot-spend-guard]]). At three rounds a
  question that is forty-five minutes of corpus. Pace under it from the first
  question (`--pace=135`), and when the hour is already spent ask the user
  for the one press before starting. Rows answered while paused are the
  guide's, not the model's: mark them and ask them again.
- **A wait for that press reads the guard's own corner, not its words.**
  `.chat-spend.is-paused` in the head row is the latch (the head has to be
  unfolded to read it). A search for a button reading _Allow more_ would
  never have seen the press: one of the 💡 tips under the box is a button
  with those words in it, and so is the one under every answer given while
  paused. Believe a lifted pause only after three reads running — another
  run may be opening tabs in the same window. The guide still answers while
  paused, so a no-model pass can use the wait; the lock makes a second
  driver exit at once, so that pass has to leave (a STOP file) before the
  model pass is started, not find out from it.
- **A reload of the window under a question takes the ask with it.** A save
  under `src/chatbot` by ANY session hot-reloads the help window: the
  question stays in its tab, no answer ever comes, nothing is busy, and a run
  that waits for an answer waits out its whole timeout -- seven minutes a
  time. Read when the page was loaded (`performance.timeOrigin`) before and
  after: a change means the row was not answered, and it is asked again. A
  reload that lands between two questions changes the tab in front instead,
  and the run stops on its own rule. Ask the other session to say when it is
  done saving, and hold your own saves and the knowledge rebuild for a gap.
- **Grade the answers, not the bill.** The first change of that day halved a
  local model's tokens on the same questions, and its graded answers were no
  better; the questions about one long page were worse. Rounds, tokens and
  seconds say what a change costs. Only reading the answers against the page
  says whether it helped.
- **Look at the fastest answers first.** An answer that came back in under
  a second was not written by a model. Seventeen of 407 did, all the same
  words: a shortcut in the window had taken them (`EC-250`), and no grader
  would have said so -- each only saw one wrong answer.
- **The pages the graders read go stale under a long run.** Another session
  regenerated three guide pages mid-pass; answers after that were written
  from the new pages and graded against the old snapshot. Read the pages
  again before every grading batch, and say which changed.
- **A row that asks the assistant to DO something makes it do it.** The
  corpus has them on purpose (_Can you start a 5 minute countdown on the
  screen?_, _Can you take me to the Bible Reader?_, the fill-in rows), and a
  model with the tool calls it. On 2026-10-12 the countdown was started for
  real, on a screen that was off, and was still held three hours later,
  counting the time over: the run RECORDS what a question left behind and
  undoes only a walkthrough card, and nobody read the record. Read it when
  the pass ends, and take off what your own question put up with the tool's
  own `stop`, only while no screen is showing and only when what is held is
  exactly that. **A list of rows asked AGAIN carries the same rows**: that
  night the countdown row sat in a re-ask list of 84 and was started a
  second time, found twenty-four minutes later in the driver's own
  `screens [… "foreground":1]` line. Read that line after every list, not
  once at the end of the night -- or leave the rows that act out of a list
  that is only about a changed page.
- **The pace cap bounds a night of re-asks**: about 142 model rounds in any
  hour, whoever asks. Three rounds of fixes each wanted 50 to 120 rows
  asked again; plan them by what each proves and ask the telling ones
  first, because the cap -- and the model's machine going to sleep -- may
  end the night before the last list. A second way to save rounds: when a
  fix changes pages, land it BEFORE the run reaches those pages' rows.
- **A fill-in row is tested the way it is met**: picked in the list (it
  FILLS the box and asks nothing -- check both), finished, asked, and the
  buttons under the answer pressed. What a button makes is put back with the
  app's own undo and by nothing else: the Bible flow's **Undo** button, and
  `owa_undo` by the id of the change for a song the **Create** button made
  (its `list` shows both the change and its undoing). The kept driver does
  not press buttons; the walk of 2026-10-12 was a scratch extension of it.
- **A row that would present: lock the screen, or get the person's word.**
  A LOCKED screen refuses a new verse and a new foreground extra in the
  app's own code, so with no word from the person: lock it by its padlock,
  ask, unlock, and compare what it holds with before (the model was told
  the screen was locked and said so; it did not press the padlock) -- and
  say in the report that the row was asked that way. With their word, ask
  it for real: `owa_present_bible` with `action: "check"` says beforehand
  whether the passage the screen holds will resolve again, and presenting
  it again afterwards put back BOTH versions of a two-version passage --
  the versions a screen shows are the screen's own, not the passage's
  (2026-10-12; assumed otherwise for an hour, and a question put to the
  user that a `check` and one look at the code would have answered).
- **Say what the run will do to a session that shares the app** before it
  starts (page switches, the pinned help window, a model that can press), and
  hold what that session asks you to hold. A where-is asked of the guide
  alone RINGS the control in the main window (`highlight: true`), so even a
  "read-only" pass is not one for those rows.
- **Reading the guide's own answers fast:** aim the window at a custom server
  that is not running on this computer. A refused connection falls back to
  the guide in a second; an address on the network that does not answer takes
  twenty.
- **An edit under `tools/owa-devtools-mcp/` can leave the OLD app up.** The
  watcher starts a second instance, which quits on the single-instance lock,
  and the first goes on serving the modules it cached
  ([[mcp-tool-edit-two-processes]]). `taskkill //PID <pid>` (no `/F`: it
  quits cleanly), then touch a watched file, and read the instance's
  `startedAt` before believing a tool result.

- **Batch the guide edits, then ask once.** A change to a page makes every
  row that rides that part stale. Seven small edits in one evening
  (2026-10-12) re-staled about 150 rows against a cap of 150 model calls an
  hour, and the last hour was spent waiting for room. And ask again only
  where something CHANGED: an unchanged failing row asked until it passes
  turns the model's noise into a better number -- 64 unchanged rows asked
  again came back with one new wrong among them.
- **A row already in the driver's out file is skipped.** A row to be asked
  again after a later change needs a NEW out file, with the earlier one
  named in `--pace-files`.
- **The test matrix names a control by its component as often as by its
  label.** Two guide items waited a whole evening as "not seen in the app"
  while the matrix held them as _Fix-dimension button_ and as the file
  tail's `Rename`. Search it by source path and component name before
  deciding that nothing records a thing.
- **Chart a page's questions across every asking before rewording another
  sentence of it.** On 2026-10-12 the running-order page's 27 questions
  were graded 125 times -- 48 right, 52 partly, 25 wrong -- and the wrong
  ones were different questions each time, while the 238 questions whose
  page rides whole had none wrong. Seven small rounds of rewording each
  ended one answer and surfaced another. When what fails sits on one long
  page and moves between askings, the finding is the page, not the next
  sentence: say so, with the chart, and put the structural choice to the
  user. (What it turned out to be, the next night: the local server was
  SAMPLING -- [[local-model-temperature-zero]]. Wrong answers that move
  between askings are a temperature before they are a page.)
- **It finds its app by PROFILE, never by "newest" and never by process.**
  On 2026-10-13 a second session started a scratch dev instance while a
  pass was running, the driver's helper took it for the newest, and a
  stray press landed in that session's app; and the user's own app was
  relaunched by its watcher five times in an hour, a new process each time.
  The discovery file names each instance's data folder: pin to the user's
  (its folder NAME is enough to tell it from a scratch one), take the
  newest instance of THAT profile, and fail when there is none.
- **Under `electron:dev` a question-list fix relaunches the app.** A save
  in `tools/owa-devtools-mcp/` -- `questions/*.json` included -- restarts the
  user's app under that watcher and takes the help window with it. Hold
  list fixes until the pass is between sweeps, save them together, and say
  that the app will restart.
- **A question is asked again by a line, not by rewriting the pass file.**
  A running pass appends to its file; a rewrite underneath it can lose the
  line being written. Append `{key, stale: true}` and let the reader drop
  the earlier answer.
- **A page regenerated during a pass makes that page's earlier answers
  stale.** Other work kept regenerating the manual mid-pass. Log which
  page bodies changed and when (a diff of the pages as the app serves them,
  without the dated foot note), and ask those pages' rows again at the end.
- **The model's machine can go away mid-pass, and the window still
  answers** -- from the guide, under _could not answer_. Those rows are not
  the model's: skip them when counting, stop the pass, and leave waking
  the machine to its owner.
- **The fill-in rows are part of the list: ask them in the same pass.**
  On 2026-10-13 the nine were left for last as "tested the day before";
  asked on the final state, one was wrong -- _Where is the button for
  Clear All_, four rounds of reading the guide and the wrong place -- and
  it was the row that had been made a fill-in that same day. Pick each in
  the list (`--templates --pick-templates`), press nothing under the
  answers, and keep the row that would present for the end, with the
  screen locked.
- **Rounds asked outside the pass file are not in the driver's count.**
  A check asked by hand in a tab of one's own, and a second out file
  not named in `--pace-files`, were eleven model calls the driver did
  not know of: the window said _122 of the 150 model calls an hour are
  used_ while the driver believed 110. Name every file, and pace lower
  (`--pace=125`) after asking anything by hand.
- **A watcher started before its script changed still runs the old
  line.** Four times on 2026-10-13 the user's app was relaunched within
  a second of `node extra-work/build-knowledge.mjs`, although
  `electron:watch` ignores `electron-build/knowledge`: the watcher in
  their terminal had been started two days before, ahead of that flag,
  and its own command line (read off the process) had no `--ignore`. A
  watcher started since does ignore it -- a throwaway nodemon over a
  scratch folder did not restart on a rebuild; and emptying the folder
  instead of removing it changed nothing, so the script was not the
  cause. Read the running watcher's command line before believing the
  script; with an old one, batch the `.claude/` edits, rebuild once
  between passes, and say that the app will restart.

**Why:** every one of these was a silent wrong — a cleared conversation, a
history full of somebody else's questions, a test that would not stay shown —
and none raised an error in the run that caused it.

**How to apply:** use the kept script rather than writing a driver; when one
must be written, start from these rules. Related:
[[chatbot-cdp-driver-gotchas]], [[bash-heredoc-halves-backslashes]],
[[dev-hmr-stale-state-qa]].
