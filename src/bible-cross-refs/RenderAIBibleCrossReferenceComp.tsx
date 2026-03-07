import type { CrossReferenceType } from '../helper/ai/bibleCrossRefHelpers';
import { useBibleKeyContext } from '../helper/ai/bibleCrossRefHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleLogicHelpers2';
import { tran } from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import BibleCrossRefAIRenderFoundItemComp from './BibleCrossRefAIRenderFoundItemComp';

function genGoogleTranslated() {
    return (
        <i
            className="bi bi-lightbulb app-caught-hover-pointer"
            title={
                tran('Generated using Google Translate.') +
                ' Results may vary and may not be ' +
                'accurate. Please use with caution.'
            }
            style={{
                color: 'var(--bs-info-text-emphasis)',
            }}
            onClick={(event) => {
                event.stopPropagation();
                appProvider.browserUtils.openExternalURL(
                    `${appProvider.appInfo.homepage}/google-translate-vigilant`,
                );
            }}
        />
    );
}

export default function RenderAIBibleCrossReferenceComp({
    crossReference,
}: Readonly<{
    crossReference: CrossReferenceType;
}>) {
    const bibleKey = useBibleKeyContext();
    const fontFamily = useBibleFontFamily(bibleKey);
    const { title, titleEn, verses } = crossReference;
    return (
        <div>
            <strong
                className="app-selectable-text app-found-highlight"
                style={{ fontFamily }}
                title={titleEn}
            >
                {genGoogleTranslated()}
                <span dangerouslySetInnerHTML={{ __html: title }} />
            </strong>
            {verses.map((item, i) => {
                return (
                    <BibleCrossRefAIRenderFoundItemComp
                        key={item + i}
                        bibleVersesKey={item}
                    />
                );
            })}
            <hr />
        </div>
    );
}
