import {
    useAppCurrentRef,
    useAppEffect,
    useAppStateAsync,
} from '../helper/appHooks';
import { WEBSITE_IFRAME_REFERRER_POLICY } from '../helper/constants';
import { tran } from '../lang/langHelpers';
import LoadingComp from '../others/LoadingComp';
import type { VerseDataType } from './bibleVerseHelpers';
import { shortToVerseData, useLookupVerseBibleKey } from './bibleVerseHelpers';
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
    LOCATION_ICON_CLASS,
    getNameTypeIconClass,
    getNameTypeSingularLabel,
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
    // The datasets keep `type` in English whatever language the record itself is
    // in, so it is a key to translate rather than text to show. `gender` and
    // `age` are left alone: age is free-form ("123 years"), not an enum.
    const nameTypeKey = getNameTypeSingularLabel(record.type);
    // Decided on the ENGLISH key and only THEN translated. Both this guard and
    // `checkHasDetailValue` inside the row below drop an `unknown` type by
    // comparing the string to `'unknown'`, and neither would recognize it once
    // it reads `មិនស្គាល់` — an untyped record would grow a chip in Khmer that it
    // does not have in English.
    const isNameTypeShown =
        nameTypeKey !== '' && nameTypeKey.toLowerCase() !== 'unknown';
    const nameTypeLabel = isNameTypeShown ? translate(nameTypeKey) : '';
    const facts = [nameTypeLabel, record.gender, record.age].filter((value) => {
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
                        value={record.gender}
                    />
                    <OptionalTextRowComp
                        label={tran('Age')}
                        value={record.age}
                    />
                    <OptionalTextListRowComp
                        label={tran('Years')}
                        values={record.years.map(getFormattedYearRange)}
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
    const { fontFamily } = useLookupLangPresentation();
    const verseBibleKey = useLookupVerseBibleKey();
    const record = locationsLookupManager.getRecordById(recordId);
    if (record === null) {
        return <RenderMissingRecordComp />;
    }
    // NOT translated the way a name's type is: a location's `type` is free-form
    // dataset prose ("city", "region", "mountain range"), not one of nine keys.
    const facts = [record.type].filter((value) => {
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
                        value={record.type}
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
    onResolved,
}: Readonly<{
    shortVerse: string;
    onResolved: (verseData: VerseDataType) => void;
}>) {
    const verseBibleKey = useLookupVerseBibleKey();
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
    if (verseData === undefined) {
        return <LoadingComp />;
    }
    if (verseData === null) {
        return <RenderMissingRecordComp />;
    }
    // No title of its own: the widget's title bar names the reference — bible
    // key included — and a panel this small cannot spare two lines repeating it.
    return (
        <div className="location-name-lookup__detail" style={verseData.style}>
            <p className="location-name-lookup__verse-text">{verseData.text}</p>
        </div>
    );
}
