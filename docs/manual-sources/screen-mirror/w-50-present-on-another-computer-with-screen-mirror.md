---
id: W-50
title: "Present on another computer with Screen Mirror"
section: "Screen Mirror"
verify: [SP-25, SP-26, SP-27, SP-28, SP-29]
screenshots: 0
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-09"
---
# W-50 — Present on another computer with Screen Mirror

Use one app as the host and another as the guest. Both computers need the same
app version and a reachable network connection — the same network, or the
internet once the host opens to it (step 7).

1. On the host's Presenter, open the Mini Screen list's bottom **⋮** and
   click **[en:tran:Virtual Screens Manager]**, then pick the floating
   panel's **[en:tran:Screen Mirror Connection]** tab. The panel remembers
   which tab was open and whether it was open at all. Hosting is off until you
   turn on **[en:tran:Let other computers connect]** at the top of the tab —
   until then no other computer can find or join this one.
   Once it is on, the panel shows **[en:tran:Host addresses]** and
   **[en:tran:Port]**: the app serves HTTP and WebSocket on an available port
   from 39240–39259, and the switch stays on for the next launch. Under
   **[en:tran:This network]** each address of this computer is written as
   `address:port` (for example `192.168.1.3:39240`) with two buttons:
   **[en:tran:Copy address]** puts that text on the clipboard, and
   **[en:tran:QR code]** shows it as a QR code under the row. The code holds
   the same plain text, not a link, so a phone that scans it offers the words
   to copy. **[en:tran:Copy image]** under the code copies it as a picture,
   with the address written beneath it, to send to whoever sets up the guest.
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
   address if needed, then click **[en:tran:Connect]**. An address someone
   sent you needs no retyping: **[en:tran:Paste address]** fills
   **[en:tran:Host address]** and **[en:tran:Port]** from whatever was
   copied — `address:port`, a whole `http://` link, an IPv6 address in
   brackets, or a picture of the host's QR code — and
   **[en:tran:Read QR code]** does the same from a picture file you choose.
   Pasting `address:port` straight into **[en:tran:Host address]** splits it
   too, and a picture pasted anywhere in the form is read as a QR code. A
   clipboard with no address in it reads
   **[en:tran:No host address found in the clipboard.]** and leaves the form
   as it was. In approval mode the guest reads
   **[en:tran:Waiting for host approval]** while the host clicks
   **[en:tran:Allow connection]** in the floating panel.
3. The guest reads **[en:tran:Connected]**, and under
   **[en:tran:This computer]** its monitors carry the prefix the host knows
   it by, such as a1 — the name to pick in the host's display picker. The
   host lists it under
   **[en:tran:Connected guests]** above the Mini Screen previews and at the
   top of their list menu. Each guest has a stable prefix such as a1 or a2;
   click its header button to open the connection panel. In the panel every
   guest and every request carries where it came from:
   **[en:tran:This network]** for a computer on one of the host's own
   networks, or **[en:tran:Internet]** — a globe and an amber border — for
   one from outside. The header button of an internet guest is amber with a
   globe as well.
4. Choose the guest's prefixed monitor in the screen card's display picker.
   Present a slide and a background image, then use the card's show control
   (F5). The guest opens the presentation output on that monitor, in front
   of its own app window. Images and
   other host files load through the host's HTTP service; the guest does not
   need its own copy of them. They load from the address the guest dialled,
   so a guest that reached the host through a router gets them through that
   router too.
5. Close the floating panel with its **✕**, or toggle
   **[en:tran:Virtual Screens Manager]** again. The connection and its
   header entry stay active. To end the connection, use
   **[en:tran:Disconnect]**. The guest output closes and its entry leaves
   the host's connected-guest header.
6. In **[en:tran:Background]** → **[en:tran:Cameras]**, the host also lists
   connected guests' cameras with their prefixes. Selecting a camera streams
   it to the host preview and to the selected guest output. Selecting an
   image instead releases the camera stream. Camera access must be available
   on the computer providing it.
7. To let a guest connect from outside this network, turn on
   **[en:tran:Open to the internet]** under
   **[en:tran:Let other computers connect]**. It is off until you turn it
   on, and remembered. A warning says that anyone with the address can ask to
   connect and that the connection is not encrypted (folded to one line; its
   chevron, or a click on it, shows it all — the router and tunnel notes fold
   the same way, and each stays as you left it): choose
   **[en:tran:Require connection code]** under **[en:tran:Guest access]**,
   and turn the option off when you are done. The host asks the router to
   forward its port (UPnP); once **[en:tran:The router opened the port.]**,
   an **[en:tran:Internet]** list shows the router's public address marked
   **[en:tran:Router]**, and any global IPv6 address of this computer marked
   IPv6 — which works only if the router lets incoming connections through.
   When no router answers, or it refuses, the panel says so and shows the
   port and this computer's address to forward by hand on the router;
   **[en:tran:Ask the router again]** tries once more. A public address or a
   DDNS name typed into **[en:tran:Public address (optional)]** and saved
   with **[en:tran:Save address]** is listed too. Every internet address has
   the same copy and QR buttons. A router that sits behind another network
   (carrier NAT) cannot be reached from the internet at all; the panel says
   so and suggests a VPN such as Tailscale instead. Turning the option off
   removes the router's port forward and ends every guest that came from the
   internet — the ones on this network stay. While it is off, a computer
   outside this computer's own networks is refused. Five wrong connection
   codes from one sender lock it out for ten minutes.
8. A guest can be linked to several hosts at once. Once one is connected,
   **[en:tran:Hosts on this network]** and **[en:tran:Connect by address]**
   stay under its panel: pick or type another host and click
   **[en:tran:Connect]** again. Each host gets a panel of its own — its own
   status, the prefix that host gave this computer, and a
   **[en:tran:Disconnect]** that ends only that link. A host already linked
   reads **[en:tran:Connected]** in the list and cannot be picked again;
   connecting to it a second time by address is refused with
   **[en:tran:Incompatible or duplicate connection]**. A link that failed —
   a wrong code, say — keeps its panel with the reason, and its host can be
   picked again to retry. Two hosts can each show a screen on this computer
   at the same time.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`SP-25` · `SP-26` · `SP-27` · `SP-28` · `SP-29`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-09).
:::
