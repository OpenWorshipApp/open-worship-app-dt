import type { ReactNode } from 'react';
import { useState } from 'react';

import { useAppStateAsync } from '../helper/appHooks';
import type { LanguageDataType, LocaleType } from '../lang/langHelpers';
import {
    getAllLangsAsync,
    getCurrentLocale,
    getLangDataAsync,
    setCurrentLocale,
    tran,
} from '../lang/langHelpers';
import { applyStore } from './SettingApplyComp';
import LoadingComp from '../others/LoadingComp';
import SettingCardHeaderComp from './SettingCardHeaderComp';

function RenderLanguageButtonComp({
    currentLocale,
    langData,
    setLocale,
}: Readonly<{
    currentLocale: string;
    langData: LanguageDataType;
    setLocale: (newLocale: LocaleType) => void;
}>) {
    const { locale } = langData;
    const btnType = locale === currentLocale ? 'btn-info' : 'btn-outline-info';
    return (
        <button
            key={locale}
            onClick={async () => {
                setCurrentLocale(locale);
                await getLangDataAsync(locale);
                setLocale(locale);
                applyStore.pendingApply();
            }}
            className={`item btn ${btnType}`}
            title={langData.name}
        >
            {tran(langData.name)}
            <div
                className="icon pe-1"
                dangerouslySetInnerHTML={{
                    __html: langData.flagSVG,
                }}
            />
        </button>
    );
}

export default function SettingGeneralLanguageComp() {
    const [allLangs] = useAppStateAsync(() => {
        return getAllLangsAsync();
    });
    const [locale, setLocale] = useState(getCurrentLocale());
    let element: ReactNode;
    if (allLangs === undefined) {
        element = <LoadingComp />;
    } else if (allLangs === null || allLangs.length === 0) {
        element = <div>{tran('No languages available.')}</div>;
    } else {
        element = (
            <div className="options d-flex flex-wrap">
                {allLangs.map((langData) => {
                    return (
                        <RenderLanguageButtonComp
                            key={langData.locale}
                            currentLocale={locale}
                            langData={langData}
                            setLocale={setLocale}
                        />
                    );
                })}
            </div>
        );
    }

    return (
        <div className="card lang m-1">
            <SettingCardHeaderComp
                iconClassName="bi-translate"
                title="Language"
            />
            <div className="card-body">{element}</div>
        </div>
    );
}
