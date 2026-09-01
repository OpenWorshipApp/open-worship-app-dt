---
id: W-35
title: "Bring a song in from CCLI SongSelect"
section: "Keyboard shortcut reference (tutorial appendix)"
verify: [ST-52, PL-103, PL-104]
screenshots: 5
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-35 — Bring a song in from CCLI SongSelect

If your church has CCLI **SongSelect Partner API** access, the app can search SongSelect
and turn a song straight into a lyric document — no retyping. You need the API
credentials CCLI issued to you (a **Client ID**, a **Subscription Key**, and the
**Redirect URI** you registered; some clients also have a **Client Secret**).

> CCLI has retired new partner signups, so this only works with credentials you already
> hold. Everything below was driven live against a stand-in SongSelect server; the final
> sign-in hand-off to CCLI's real consent page is source-verified but **not observed**
> end-to-end, for want of real credentials.

1. Open **Settings → Others** (ផ្សេងៗ). Between the AI-key card and **Extra Binaries**
   there is a card headed **SongSelect Integration** (ការភ្ជាប់ SongSelect), with a
   **SongSelect ↗** button that opens songselect.ccli.com in your browser. 📸
2. Fill **Client ID**, **Subscription Key** and **Redirect URI** (and **Client Secret**
   if you have one). Each field saves the moment you click away from it and gains a
   green ✓. Until all three are filled, **Sign In** (ចូលគណនី) stays grey — hovering it
   tells you what is missing.
3. Click **Sign In**. A CCLI window opens for you to log in and approve. If you close
   it instead, the app says **Sign in failed — Sign in was canceled**
   (ការចូលគណនីត្រូវបានបោះបង់) and nothing changes. Once signed in, the card shows a
   green **Signed in** (បានចូលគណនី) with a **Sign Out** (ចាកចេញពីគណនី) button, and the
   app keeps the session refreshed by itself.
4. Back in the presenter, open the **Documents** list's **⋮ More Options**. A new entry,
   **Import From SongSelect** (នាំចូលពី SongSelect), now sits under
   **Download From URL** — it is only there while you are signed in. 📸
5. Click it. A floating **Import From SongSelect** panel opens (drag it anywhere; the
   app remembers where you put it). Type in **Search songs** (ស្វែងរកចម្រៀង) — results
   appear as you pause, with the writers, the CCLI song number, a line of the lyrics,
   and a **Public Domain** (កម្មសិទ្ធិសាធារណៈ) badge where it applies. Page through
   long result lists with the ‹ › arrows at the bottom. A song your account is not
   licensed to take has its download button greyed out. 📸
6. Click a song's ☁⬇ download button. A moment later the app confirms **Lyric document
   created successfully** (បានបង្កើតឯកសារអត្ថបទចម្រៀងដោយជោគជ័យ) and the song appears
   in your **Documents** list as a lyric (♪), named after its title. The panel stays
   open, so you can keep downloading; pulling the same song twice keeps both —
   the second becomes `<Title> (1)`. 📸
7. Click the new row: it previews slide by slide — an **Info** slide with the title,
   writers and the `CCLI Song #` copyright line, then one slide per part (**Verse 1**,
   **Chorus**, …). Present it like any other lyric (W-04), or polish the wording in the
   lyric editor first. 📸

> **If a search or download fails**, the reason shows right in the panel or as a toast:
> too many requests in a row asks you to wait a moment; a lapsed session says
> **SongSelect sign-in expired, please sign in again in Settings**; no internet says
> **Could not reach SongSelect**.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`ST-52` · `PL-103` · `PL-104`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
