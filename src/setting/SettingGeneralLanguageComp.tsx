import { useState } from 'react';

import { useAppEffect } from '../helper/debuggerHelpers';
import {
    getAllLangsAsync,
    getCurrentLocale,
    getLang,
    LanguageDataType,
    setCurrentLocale,
} from '../lang/langHelpers';
import appProvider from '../server/appProvider';

function RenderLanguageButtonComp({
    currentLocale,
    langData,
}: Readonly<{
    currentLocale: string;
    langData: LanguageDataType;
}>) {
    const btnType =
        langData.locale === currentLocale ? 'btn-info' : 'btn-outline-info';
    return (
        <button
            key={langData.locale}
            onClick={() => {
                setCurrentLocale(langData.locale);
                appProvider.reload();
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
    const [allLangs, setAllLangs] = useState<LanguageDataType[]>([]);
    const currentLocale = getCurrentLocale();
    const selectedLang = getLang(currentLocale);
    useAppEffect(() => {
        if (allLangs.length === 0) {
            getAllLangsAsync().then(setAllLangs);
        }
    }, [allLangs]);
    if (selectedLang === null) {
        return null;
    }
    return (
        <div className="card lang">
            <div className="card-header">`Language</div>
            <div className="card-body">
                <div className="options d-flex flex-wrap">
                    {allLangs.map((langData) => {
                        return (
                            <RenderLanguageButtonComp
                                key={langData.locale}
                                currentLocale={currentLocale}
                                langData={langData}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
