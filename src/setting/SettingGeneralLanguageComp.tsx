import { ReactNode, useState } from 'react';

import { useAppStateAsync } from '../helper/debuggerHelpers';
import {
    getAllLangsAsync,
    getCurrentLocale,
    LanguageDataType,
    LocaleType,
    setCurrentLocale,
    tran,
} from '../lang/langHelpers';
import { applyStore } from './SettingApplyComp';
import LoadingComp from '../others/LoadingComp';

function RenderLanguageButtonComp({
    currentLocale,
    langData,
    setLocale,
}: Readonly<{
    currentLocale: string;
    langData: LanguageDataType;
    setLocale: (newLocale: LocaleType) => void;
}>) {
    const btnType =
        langData.locale === currentLocale ? 'btn-info' : 'btn-outline-info';
    return (
        <button
            key={langData.locale}
            onClick={() => {
                setCurrentLocale(langData.locale);
                setLocale(langData.locale);
                applyStore.pendingApply();
            }}
            className={`item btn ${btnType}`}
        >
            {langData.name}
            <div
                className="icon"
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
    let element: ReactNode = null;
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
            <div className="card-header">{tran('Language')}</div>
            <div className="card-body">{element}</div>
        </div>
    );
}
