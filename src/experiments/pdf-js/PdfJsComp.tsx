import { useEffect, useRef, useState } from 'react';
import { tran } from '../../lang/langHelpers';
import {
    decoratePdfText,
    readAppBibleVerse,
    type PdfTextClickType,
} from './pdfTextHelpers';
import {
    getPdfPageText,
    setPdfTextRange,
    type PdfTextContentType,
    type PdfTextRangeType,
} from './pdfTextRanges';
import dummyPdfUrl from './dummy.pdf?url';
import messyPdfUrl from './messy-text.pdf?url';
import './pdfJs.css';
import libraryUrl from './vendor/pdf.mjs?url';
import workerUrl from './vendor/pdf.worker.mjs?url';

type TaskType = { promise: Promise<unknown>; cancel: () => void };
type TextLayerType = {
    textDivs: HTMLElement[];
    render: () => Promise<void>;
    cancel: () => void;
};
type PdfPageType = {
    cleanup: () => void;
    getViewport: (options: { scale: number }) => {
        width: number;
        height: number;
    };
    render: (options: Record<string, unknown>) => TaskType;
    getTextContent: () => Promise<PdfTextContentType>;
};
type PdfDocumentType = {
    numPages: number;
    getPage: (number: number) => Promise<PdfPageType>;
};
type LoadingTaskType = {
    promise: Promise<PdfDocumentType>;
    destroy: () => Promise<void>;
};
type PdfLibraryType = {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (options: {
        url: string;
        disableAutoFetch: boolean;
        disableStream: boolean;
    }) => LoadingTaskType;
    TextLayer: new (options: Record<string, unknown>) => TextLayerType;
};
type VerseType = Awaited<ReturnType<typeof readAppBibleVerse>>;

