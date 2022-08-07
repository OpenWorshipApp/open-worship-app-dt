import { useEffect, useState } from 'react';
import {
    getAllLangsAsync,
    getCurrentLocale,
    getLang, LanguageType, setCurrentLocale,
} from '../lang';
import appProvider from '../server/appProvider';

export default function SettingGeneralLanguage() {
    const [isSelecting, setIsSelecting] = useState(false);
    const [allLangs, setAllLangs] = useState<LanguageType[]>([]);
    const currentLocal = getCurrentLocale();
    const selectedLang = getLang(currentLocal);
    useEffect(() => {
        if (allLangs.length === 0) {
            getAllLangsAsync().then(setAllLangs);
        }
    }, [allLangs]);
    if (selectedLang === null) {
        return null;
    }
    return (
        <div className='card lang'>
            <div className='card-header'>Language</div>
            <div className='card-body'>
                <button className={
                    'btn btn-info flag-item'}
                    onClick={() => {
                        setIsSelecting(!isSelecting);
                    }}>
                    {selectedLang.name}
                    <div className='icon'
                        dangerouslySetInnerHTML={{
                            __html: selectedLang.flagSVG,
                        }} />
                </button>
                {isSelecting &&
                    <div className='options d-flex flex-wrap'>
                        {allLangs.map((lang, i) => {
                            const btnType = lang.locale === currentLocal ?
                                'btn-info' : 'btn-outline-info';
                            return (
                                <button key={`${i}`}
                                    onClick={() => {
                                        setCurrentLocale(lang.locale);
                                        appProvider.reload();
                                    }} className={`item btn ${btnType}`}>
                                    {lang.name} <div className='icon'
                                        dangerouslySetInnerHTML={{
                                            __html: lang.flagSVG,
                                        }} />
                                </button>
                            );
                        })}
                    </div>
                }
            </div>
        </div>
    );
}