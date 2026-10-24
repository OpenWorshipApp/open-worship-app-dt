# PDF.js experiment

Open `https://localhost:3000/experiment.html` and choose **PDF.js**.
**Interactive text** defaults to a two-page messy PDF with mixed fonts,
rotated text, multiple columns, abbreviations, verse ranges and references
split across text runs and lines. **Choose PDF** opens a local study PDF.
Only the current page is rendered; page changes and zoom reuse its document.

Hover over a reference for a native DOM `title` containing the Bible passage.
Click it for a verse panel using an installed Bible (KJV first). Click other
text to send its original PDF.js text chunk to the app. Selecting text by
dragging does not invoke the click callback. Enter/Space and Escape also work.

`PdfJsComp` requires an `onTextClick` callback. The experiment parent receives
the callback and displays its payload in the footer:

```ts
type PdfTextClickType = {
  text: string;
  reference: string | null;
  pageNumber: number;
  fileName: string;
};
```

The component also emits `window` event `owa:pdf-text-click`, whose `detail`
has the same payload, for other app listeners in the experiment window.
Reference detection currently supports English book names, common
abbreviations and ranges within a chapter. It uses actual selectable PDF
text, not OCR; image-only scanned pages need OCR first. Spatial grouping
is a heuristic: unusually interleaved reading order may still need work.

## Extract, process and attach range listeners

Expand **Extracted PDF text** to inspect the current page's raw text from
[`page.getTextContent()`](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html#getTextContent).
The same content object is passed into `TextLayer`, avoiding a second extraction.
**Text range source** shows the spatially grouped processing string. Use offsets
from **this string**, not the raw string, when annotating the rendered text.
`␀` represents a one-character `\0` separator between distant blocks; ranges
cannot cross it. Offsets use JavaScript UTF-16 indexing with an exclusive end.

```ts
import { createPdfTextMap, findBibleReferences } from './pdfTextHelpers';
import { getPdfPageText, setPdfTextRange } from './pdfTextRanges';

const { content, text } = await getPdfPageText(page);
console.log(text); // Raw extraction for inspection/other processing.
const layer = new pdfjs.TextLayer({
  textContentSource: content,
  container: textContainer,
  viewport,
});
await layer.render();
const map = createPdfTextMap(layer.textDivs);
const annotations = findBibleReferences(map.source).map((match) =>
  setPdfTextRange(map, match.start, match.end, {
    title: match.reference,
    onClick(event, range) {
      event.stopPropagation(); // Don't also call the whole-chunk handler.
      if (window.getSelection()?.isCollapsed === false) return;
      appCallback({ action: 'click', reference: match.reference, ...range });
    },
    onContextMenu(event, range) {
      event.preventDefault(); // Replace the browser's menu with your panel.
      event.stopPropagation();
      appCallback({
        action: 'contextmenu',
        reference: match.reference,
        ...range,
      });
    },
  }),
);

// The same function accepts any processed substring, not just verses:
// setPdfTextRange(map, start, end, { title, onClick, onContextMenu });
annotations[0]?.setTitle('Replace the title with fetched verse text');
// On page/zoom change or unmount:
annotations.forEach((annotation) => annotation.dispose());
```

`setPdfTextRange` uses native `addEventListener('click', ...)` and
`addEventListener('contextmenu', ...)` on just the selected character fragments,
including ranges spanning multiple PDF.js runs. Enter/Space also invokes the
click listener. Non-overlapping annotations can coexist; invalid/overlapping
ranges throw `RangeError`. `dispose()` removes listeners and restores the text,
without removing adjacent annotations. PDF text is never interpreted as HTML.
`appCallback` above is your application's callback, not a PDF.js API.

The live demo uses this API for Bible references and the first 12 characters of
the first non-reference text run. Clicking an annotated range reports its full
logical text plus `start`/`end`, rather than just the fragment under the cursor.
Right-clicking opens the verse/text panel and calls `onTextContextMenu`.
The parent displays both event types in its footer; `owa:pdf-text-contextmenu`
is also emitted on `window`. Unannotated chunks retain the whole-chunk callback.
All callbacks include `action`, `text`, `reference`, `pageNumber` and `fileName`;
range callbacks additionally include `start` and `end`.

**Mozilla viewer** retains the original hosted example for comparison with
the included PDFs. Custom local files belong in the interactive view.

`dummy.pdf` is the [W3C sample](https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf)
(one page, 13,264 bytes). Regenerate `messy-text.pdf` with:

```sh
node src/experiments/pdf-js/create-messy-pdf.mjs
```

`vendor/` contains the standalone library and worker from the
[Mozilla viewer build](https://mozilla.github.io/pdf.js/web/viewer.html),
version **6.4.313**, build **35f87e343**, with its Apache 2.0 license.
They load lazily from this experiment's own origin under the existing CSP.
The whole experiment remains excluded from production builds.