export default function PdfJsComp({
    onTextClick,
    onTextContextMenu,
}: {
    onTextClick: (detail: PdfTextClickType) => void;
    onTextContextMenu?: (detail: PdfTextClickType) => void;
}) {
    const [view, setView] = useState('interactive');
    const [file, setFile] = useState('messy');
    const [customFile, setCustomFile] = useState<{
        url: string;
        name: string;
    } | null>(null);
    const [scale, setScale] = useState(1);
    const [pageNumber, setPageNumber] = useState(1);
    const [pdfDocument, setPdfDocument] = useState<PdfDocumentType | null>(
        null,
    );
    const [library, setLibrary] = useState<PdfLibraryType | null>(null);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [selection, setSelection] = useState<PdfTextClickType | null>(null);
    const [verse, setVerse] = useState<VerseType>(null);
    const [verseLoading, setVerseLoading] = useState(false);
    const [extractedText, setExtractedText] = useState({ raw: '', source: '' });
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pageRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const generationRef = useRef({ value: 0 });
    const verseRequestsRef = useRef(
        new Map<string, { promise: Promise<VerseType>; expiresAt: number }>(),
    );
    const fileUrl =
        file === 'custom' && customFile
            ? customFile.url
            : file === 'dummy'
              ? dummyPdfUrl
              : messyPdfUrl;
    const fileName =
        file === 'custom' && customFile
            ? customFile.name
            : file === 'dummy'
              ? 'dummy.pdf'
              : 'messy-text.pdf';
    const viewerUrl = new URL(
        'https://mozilla.github.io/pdf.js/web/viewer.html',
    );
    viewerUrl.searchParams.set('file', new URL(fileUrl, location.href).href);

    useEffect(() => {
        return () => {
            if (customFile) URL.revokeObjectURL(customFile.url);
        };
    }, [customFile]);

    // Keep one document open; zoom/page changes render only the current page.
    useEffect(() => {
        setPdfDocument(null);
        if (view !== 'interactive') return;
        let cancelled = false;
        let task: LoadingTaskType | undefined;
        setStatus('loading');
        setError('');
        async function load() {
            try {
                const pdfjs: PdfLibraryType = await import(
                    /* @vite-ignore */ libraryUrl
                );
                if (cancelled) return;
                pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
                setLibrary(pdfjs);
                task = pdfjs.getDocument({
                    url: new URL(fileUrl, location.href).href,
                    disableAutoFetch: true,
                    disableStream: true,
                });
                const pdf = await task.promise;
                if (!cancelled) setPdfDocument(pdf);
            } catch (reason) {
                if (!cancelled) {
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : String(reason),
                    );
                    setStatus('error');
                }
            }
        }
        void load();
        return () => {
            cancelled = true;
            void task?.destroy().catch(() => {});
        };
    }, [view, fileUrl]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const pageElement = pageRef.current;
        const textElement = textRef.current;
        if (
            !canvas ||
            !pageElement ||
            !textElement ||
            !pdfDocument ||
            !library ||
            view !== 'interactive'
        )
            return;
        const pdf = pdfDocument;
        const pdfjs = library;
        let cancelled = false;
        let renderTask: TaskType | undefined;
        let textLayer: TextLayerType | undefined;
        let renderedPage: PdfPageType | undefined;
        const disposeRanges: (() => void)[] = [];
        const generation = generationRef.current;
        const requests = verseRequestsRef.current;
        generation.value++;
        requests.clear();
        textElement.replaceChildren();
        setStatus('loading');
        setError('');
        setExtractedText({ raw: '', source: '' });
        function reportRange(
            event: MouseEvent,
            range: PdfTextRangeType,
            reference: string | null = null,
        ) {
            event.stopPropagation(); // Avoid a second, whole-chunk callback.
            const action =
                event.type === 'contextmenu' ? 'contextmenu' : 'click';
            if (action === 'contextmenu') event.preventDefault();
            else if (window.getSelection()?.isCollapsed === false) return;
            const detail: PdfTextClickType = {
                ...range,
                reference,
                pageNumber,
                fileName,
                action,
            };
            if (action === 'click') onTextClick(detail);
            else onTextContextMenu?.(detail);
            window.dispatchEvent(
                new CustomEvent(`owa:pdf-text-${action}`, { detail }),
            );
            if (reference || action === 'contextmenu') setSelection(detail);
        }
        async function renderPdf() {
            try {
                const page = await pdf.getPage(pageNumber);
                renderedPage = page;
                if (cancelled) return;
                const viewport = page.getViewport({ scale });
                const pixelRatio = Math.min(devicePixelRatio || 1, 2);
                canvas!.width = Math.ceil(viewport.width * pixelRatio);
                canvas!.height = Math.ceil(viewport.height * pixelRatio);
                canvas!.style.width = `${viewport.width}px`;
                canvas!.style.height = `${viewport.height}px`;
                pageElement!.style.width = `${viewport.width}px`;
                pageElement!.style.height = `${viewport.height}px`;
                textElement!.style.setProperty(
                    '--total-scale-factor',
                    String(scale),
                );
                // Actual extraction example: the raw text is available for
                // processing, and this same content builds the selectable layer.
                const extracted = await getPdfPageText(page);
                if (cancelled) return;
                renderTask = page.render({
                    canvas,
                    canvasContext: canvas!.getContext('2d'),
                    viewport,
                    transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
                });
                textLayer = new pdfjs.TextLayer({
                    textContentSource: extracted.content,
                    container: textElement,
                    viewport,
                });
                await Promise.all([renderTask.promise, textLayer.render()]);
                if (!cancelled) {
                    // Process the spatially grouped source, whose offsets map
                    // back to the DOM even for fragmented references.
                    const map = decoratePdfText(textLayer.textDivs, {
                        onClick: reportRange,
                        onContextMenu: reportRange,
                    });
                    disposeRanges.push(map.dispose);
                    // An arbitrary partial text range, not a Bible reference:
                    // first 12 characters of the first non-reference run.
                    const run = map.runs.find(
                        (item) =>
                            !map.matches.some(
                                (match) =>
                                    match.start <
                                        item.start + item.text.length &&
                                    match.end > item.start,
                            ),
                    );
                    if (run) {
                        run.element.setAttribute('role', 'group');
                        const start = run.start;
                        const end = start + Math.min(12, run.text.length);
                        const annotation = setPdfTextRange(map, start, end, {
                            title: map.source.slice(start, end),
                            onClick: reportRange,
                            onContextMenu: reportRange,
                        });
                        disposeRanges.push(annotation.dispose);
                    }
                    setExtractedText({
                        raw: extracted.text,
                        source: map.source,
                    });
                    setStatus('ready');
                }
            } catch (reason) {
                if (!cancelled) {
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : String(reason),
                    );
                    setStatus('error');
                }
            }
        }
        void renderPdf();
        return () => {
            cancelled = true;
            generation.value++;
            requests.clear();
            renderTask?.cancel();
            textLayer?.cancel();
            disposeRanges.forEach((dispose) => dispose());
            renderedPage?.cleanup();
            textElement.replaceChildren();
            canvas.width = canvas.height = 0;
        };
    }, [
        view,
        pdfDocument,
        library,
        pageNumber,
        scale,
        fileName,
        onTextClick,
        onTextContextMenu,
    ]);

    useEffect(() => {
        if (!selection) return;
        let cancelled = false;
        setVerse(null);
        setVerseLoading(!!selection.reference);
        dialogRef.current?.showModal();
        if (!selection.reference) return;
        void readAppBibleVerse(selection.reference)
            .then((result) => {
                if (!cancelled) setVerse(result);
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setVerseLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selection]);

    const hoverText = (target: EventTarget | null) => {
        if (!(target instanceof Element)) return;
        const element = target.closest<HTMLElement>('[data-bible-reference]');
        const reference = element?.dataset.bibleReference;
        if (!element || !reference) return;
        const generation = generationRef.current.value;
        let entry = verseRequestsRef.current.get(reference);
        if (!entry || entry.expiresAt < Date.now()) {
            if (verseRequestsRef.current.size >= 32)
                verseRequestsRef.current.clear();
            entry = {
                promise: readAppBibleVerse(reference).catch(() => null),
                expiresAt: Date.now() + 30_000,
            };
            verseRequestsRef.current.set(reference, entry);
        }
        void entry.promise.then((result) => {
            if (
                result &&
                generation === generationRef.current.value &&
                element.isConnected
            ) {
                element.title = `${result.reference} (${result.version})\n${result.text}`;
            }
        });
    };

    const clickText = (
        target: EventTarget | null,
        action: 'click' | 'contextmenu' = 'click',
    ) => {
        if (!(target instanceof Element)) return;
        const chunk = target.closest<HTMLElement>('[data-pdf-text]');
        if (!chunk?.dataset.pdfText) return;
        const reference =
            target.closest<HTMLElement>('[data-bible-reference]')?.dataset
                .bibleReference ?? null;
        const detail = {
            text: chunk.dataset.pdfText,
            reference,
            pageNumber,
            fileName,
            action,
        };
        if (action === 'click') onTextClick(detail);
        else onTextContextMenu?.(detail);
        window.dispatchEvent(
            new CustomEvent(`owa:pdf-text-${action}`, { detail }),
        );
        if (reference || action === 'contextmenu') setSelection(detail);
    };

    return (
        <div className="pdf-js-experiment">
            <div className="pdf-js-toolbar">
                <button
                    type="button"
                    aria-pressed={view === 'interactive'}
                    onClick={() => setView('interactive')}
                >
                    {tran('Interactive text')}
                </button>
                <button
                    type="button"
                    aria-pressed={view === 'viewer'}
                    onClick={() => setView('viewer')}
                >
                    {tran('Mozilla viewer')}
                </button>
                <label className="pdf-js-file-picker">
                    {tran('Choose PDF')}
                    <input
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(event) => {
                            const chosenFile = event.target.files?.[0];
                            if (!chosenFile) return;
                            setCustomFile({
                                url: URL.createObjectURL(chosenFile),
                                name: chosenFile.name,
                            });
                            setFile('custom');
                            setPageNumber(1);
                            setView('interactive');
                            event.target.value = '';
                        }}
                    />
                </label>
                <select
                    aria-label={tran('PDF Document')}
                    value={file}
                    onChange={(event) => {
                        setFile(event.target.value);
                        setPageNumber(1);
                    }}
                >
                    <option value="messy">{tran('Messy text')}</option>
                    <option value="dummy">dummy.pdf</option>
                    {customFile ? (
                        <option value="custom">{customFile.name}</option>
                    ) : null}
                </select>
                {view === 'interactive' ? (
                    <>
                        <button
                            type="button"
                            aria-label={tran('Previous')}
                            disabled={pageNumber <= 1 || status !== 'ready'}
                            onClick={() => setPageNumber(pageNumber - 1)}
                        >
                            ←
                        </button>
                        <span>
                            {pageNumber} / {pdfDocument?.numPages ?? '…'}
                        </span>
                        <button
                            type="button"
                            aria-label={tran('Next')}
                            disabled={
                                !pdfDocument ||
                                pageNumber >= pdfDocument.numPages ||
                                status !== 'ready'
                            }
                            onClick={() => setPageNumber(pageNumber + 1)}
                        >
                            →
                        </button>
                        <select
                            aria-label={tran('Zoom')}
                            value={scale}
                            onChange={(event) =>
                                setScale(Number(event.target.value))
                            }
                        >
                            {[0.75, 1, 1.25, 1.5].map((value) => (
                                <option key={value} value={value}>
                                    {value * 100}%
                                </option>
                            ))}
                        </select>
                    </>
                ) : null}
                <span>
                    {tran(
                        'Hover for a title; click or right-click a text range to call the app.',
                    )}
                </span>
            </div>
            {view === 'interactive' && extractedText.source ? (
                <details className="pdf-js-extracted">
                    <summary>{tran('Extracted PDF text')}</summary>
                    <code>page.getTextContent()</code>
                    <pre>{extractedText.raw}</pre>
                    <details>
                        <summary>{tran('Text range source')}</summary>
                        <code>map.source · [start, end) · UTF-16 · ␀ = \0</code>
                        <pre>{extractedText.source.replaceAll('\0', '␀')}</pre>
                    </details>
                </details>
            ) : null}
            {view === 'viewer' ? (
                <iframe
                    title={tran('PDF.js')}
                    src={viewerUrl.href}
                    sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"
                />
            ) : (
                <div className="pdf-js-scroll">
                    {status === 'loading' ? (
                        <div role="status">{tran('Loading')}</div>
                    ) : null}
                    {error ? (
                        <div role="alert">
                            {tran('Error')}: {error}
                        </div>
                    ) : null}
                    <div className="pdf-js-page" ref={pageRef}>
                        <canvas ref={canvasRef} />
                        <div
                            ref={textRef}
                            className="pdf-js-text-layer"
                            onMouseOver={(event) => hoverText(event.target)}
                            onFocus={(event) => hoverText(event.target)}
                            onClick={(event) => {
                                if (
                                    window.getSelection()?.isCollapsed !== false
                                )
                                    clickText(event.target);
                            }}
                            onContextMenu={(event) => {
                                event.preventDefault();
                                clickText(event.target, 'contextmenu');
                            }}
                            onKeyDown={(event) => {
                                if (
                                    event.key === 'Enter' ||
                                    event.key === ' '
                                ) {
                                    event.preventDefault();
                                    clickText(event.target);
                                }
                            }}
                        />
                    </div>
                </div>
            )}
            <dialog
                ref={dialogRef}
                className="pdf-js-popup"
                aria-labelledby="pdf-js-verse-title"
                onClose={() => setSelection(null)}
            >
                <form method="dialog">
                    <button aria-label={tran('Close')} autoFocus>
                        ×
                    </button>
                </form>
                <h3 id="pdf-js-verse-title">
                    {verse?.reference ??
                        selection?.reference ??
                        tran('Selected text')}
                </h3>
                {selection?.action === 'contextmenu' ? (
                    <code>contextmenu</code>
                ) : null}
                {verseLoading ? (
                    <p role="status">{tran('Loading')}</p>
                ) : verse ? (
                    <>
                        <div className="pdf-js-version">{verse.version}</div>
                        <p>{verse.text}</p>
                    </>
                ) : selection?.reference ? (
                    <p>{tran('No matching Bible verse found')}</p>
                ) : (
                    <p>{selection?.text}</p>
                )}
            </dialog>
        </div>
    );
}
