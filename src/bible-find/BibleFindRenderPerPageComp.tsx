import { bringDomToTopView } from '../helper/helpers';
import RenderFoundItemComp from './RenderFoundItemComp';
import { ShowFindingComp } from './ShowFindingComp';

export const APP_FOUND_PAGE_CLASS = 'app-found-page';

export default function BibleFindRenderPerPageComp({
    page,
    items,
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
    findText: string;
    bibleKey: string;
}>) {
    if (items === undefined) {
        return <ShowFindingComp />;
    }
    return (
        <>
            <div
                className={`d-flex ${APP_FOUND_PAGE_CLASS}-${page}`}
                ref={(element) => {
                    if (element === null) {
                        return;
                    }
                    setTimeout(() => {
                        bringDomToTopView(element);
                    }, 1000);
                }}
            >
                <span className="app-found-highlight">{page}</span>
                <hr
                    className="w-100"
                    style={{
                        border: '1px dotted var(--bs-info-text-emphasis)',
                    }}
                />
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
