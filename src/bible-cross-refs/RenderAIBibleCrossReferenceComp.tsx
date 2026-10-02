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
    // Both sentences translated: the caution was English in every language.
    const label =
        tran('Generated using Google Translate.') +
        ' ' +
        tran(
            'Results may vary and may not be accurate. Please use with caution.',
        );
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
            {/*
              The note sits BESIDE the heading, not in it. A heading is named
              by everything inside it, so every translated theme was announced
              with the whole caution after its title -- and a heading holding a
              control drops out of the tools that list headings (the robot
              test found a heading in English and plain text in Khmer).
            */}
            <div className="app-xref-theme-head">
                <h4
                    className="app-xref-theme-title app-selectable-text"
                    style={{ fontFamily }}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(title) }}
                />
                {isTranslated ? genGoogleTranslated(titleEn) : null}
            </div>
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
