import { useState } from 'react';

import type { FindDataType, FindPageRangeType } from './bibleFindHelpers';
import {
    toFindChunkRange,
    toFindPageWindow,
    toFoundVerseCount,
} from './bibleFindHelpers';
import BibleFindRenderPerPageComp from './BibleFindRenderPerPageComp';
import { useBibleFindController } from './BibleFindController';
import { ShowFindingComp } from './ShowFindingComp';
import RenderPageNumberComp from './RenderPageNumberComp';
import { tran } from '../lang/langHelpers';

/**
 * How far through the result set you are, and how to move.
 *
 * The strip used to draw EVERY chunk number -- 1556 buttons in a 10000px-tall
 * grid for a common word, laid out and painted on every result render to fill a
 * 100px sliver. It now draws a window (see `toFindPageWindow`), which is around
 * a dozen buttons whatever the find returns, and leads with the figure that
 * actually helps: how many verses matched.
 */
function RenderFooterComp({
    data,
    findFor,
}: Readonly<{
    data: FindDataType;
    findFor: (page: string) => void;
}>) {
    // The gaps the user has opened. Held here rather than in the window helper
    // so it stays a pure function, and dropped on a new find by the `key` this
    // component is given below.
    const [expandedRanges, setExpandedRanges] = useState<FindPageRangeType[]>(
        [],
    );
    const { pages, currentPage } = data.pagingData;
    const loadedPages = pages.filter((pageNumber) => {
        return !!data.foundData[pageNumber];
    });
    const windowedPages = toFindPageWindow(
        pages.length,
        Number.parseInt(currentPage),
        loadedPages.map((pageNumber) => {
            return Number.parseInt(pageNumber);
        }),
        expandedRanges,
    );
    const verseCount = toFoundVerseCount(data);
    return (
        <div className="app-find-footer">
            <span className="app-find-count app-ellipsis app-data">
                {verseCount === null
                    ? null
                    : `${verseCount.toLocaleString()} ${tran('verses found')}`}
            </span>
            <nav className="app-find-pages" aria-label={tran('Find')}>
                {windowedPages.map((item) => {
                    if (item.type === 'gap') {
                        const { fromPage, toPage } = item;
                        return (
                            <button
                                key={`gap-${fromPage}`}
                                className="app-find-page-gap"
                                type="button"
                                // A number nobody can reach is worse than a
                                // number nobody wants to see: the gap says
                                // which chunks it is holding and opens them.
                                title={`${tran('Show pages')} ${fromPage.toLocaleString()}\u2013${toPage.toLocaleString()}`}
                                onClick={() => {
                                    setExpandedRanges((oldRanges) => {
                                        return [
                                            ...oldRanges,
                                            [fromPage, toPage],
                                        ];
                                    });
                                }}
                            >
                                {'\u2026'}
                            </button>
                        );
                    }
                    const page = `${item.page}`;
                    return (
                        <RenderPageNumberComp
                            key={page}
                            pageNumber={page}
                            isLoaded={!!data.foundData[page]}
                            handleFinding={findFor}
                        />
                    );
                })}
            </nav>
        </div>
    );
}

function RenderFoundComp({
    findText,
    data,
}: Readonly<{
    findText: string;
    data: FindDataType;
}>) {
    const bibleFindController = useBibleFindController();
    const { pagingData, foundData: found } = data;
    const { bibleKey } = bibleFindController;
    const verseCount = toFoundVerseCount(data);
    return pagingData.pages.map((pageNumber) => {
        const data = found[pageNumber];
        if (data === null) {
            return null;
        }
        if (data === undefined) {
            return <ShowFindingComp key={pageNumber} />;
        }
        const [fromNumber, toNumber] = toFindChunkRange(
            Number.parseInt(pageNumber),
            pagingData.perPage,
            verseCount,
        );
        return (
            <BibleFindRenderPerPageComp
                key={pageNumber}
                findText={findText}
                items={data.content}
                fromNumber={fromNumber}
                toNumber={toNumber}
                page={pageNumber}
                bibleKey={bibleKey}
            />
        );
    });
}

export default function BibleFindRenderDataComp({
    findText,
    data,
    findFor,
}: Readonly<{
    findText: string;
    data: FindDataType | null | undefined;
    findFor: (page: string) => void;
}>) {
    if (data === undefined) {
        return <ShowFindingComp />;
    }
    if (data === null) {
        return (
            <div
                className="w-100 my-2"
                style={{ margin: 'auto', textAlign: 'center' }}
            >
                {tran('No data available')}
            </div>
        );
    }
    return (
        <div
            className="card-body w-100 overflow-hidden d-flex flex-column"
            style={{ height: 'calc(100% - 35px)' }}
        >
            <div
                className="w-100 h-100 d-flex flex-column overflow-hidden"
                style={{
                    position: 'relative',
                }}
            >
                <div
                    className="w-100 app-find-results"
                    style={{ overflowY: 'auto', height: 'calc(100% - 42px)' }}
                >
                    <RenderFoundComp findText={findText} data={data} />
                </div>
                <div
                    className="p-0"
                    style={{
                        minHeight: 42,
                        maxHeight: 100,
                        overflowY: 'auto',
                        borderTop: '1px solid var(--app-line)',
                    }}
                >
                    <RenderFooterComp
                        // A new find is a new set of chunks, so the gaps
                        // opened against the old one go with it.
                        key={`${findText}-${data.pagingData.pages.length}`}
                        data={data}
                        findFor={findFor}
                    />
                </div>
            </div>
        </div>
    );
}
