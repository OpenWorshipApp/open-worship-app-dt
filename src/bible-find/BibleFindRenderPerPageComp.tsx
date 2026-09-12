import { bringDomToTopView } from '../helper/helpers';
import { tran } from '../lang/langHelpers';
import RenderFoundItemComp from './RenderFoundItemComp';
import { ShowFindingComp } from './ShowFindingComp';

export const APP_FOUND_PAGE_CLASS = 'app-found-page';

export default function BibleFindRenderPerPageComp({
    page,
    items,
    fromNumber,
    toNumber,
    findText,
    bibleKey,
}: Readonly<{
    page: string;
    items:
        | {
              text: string;
              uniqueKey: string;
          }[]
        | undefined;
    fromNumber: number;
    toNumber: number;
    findText: string;
    bibleKey: string;
}>) {
    if (items === undefined) {
        return <ShowFindingComp />;
    }
    return (
        <>
            <div
                className={`app-find-chunk-divider ${APP_FOUND_PAGE_CLASS}-${page}`}
                ref={(element) => {
                    if (element === null) {
                        return;
                    }
                    setTimeout(() => {
                        bringDomToTopView(element);
                    }, 1000);
                }}
            >
                {/*
                 * The RANGE, not the chunk number. This line is what the
                 * footer's numbers jump to, and a bare `1` beside a rule reads
                 * as a stray verse number in a list made entirely of verse
                 * numbers -- while `Results 1-20`, against the
                 * `74 verses found` in the footer, says where in the find you
                 * have got to.
                 */}
                <span className="app-data">
                    {`${tran('Results')} ${fromNumber.toLocaleString()}` +
                        `\u2013${toNumber.toLocaleString()}`}
                </span>
            </div>
            <div className="w-100">
                {items.map(({ text, uniqueKey }) => {
                    return (
                        <RenderFoundItemComp
                            key={uniqueKey}
                            findText={findText}
                            text={text}
                            bibleKey={bibleKey}
                        />
                    );
                })}
            </div>
        </>
    );
}
