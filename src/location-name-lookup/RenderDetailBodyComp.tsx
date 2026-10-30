import { Fragment, useState } from 'react';

import {
    useAppCurrentRef,
    useAppEffect,
    useAppStateAsync,
} from '../helper/appHooks';
import { WEBSITE_IFRAME_REFERRER_POLICY } from '../helper/constants';
import { tran } from '../lang/langHelpers';
import LoadingComp from '../others/LoadingComp';
import type { VerseDataType } from './bibleVerseHelpers';
import {
    shortToVerseData,
    shortToVerseSectionList,
    useLookupVerseBibleKey,
} from './bibleVerseHelpers';
import type { BibleTextSectionType } from '../bible-list/bibleRenderHelpers';
import RenderBibleChapterDividerComp from '../bible-reader/view-extra/RenderBibleChapterDividerComp';
import RenderShowNextChapterButtonComp from '../bible-reader/view-extra/RenderShowNextChapterButtonComp';
import { handleError } from '../helper/errorHelpers';
import {
    BasicInfoComp,
    DetailsSectionComp,
    DetailRowComp,
    OptionalLinkRowComp,
    OptionalLocationListRowComp,
    OptionalNameListRowComp,
    OptionalTextListRowComp,
    OptionalTextRowComp,
    OptionalVerseListRowComp,
    ReferenceTextComp,
} from './LookupDetailPartsComp';
import { useLookupLangPresentation } from './lookupLangHelpers';
import { useLookupManagersContext } from './lookupManagersContext';
import {
    GENDER_LABEL,
    LOCATION_ICON_CLASS,
    LOCATION_TYPE_LABEL,
    getNameTypeIconClass,
    getNameTypeSingularLabel,
    toRecordAgeLabel,
    toRecordEnumLabel,
} from './lookupPresentationHelpers';
import {
    checkHasDetailValue,
    getDisplayLinks,
    getFormattedYearRange,
} from './lookupRecordHelpers';

function RenderMissingRecordComp() {
    return (
        <div className="p-3 text-center text-secondary">
            {tran('Record not found')}
        </div>
    );
}

export function RenderNameDetailComp({
    recordId,
    onVersesResolved,
}: Readonly<{
    recordId: string;
    onVersesResolved: (titles: string[]) => void;
}>) {
    const { namesLookupManager } = useLookupManagersContext();
    const { fontFamily, translate } = useLookupLangPresentation();
    const verseBibleKey = useLookupVerseBibleKey();
    const record = namesLookupManager.getRecordById(recordId);
    if (record === null) {
        return <RenderMissingRecordComp />;
    }
    // The datasets keep `type`, `gender`, `age` and each year range's type in
    // English whatever language the record itself is in, so they are keys to
    // translate rather than text to show -- a Khmer record read `Male`, then
    // `175 years`, beside a translated `មនុស្ស`.
    const nameTypeKey = getNameTypeSingularLabel(record.type);
    // Decided on the ENGLISH key and only THEN translated. Both this guard and
    // `checkHasDetailValue` inside the row below drop an `unknown` type by
    // comparing the string to `'unknown'`, and neither would recognize it once
    // it reads `មិនស្គាល់` — an untyped record would grow a chip in Khmer that it
    // does not have in English.
    const isNameTypeShown =
        nameTypeKey !== '' && nameTypeKey.toLowerCase() !== 'unknown';
    const nameTypeLabel = isNameTypeShown ? translate(nameTypeKey) : '';
    const genderLabel = toRecordEnumLabel(
        record.gender,
        GENDER_LABEL,
        translate,
    );
    const ageLabel = toRecordAgeLabel(record.age, translate);
    const facts = [nameTypeLabel, genderLabel, ageLabel].filter((value) => {
        return value !== '' && value.toLowerCase() !== 'unknown';
    });
    return (
        <div className="location-name-lookup__detail" style={{ fontFamily }}>
            <BasicInfoComp
                bibleKey={verseBibleKey}
                iconClassName={getNameTypeIconClass(record.type)}
                title={record.title}
                description={record.description}
                facts={facts}
            />
            <DetailsSectionComp>
                {record.description ? (
                    <p className="location-name-lookup__basic-description">
                        <ReferenceTextComp
                            bibleKey={verseBibleKey}
                            value={record.description}
                        />
                    </p>
                ) : null}
                <dl className="location-name-lookup__grid">
                    {checkHasDetailValue(record.title) ? (
                        <DetailRowComp
                            isInline
                            label={tran('Title')}
                            value={
                                <ReferenceTextComp
                                    bibleKey={verseBibleKey}
                                    value={record.title}
                                />
                            }
                        />
                    ) : null}
                    <OptionalTextRowComp
                        label={tran('Also called')}
                        value={record.oldName}
                    />
                    <OptionalTextRowComp
                        label={tran('Type')}
                        value={nameTypeLabel}
                    />
                    <OptionalTextRowComp
                        label={tran('Gender')}
                        value={genderLabel}
                    />
                    <OptionalTextRowComp label={tran('Age')} value={ageLabel} />
                    <OptionalTextListRowComp
                        label={tran('Years')}
                        values={record.years.map((yearRange) => {
                            return getFormattedYearRange(yearRange, translate);
                        })}
                    />
                    <OptionalLocationListRowComp
                        label={tran('Locations')}
                        values={record.locations}
                    />
                    <OptionalNameListRowComp
                        label={tran('Parents')}
                        ids={record.parents}
                    />
                    <OptionalNameListRowComp
                        label={tran('Spouses')}
                        ids={record.spouses}
                    />
                    <OptionalNameListRowComp
                        label={tran('Children')}
                        ids={record.children}
                    />
                    <OptionalNameListRowComp
                        label={tran('Siblings')}
                        ids={record.siblings}
                    />
                    <OptionalNameListRowComp
                        label={tran('Cousins')}
                        ids={record.cousin}
                    />
                    <OptionalVerseListRowComp
                        bibleKey={verseBibleKey}
                        values={record.verses}
                        onResolved={onVersesResolved}
                    />
                    <OptionalLinkRowComp links={getDisplayLinks(record)} />
                </dl>
            </DetailsSectionComp>
        </div>
    );
}

