---
id: W-51
title: "Show screens on a virtual display and watch it from another device"
section: "Screen Mirror"
verify: [SP-30, SP-31]
screenshots: 0
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-09"
---
# W-51 — Show screens on a virtual display and watch it from another device

A virtual display is a monitor that exists only inside the app. Screens are
shown on it exactly as on a real monitor, and any phone, TV or computer can
watch it — in a web browser, or as a video in a media player — without a
cable or a second copy of the app.

1. On the Presenter, open the Mini Screen list's bottom **⋮**, click
   **[en:tran:Virtual Screens Manager]** and pick the floating panel's
   **[en:tran:Virtual Displays]** tab. The screen card's display picker gets
   there too: its last row, **[en:tran:Manage Virtual Displays]**, opens the
   same tab.
2. Click **[en:tran:Add Virtual Display]**. A display named
   **[en:tran:Virtual Display]** and its number is added at 1920 × 1080 with a
   black wallpaper, and its card opens. Up to eight can exist; a deleted
   display's number is never given to a new one, so an address someone saved
   never shows them a different display.
3. The card's header shows the name, the size and what it is doing:
   **[en:tran:Idle]** while nobody watches, **[en:tran:Live]** with the number
   of people watching. Its chevron folds the card. Inside,
   **[en:tran:Settings]** holds **[en:tran:Name]** (saved when you leave the
   box or press Enter), **[en:tran:Resolution]** — a size from the list, or
   **[en:tran:Custom]** with **[en:tran:Width]**, **[en:tran:Height]** and
   **[en:tran:Apply]** — and **[en:tran:Wallpaper]**:
   **[en:tran:None (black)]**, **[en:tran:Color]** (a colour box),
   **[en:tran:Image]** or **[en:tran:Video]** (each with
   **[en:tran:Choose File]**; a file that has gone reads
   **[en:tran:File not found]**). A video wallpaper plays on a loop, without
   sound. While someone watches, the card warns that changing the
   resolution restarts the stream for everyone watching — their player stops
   and has to be opened again. **[en:tran:Settings]** and
   **[en:tran:Where to watch]** each fold under their title; the card and both
   parts stay folded or open as you left them, also after a restart.
   **[en:tran:Preview]**, at the top of the card, shows the display inside it.
4. In a screen card's display picker, choose the display — it is listed as
   its name, **[en:tran:Virtual]** and its size, such as
   `Virtual Display 1 (Virtual): 1920x1080`. Present something and use the
   card's show control (F5): no window opens on any monitor; the screen shows
   on the virtual display instead, over its wallpaper. Several screens on one
   display are stacked in the order they were shown, the way they would be on
   a real monitor, and the card says so while they are.
   **[en:tran:Screens on this display]** under **[en:tran:Settings]** lists
   them. With no second monitor plugged in, songs and new slides are laid out
   for the virtual display's size, so they fill it. A screen showing on a
   virtual display is showing again, with what it held, when the app starts
   next time, so its viewers are not left on the wallpaper; hide it (F5) and
   it stays hidden. A screen on a real monitor never comes up by itself, and
   going to the Bible Reader, which hides every screen, keeps them all
   hidden.
5. Sound from a screen on a virtual display goes into what the display
   streams, not out of this computer's speakers: the Mini Screen's
   background audio player for that screen stays muted, but its play, pause,
   position and volume still drive the sound the viewers hear.
