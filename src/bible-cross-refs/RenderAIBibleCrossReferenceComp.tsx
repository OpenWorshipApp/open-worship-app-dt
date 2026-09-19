import type { CrossReferenceType } from '../helper/ai/bibleCrossRefHelpers';
import { useBibleKeyContext } from '../helper/ai/bibleCrossRefHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';
import { sanitizeHtml } from '../helper/sanitizeHelpers';
import { tran } from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import BibleCrossRefAIRenderFoundItemComp from './BibleCrossRefAIRenderFoundItemComp';

// Only rendered when the heading actually WAS translated. It used to sit on
// every theme, in every locale -- including on an English bible, where nothing
// had been translated at all and the mark was simply untrue.
function genGoogleTranslated(titleEn: string) {
    const label =
        tran('Generated using Google Translate.') +
        ' Results may vary and may not be ' +
        'accurate. Please use with caution.';
    return (
        <button
            type="button"
            className="app-xref-note bi bi-translate"
            title={`${label}\n${titleEn}`}
            aria-label={label}
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
    const isTranslated = !!titleEn && titleEn !== title;
    return (
        <div className="app-xref-theme">
            <h4
                className="app-xref-theme-title app-selectable-text"
                style={{ fontFamily }}
            >
                <span
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(title) }}
                />
                {isTranslated ? genGoogleTranslated(titleEn) : null}
            </h4>
            <div className="app-xref-verses">
                {verses.map((item, i) => {
                    return (
                        <BibleCrossRefAIRenderFoundItemComp
                            key={item + i}
                            bibleVersesKey={item}
                        />
                    );
                })}
            </div>
        </div>
    );
}