function RenderLocationMapComp({
    latitude,
    longitude,
    name,
}: Readonly<{ latitude: number; longitude: number; name: string }>) {
    const query = encodeURIComponent(`${latitude},${longitude}`);
    return (
        <div className="location-name-lookup__map">
            <p className="location-name-lookup__map-note">
                {tran('Approximate location, the marker is an estimated point')}
            </p>
            <iframe
                className="location-name-lookup__map-frame"
                title={name}
                // MANDATORY, not defence in depth. Every window in this app runs
                // with `webSecurity: false`, `nodeIntegration: true` and
                // `contextIsolation: false` (`genWebPreferences`), so an
                // unsandboxed cross-origin frame can walk `window.top.require`
                // straight to `child_process`. Same sandbox the app's other
                // remote frames use (`RenderBackgroundWebIframeComp`); a map
                // embed needs no more than scripts, and no `allowFullScreen`.
                sandbox="allow-scripts"
                // Lazy: an offline machine (or one that simply never scrolls the
                // map into view) should not pay for a Google Maps round trip.
                loading="lazy"
                src={`https://maps.google.com/maps?q=${query}&z=8&output=embed`}
                // Shared with the website-background frames: sends the origin
                // only, never the full in-app route, to a third party.
                referrerPolicy={WEBSITE_IFRAME_REFERRER_POLICY}
            />
            <a
                href={`https://www.google.com/maps/search/?api=1&query=${query}`}
                rel="noreferrer"
                target="_blank"
            >
                {tran('Open in Google Maps')}
            </a>
        </div>
    );
}

export function RenderLocationDetailComp({
    recordId,
    onVersesResolved,
}: Readonly<{
    recordId: string;
    onVersesResolved: (titles: string[]) => void;
}>) {
    const { locationsLookupManager } = useLookupManagersContext();
    const { fontFamily, translate } = useLookupLangPresentation();
    const verseBibleKey = useLookupVerseBibleKey();
    const record = locationsLookupManager.getRecordById(recordId);
    if (record === null) {
        return <RenderMissingRecordComp />;
    }
    // A location's `type` is English in every package too, and a closed set
    // (`city`, `pool`, `region`... 31 words), so it is translated like a name's
    // -- a Khmer record read `Pool`. A word the list does not know yet is shown
    // as the dataset wrote it.
    const typeLabel = toRecordEnumLabel(
        record.type,
        LOCATION_TYPE_LABEL,
        translate,
    );
    const facts = [typeLabel].filter((value) => {
        return value !== '' && value.toLowerCase() !== 'unknown';
    });
    return (
        <div className="location-name-lookup__detail" style={{ fontFamily }}>
            <BasicInfoComp
                bibleKey={verseBibleKey}
                iconClassName={LOCATION_ICON_CLASS}
                title={record.title}
                description={record.description}
                facts={facts}
            />
            <DetailsSectionComp>
                {record.description ? (
                    <p className="location-name-lookup__basic-description">
                        <ReferenceTextComp
                            bibleKey={verseBibleKey}
                            value={record.description}
                        />
                    </p>
                ) : null}
                <dl className="location-name-lookup__grid">
                    {checkHasDetailValue(record.title) ? (
                        <DetailRowComp
                            isInline
                            label={tran('Title')}
                            value={
                                <ReferenceTextComp
                                    bibleKey={verseBibleKey}
                                    value={record.title}
                                />
                            }
                        />
                    ) : null}
                    <OptionalTextRowComp
                        label={tran('Also called')}
                        value={record.oldName}
                    />
                    <OptionalTextRowComp
                        label={tran('Type')}
                        value={typeLabel}
                    />
                    <OptionalTextRowComp
                        label={tran('Modern identification')}
                        value={record.modernIdentification}
                    />
                    <OptionalLocationListRowComp
                        label={tran('Related locations')}
                        values={record.relatedLocations}
                    />
                    <OptionalVerseListRowComp
                        bibleKey={verseBibleKey}
                        values={record.verses}
                        onResolved={onVersesResolved}
                    />
                    <OptionalLinkRowComp links={getDisplayLinks(record)} />
                </dl>
                {record.coordinates !== null ? (
                    <RenderLocationMapComp
                        latitude={record.coordinates.latitude}
                        longitude={record.coordinates.longitude}
                        name={record.name}
                    />
                ) : null}
            </DetailsSectionComp>
        </div>
    );
}

