---
id: W-61
title: "Change a foreground component with the assistant (a countdown, a marquee, a quick text for a verse)"
section: "Creating & editing content"
verify: [PM-174, CB-172, CB-183]
screenshots: 1
generatedFrom: user-workflows.md
workflowsVersion: "2026-11-22"
---
# W-61 — Change a foreground component with the assistant (a countdown, a marquee, a quick text for a verse)

**Goal:** have the help window set up and change the **[en:tran:Foreground]** extras (W-09)
for you: start a countdown for so many minutes, put a message scrolling along the top, make
a quick text of a Bible verse, and change how one looks or where it sits on the screen.

1. In any chat, type what you want: _Start a countdown for 5 minutes_, _Show the top
   marquee saying Welcome to our service_, _Make a quick text for John 3:16_. The assistant
   writes it into a NEW session of that panel, named after what it holds (`5:00`,
   `Welcome to our service`, `(KJV) John 3:16`). It opens the panel on that session and
   does what the panel's own Show or Start button does on the ticked screens, with the
   panel's own look. A session that already holds the same, or already has that name, is
   used again; what you typed in another session is never written over. A verse is read
   from the Bible the Bible Lookup is on, never from the assistant's memory. A new verse
   quick text gets the **[en:tran:Bible Verse]** preset (W-09), and any component can be
   given one of its own presets by name — _Make the countdown big in the center_, _Use the
   Speaker look_ (W-09 lists each component's). Words that should go away by themselves
   are a quick text with its time and place: _Show a message at the bottom of the screen
   for 15 seconds: the owner of car ABC 123, your lights are on_ puts them up at the bottom
   for 15 seconds. _Put the long text up_ shows the song or words a
   **[en:tran:Long Text Show]** session already holds; they go in on its panel (W-53).
   When the screen is off,
   the answer says so and offers its show button. The assistant never turns a screen on
   by itself. The session it put up or changed is attached to its answer, the same chip
   as step 3, so what you type next is about that one without naming it again: _make it
   bigger and red_, _pause it_, _take it off the screen_.
2. To talk about ONE session of a panel, attach it to the chat:
   - right-click a session's button on the panel's strip (**[en:tran:Default]**,
     **Session 2**), or press the **⋮** on the one you are on, and choose
     **[en:tran:Open in Chatbot]**; 📸
   - or press the robot in the panel's own header, beside its transition button (the **[en:tran:Long Text Show]** panel has none): it
     attaches the session you are on (**[en:tran:Camera Show]** and
     **[en:tran:Screen Show]** have no sessions, so their robot attaches the panel);
   - or, in the help window, press the **⋮** at the left of the box and choose
     **[en:tran:Attach a foreground session]**. It lists the panels open in the Presenter
     with their sessions. Pick one, or several one after another. When no panel is
     open, it says to open one from the **[en:tran:Foreground]** tab.
3. The session is attached under the box as _Quick Text › Session 2_. A card says what the
   assistant can change, with four buttons: **[en:tran:Show it on the screen]**,
   **[en:tran:Make the words larger]**, **[en:tran:Move it to the top]** and
   **[en:tran:Take it off the screen]**. The session goes with every question in that
   chat until you press the **×** on its **[en:tran:Still asking about]** line. Pressing
   the chip outlines its session button in the Presenter.
4. Press a button, or type what you want: _make it red_, _move it to the bottom left_,
   _make the words smaller_, _put a frame round it_, _put it behind the slide_, _make the
   marquee slower_, _pause the countdown_, _make it 10 minutes_, _change it to Psalm 23:1_.
   _Add 2 more minutes_ gives the countdown that is up two minutes more where it stands —
   running, it keeps running; paused, it stays paused with the time added — and never starts
   it over. _Clear everything from the foreground_ takes every extra off every screen, as
   **[en:tran:Clear Foreground]** (F10) does. Asked what is on a screen that is off, the
   answer names what it holds and says the screen is off.
   An attached session is changed in place. What it has on a screen changes at once, and
   its panel shows the new values. A change the component cannot take is refused in a
   sentence naming what it can. For example, a marquee always runs along its edge, so it
   cannot be moved.
5. The answer says what changed. After a session was started, or its words or look were
   changed, **[en:tran:Undo this change]** under it puts the panel's words and look back, and
   the screen as it was: a countdown or a Long Text Show it started comes off the screen
   again (a verse the long text had covered is back up), and a marquee that is up shows
   its old words again. One press takes back every session that answer
   changed (a countdown and a marquee started together come off together), and anything
   else on the screen stays; the window then names each one, saying whether it was taken
   away or is back as it was. Hiding, pausing, adding time and clearing everything
   keep no Undo: the answer says how to reverse them instead (_show it again_, _resume
   it_), and after a clear it names what it took off and offers to put that back. Words
   already put up come off with the panel's Hide button, or by asking _take it off the screen_.

**Not there?** **[en:tran:Open in Chatbot]** and the robots are there only while AI is on
(**[en:tran:Settings]** → **[en:tran:AI Providers]** → **[en:tran:Enable AI features]**). The panels
belong to the Presenter, so the assistant works on them while the main window is on the
Presenter. A video, picture or web page is named by a file in that panel's own folder,
and a camera by its name; the assistant never picks a file from elsewhere on the computer.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PM-174` · `CB-172` · `CB-183`

Regenerated from `user-workflows.md` (workflowsVersion 2026-11-22).
:::
