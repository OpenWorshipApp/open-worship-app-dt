---
name: appfilepath-is-a-prototype-getter
description: "Fabricating a drop: `file.appFilePath = path` silently no-ops — it's a File.prototype getter, so use Object.defineProperty"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c79520e9-4e9b-492b-a13f-014b713bccc2
  modified: 2026-08-10T17:25:58.934Z
---

When driving a file drop through CDP, `appFilePath` must be stamped with
`Object.defineProperty(file, 'appFilePath', {value: path})`. Plain assignment
(`file.appFilePath = path`) **silently does nothing**: the electron preload defines
`appFilePath` as a **getter on `File.prototype`** with no setter, so in non-strict page
context the write is dropped and the getter keeps answering `''`.

**Why:** the failure is invisible and looks exactly like an app bug. `getAppFilePathFromFile`
sees `''`, returns `null`, and the drop handler `continue`s — no popup, no toast, no console
error. During run `20260810-1238` this made the Bible XML `.owabdata` drop gate look broken
for several minutes; the same bundle imported fine through `globalThis.tryBibleXMLImport`,
which is what isolated it. CLAUDE.md says "stamp `appFilePath` on the `File`" but not that
assignment is the wrong way to do it.

**How to apply:** in `evaluate_script`, build the drop as

```js
const file = new File([''], 'name.owabdata.tar.gz');
Object.defineProperty(file, 'appFilePath', {value: 'C:\\...\\name.owabdata.tar.gz'});
const ev = new Event('drop', {bubbles: true, cancelable: true});
Object.defineProperty(ev, 'dataTransfer', {value: {items: [{
    kind: 'file', webkitGetAsEntry: () => ({isFile: true}), getAsFile: () => file,
}]}});
target.dispatchEvent(ev);
```

Then **read back `file.appFilePath`** in the same call — if it is `''`, the stamp failed and
nothing downstream will run. `getFileFullName` uses `file instanceof File`, so the object must
be a real `File`; `evaluate_script` runs in the page's main world, so it is.

Related: [[drag-kind-mime-and-dim-target]], [[bible-xml-archive-owabdata]].