export function RenderVerseDetailComp({
    shortVerse,
    bibleKey,
    onResolved,
}: Readonly<{
    shortVerse: string;
    // The panel's own bible, when it was opened in one; otherwise the verse
    // follows the lookup setting.
    bibleKey?: string;
    onResolved: (verseData: VerseDataType) => void;
}>) {
    const lookupBibleKey = useLookupVerseBibleKey();
    const verseBibleKey = bibleKey ?? lookupBibleKey;
    const [verseData] = useAppStateAsync(async () => {
        try {
            return await shortToVerseData(verseBibleKey, shortVerse);
        } catch {
            return null;
        }
    }, [verseBibleKey, shortVerse]);
    const onResolvedRef = useAppCurrentRef(onResolved);
    useAppEffect(() => {
        if (verseData != null) {
            onResolvedRef.current(verseData);
        }
    }, [verseData]);
    // The chapters the `...` appended, kept for the passage they belong to:
    // another verse in this panel starts again from its first chapters.
    const passageKey = `${verseBibleKey}|${shortVerse}`;
    const [moreSections, setMoreSections] = useState<{
        key: string;
        sectionList: BibleTextSectionType[];
        isEnded: boolean;
    }>({ key: passageKey, sectionList: [], isEnded: false });
    const [isLoadingChapter, setIsLoadingChapter] = useState(false);
    if (verseData === undefined) {
        return <LoadingComp />;
    }
    if (verseData === null) {
        return <RenderMissingRecordComp />;
    }
    // No title of its own: the widget's title bar names the reference — bible
    // key included — and a panel this small cannot spare two lines repeating it.
    if (verseData.sectionList === null) {
        return (
            <div
                className="location-name-lookup__detail"
                style={verseData.style}
            >
                <p className="location-name-lookup__verse-text">
                    {verseData.text}
                </p>
            </div>
        );
    }
    const currentMore =
        moreSections.key === passageKey
            ? moreSections
            : { key: passageKey, sectionList: [], isEnded: false };
    const sectionList = [...verseData.sectionList, ...currentMore.sectionList];
    const shownChapterCount =
        verseData.shownChapterCount + currentMore.sectionList.length;
    const isMore =
        !currentMore.isEnded && shownChapterCount < verseData.chapterCount;
    const handleShowNextChapter = () => {
        setIsLoadingChapter(true);
        shortToVerseSectionList(verseBibleKey, shortVerse, shownChapterCount)
            .then((newSectionList) => {
                setMoreSections({
                    key: passageKey,
                    sectionList: [
                        ...currentMore.sectionList,
                        ...(newSectionList ?? []),
                    ],
                    isEnded: !newSectionList?.length,
                });
            })
            .catch(handleError)
            .finally(() => {
                setIsLoadingChapter(false);
            });
    };
    return (
        <div className="location-name-lookup__detail" style={verseData.style}>
            {sectionList.map((section) => {
                return (
                    <Fragment key={section.chapter}>
                        <RenderBibleChapterDividerComp
                            localeChapter={section.localeChapter}
                        />
                        <p className="location-name-lookup__verse-text">
                            {section.text}
                        </p>
                    </Fragment>
                );
            })}
            {isMore ? (
                <RenderShowNextChapterButtonComp
                    onClick={handleShowNextChapter}
                    isLoading={isLoadingChapter}
                />
            ) : null}
        </div>
    );
}
