import { useState } from 'react';

import { useAppEffect } from '../helper/debuggerHelpers';
import {
    getAllLangsAsync,
    getCurrentLocale,
    LanguageDataType,
    LocaleType,
    setCurrentLocale,
    tran,
} from '../lang/langHelpers';
import { applyStore } from './SettingApplyComp';

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
    const [allLangs, setAllLangs] = useState<LanguageDataType[]>([]);
    const [locale, setLocale] = useState(getCurrentLocale());
    useAppEffect(() => {
        if (allLangs.length === 0) {
            const newAllLangs = getAllLangsAsync();
            setAllLangs(newAllLangs);
        }
    }, [allLangs]);
    return (
        <div className="card lang m-1">
            <div className="card-header">{tran('Language')}</div>
            <div className="card-body">
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
            </div>
        </div>
    );
}