6. **[en:tran:Where to watch]** starts with the address to give someone,
   marked with a star and its QR code already open: this computer's best
   network (a router's 192.168 before a VPN or a virtual adapter), and any
   internet address you opened. Each address has **[en:tran:Copy address]**
   and **[en:tran:QR code]** (the code holds the whole link). Everything else
   folds under **[en:tran:More addresses]**:
   - **[en:tran:Watch in a browser]** — `http://<address>:<port>/vd/<number>/`.
     The browser draws the display itself from what the app sends it, so it is
     the fastest way to watch, and this computer encodes nothing for it.
   - **[en:tran:Video for media players (MP4)]** —
     `http://<address>:<port>/vd/<number>/video`, an H.264 + AAC MP4 for a
     player such as VLC or OBS. It is made only while someone plays it.

   The port stays the same from one launch to the next, so a saved address
   or a printed QR code keeps working after the app restarts.

   Until **[en:tran:Let other devices watch]** at the top of the tab is on,
   only **[en:tran:This computer]** addresses are listed and nobody else can
   watch. Turned on, it lists **[en:tran:This network]** addresses; turning
   on **[en:tran:Open to the internet]** as well (the same option as Screen
   Mirror's, with the same warning) lists **[en:tran:Internet]** ones. No code
   is asked for: anyone who has the address can watch.

   **[en:tran:Use HTTPS]**, under it (off until turned on), lists the browser
   addresses for other devices as `https://`, on the same port. A phone's
   page on this network can then do what a browser allows only a secure
   page: keep the screen awake in full screen, and send its microphone and
   camera. This computer signs its own certificate, so each browser warns
   once the first time it opens an address — continue past the warning
   (in Chrome, **Advanced**, then **Proceed**). **[en:tran:This computer]**,
   the tunnel's address and the MP4 are unchanged, and the `http://`
   addresses keep working.
7. The browser page fits the display to its window. Its
   **[en:tran:Full screen]** button (or a double-click on the picture) fills
   the screen, and **[en:tran:Exit full screen]** (or another double-click)
   leaves it; on a phone, full screen also turns the picture sideways where
   the browser allows it. The buttons show while the mouse is over the page
   and hide when it leaves; a tap on the picture shows them for a few
   seconds. The pointer shows over the picture only while they do.
   **[en:tran:Turn on sound]** is
   needed once, because a browser plays sound only after the page has been
   touched; until then the page plays everything silently. A camera put on
   the screen (Camera Show, or a camera background) is streamed from this
   computer to the page, on this network. **[en:tran:Cast to a TV]** puts
   the display on a TV:
   - **[en:tran:Cast from this browser]** — a TV on the same network as the
     device holding the page (at home, in another building), through the
     browser's own picker: Chrome and Edge list Google Cast TVs, Safari
     AirPlay ones. The app streams the display to the page for it, and the TV
     then plays it from the app itself, without the operator's
     **[en:tran:Allow connection]** or the connection code. When the browser
     knows no TV, the list says so. A browser that cannot cast (Firefox)
     says that too.
   - On the app's own network, the list also shows the TVs the app found
     there (Google Cast, DLNA, Roku): **[en:tran:Cast]** puts the display on
     one and **[en:tran:Stop]** takes it off; **[en:tran:Search again]** looks
     once more.

   On a page that may use a camera (an `https://` address from step 6, the
   tunnel's, or this computer's own), **[en:tran:Share my cameras]** opens a
   list of every camera of the device, each with **[en:tran:Share]**. A
   phone lists **[en:tran:Front camera]** and **[en:tran:Back camera]** until
   the browser has been allowed a camera, then every camera it has by name —
   a phone with several back lenses lists each one. The camera shared shows
   its picture above the list and reads **[en:tran:Stop]**; **[en:tran:Share]**
   on another one puts it in its place on every screen showing it, with
   nothing to add again. The app lists it among its cameras as
   `Browser <address>: <camera>`.

   The page keeps the device from sleeping while it is open. If the app goes
   away, the page reads **[en:tran:Waiting for the display]** and joins again
   by itself.
8. **[en:tran:Watching now]** lists everyone watching: **[en:tran:Browser]**
   or MP4, where they are (**[en:tran:This computer]**,
   **[en:tran:This network]** or **[en:tran:Internet]**), their address with
   their browser and device (such as `Chrome · Android` or `VLC`), and
   since when. A device that leaves the page, or drops off the network
   without a word (a phone gone to sleep), leaves the list by itself within
   about 40 seconds. **[en:tran:Disconnect]** ends one and keeps it out of this
   display for ten minutes: a browser by itself (other devices behind the
   same router are not touched), a media player by its address. The browser
   page then says the device was disconnected and stops trying. Its access to
   screen updates, camera streams and interaction ends immediately, even if
   its connection takes longer to close. Each one is
   listed under **[en:tran:Disconnected]**, where **[en:tran:Allow again]**
   lets it back in at once. **[en:tran:Preview]** shows the display
   inside the card, listed as **[en:tran:This app (preview)]**. A browser's
   row has **[en:tran:Allow interaction]**, off for every new viewer. Turned
   on, a hand on that browser's page reaches the app the way a hand on the
   projector's own window does: scrolling a passage or a tall slide, tapping
   a verse to pick it, and the screen's **✕** (top right, under the mouse)
   hiding that screen. Off, those stay on that device, and the **✕** is not
   shown. A browser keeps
   the permission when its page reloads, until the switch is turned off, the
   viewer is disconnected, or the app restarts. A media player has no switch.
9. **[en:tran:Delete Virtual Display]** asks first. The screens on it are
   hidden and go back to the main monitor, as when a monitor is unplugged,
   and everyone watching is disconnected.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`SP-30` · `SP-31`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-09).
:::
