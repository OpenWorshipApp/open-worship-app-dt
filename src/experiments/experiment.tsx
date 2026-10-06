// Bootstrap CSS and `init` are imported OUT of `src/experiments`, which the
// build's `exclude-experiments` plugin allows -- it only refuses imports the
// other way, into this directory. `experiment.html` is not a build input at
// all, so none of this reaches a packaged app.
import '../bootstrapCss';
import { useState } from 'react';
import { init } from '../boot';
import { tran } from '../lang/langHelpers';
import AppWindowToolsComp from '../others/AppWindowToolsComp';
import { getReactRoot } from '../others/rootHelpers';
import HtmlInCanvasComp from './html-in-canvas/HtmlInCanvasComp';
import { COLOR } from './html-in-canvas/htmlInCanvasHelpers';
import PdfJsComp from './pdf-js/PdfJsComp';
import type { PdfTextClickType } from './pdf-js/pdfTextHelpers';

const root = getReactRoot();

function ExperimentComp() {
    const [selectedTab, setSelectedTab] = useState('html-in-canvas');
    const [pdfSelection, setPdfSelection] = useState<PdfTextClickType | null>(
        null,
    );
    const tabList = [
        { id: 'html-in-canvas', label: tran('HTML-in-Canvas') },
        { id: 'pdf-js', label: tran('PDF.js') },
    ];

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
                background: COLOR.bg,
                color: COLOR.text,
            }}
        >
            <div
                role="tablist"
                style={{
                    display: 'flex',
                    flexShrink: 0,
                    borderBottom: `1px solid ${COLOR.border}`,
                }}
            >
                {tabList.map((tab, index) => {
                    const isSelected = selectedTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            id={`experiment-tab-${tab.id}`}
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            aria-controls={`experiment-panel-${tab.id}`}
                            tabIndex={isSelected ? 0 : -1}
                            onClick={() => {
                                setSelectedTab(tab.id);
                            }}
                            onKeyDown={(event) => {
                                let nextIndex;
                                if (event.key === 'ArrowRight') {
                                    nextIndex = (index + 1) % tabList.length;
                                } else if (event.key === 'ArrowLeft') {
                                    nextIndex =
                                        (index + tabList.length - 1) %
                                        tabList.length;
                                } else if (event.key === 'Home') {
                                    nextIndex = 0;
                                } else if (event.key === 'End') {
                                    nextIndex = tabList.length - 1;
                                } else {
                                    return;
                                }
                                event.preventDefault();
                                const nextTab = tabList[nextIndex];
                                setSelectedTab(nextTab.id);
                                document
                                    .getElementById(
                                        `experiment-tab-${nextTab.id}`,
                                    )
                                    ?.focus();
                            }}
                            style={{
                                padding: '10px 16px',
                                border: 0,
                                borderBottom: `2px solid ${
                                    isSelected ? COLOR.accent : 'transparent'
                                }`,
                                background: isSelected
                                    ? COLOR.panel
                                    : 'transparent',
                                color: isSelected ? COLOR.text : COLOR.muted,
                                cursor: 'pointer',
                            }}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>
            <div
                id={`experiment-panel-${selectedTab}`}
                role="tabpanel"
                aria-labelledby={`experiment-tab-${selectedTab}`}
                style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
                {selectedTab === 'pdf-js' ? (
                    <PdfJsComp
                        onTextClick={setPdfSelection}
                        onTextContextMenu={setPdfSelection}
                    />
                ) : (
                    <HtmlInCanvasComp />
                )}
            </div>
            <AppWindowToolsComp />
            {selectedTab === 'pdf-js' && pdfSelection ? (
                <output className="pdf-js-callback" aria-live="polite">
                    {tran('Selected text')}: {pdfSelection.text}
                    {' · '}
                    {pdfSelection.fileName} · {pdfSelection.pageNumber}
                    {' · '}
                    <code>{pdfSelection.action ?? 'click'}</code>
                    {pdfSelection.start !== undefined
                        ? ` · [${pdfSelection.start}, ${pdfSelection.end})`
                        : ''}
                    {pdfSelection.reference
                        ? ` · ${pdfSelection.reference}`
                        : ''}
                </output>
            ) : null}
        </div>
    );
}

// Rendered from the callback rather than straight away: the window tools name
// their menu entry with `tran`, which needs the locale `init` loads.
init(() => {
    root.render(<ExperimentComp />);
});
