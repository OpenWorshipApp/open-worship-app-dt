---
id: W-50
title: "Present on another computer with Screen Mirror"
section: "Screen Mirror"
verify: [SP-25, SP-26, SP-27]
screenshots: 0
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-05"
---
# W-50 — Present on another computer with Screen Mirror

Use one app as the host and another as the guest. Both computers need the same
app version and a reachable network connection.

1. On the host's Presenter, open the Mini Screen list's bottom **⋮** and
   click **[en:tran:Screen Mirror Connection]**. Hosting is off until you
   turn on **[en:tran:Let other computers connect]** at the top of the
   floating panel — until then no other computer can find or join this one.
   Once it is on, the panel shows **[en:tran:Host addresses]** and
   **[en:tran:Port]**: the app serves HTTP and WebSocket on an available port
   from 39240–39259, and the switch stays on for the next launch.
2. On the guest, open the **[en:tran:Screen Mirror]** page. It has no app
   header — its one button, **[en:tran:Presenter]**, goes back — and it looks
   for hosts as it opens, listing them under
   **[en:tran:Hosts on this network]**; **[en:tran:Rescan]** looks again.
   The scan asks on every network this computer is on, at every port from
   39240 to 39259; a host that answers on several networks is listed once,
   on its best address (a real LAN before a virtual adapter or loopback), and
   the first host is filled into **[en:tran:Host address]** and
   **[en:tran:Port]** under **[en:tran:Connect by address]** — never over
   an address you typed or a host you picked. Pick another host or type an
   address if needed, then click **[en:tran:Connect]**. In approval mode the guest reads
   **[en:tran:Waiting for host approval]** while the host clicks
   **[en:tran:Allow connection]** in the floating panel.
3. The guest reads **[en:tran:Connected]**, and under
   **[en:tran:This computer]** its monitors carry the prefix the host knows
   it by, such as a1 — the name to pick in the host's display picker. The
   host lists it under
   **[en:tran:Connected guests]** above the Mini Screen previews and at the
   top of their list menu. Each guest has a stable prefix such as a1 or a2;
   click its header button to open the connection panel.
4. Choose the guest's prefixed monitor in the screen card's display picker.
   Present a slide and a background image, then use the card's show control
   (F5). The guest opens the presentation output on that monitor, in front
   of its own app window. Images and
   other host files load through the host's HTTP service; the guest does not
   need its own copy of them.
5. Close the floating panel with its **✕**, or toggle
   **[en:tran:Screen Mirror Connection]** again. The connection and its
   header entry stay active. To end the connection, use
   **[en:tran:Disconnect]**. The guest output closes and its entry leaves
   the host's connected-guest header.
6. In **[en:tran:Background]** → **[en:tran:Cameras]**, the host also lists
   connected guests' cameras with their prefixes. Selecting a camera streams
   it to the host preview and to the selected guest output. Selecting an
   image instead releases the camera stream. Camera access must be available
   on the computer providing it.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`SP-25` · `SP-26` · `SP-27`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-05).
:::
