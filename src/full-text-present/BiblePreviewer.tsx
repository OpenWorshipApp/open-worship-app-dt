import { useEffect, useState } from 'react';
import { useBiblePresenting } from '../event/FullTextPresentEventListener';
import fullTextPresentHelper, {
    BiblePresentType,
} from './fullTextPresentHelper';
import BibleView from './BibleView';
import { previewer } from './Previewer';
import { FULL_TEXT_AUTO_SAVE_SETTING } from './Utils';
import {
    getBiblePresentingSetting,
    getSetting,
    setBiblePresentingSetting,
} from '../helper/settingHelper';
import { showAppContextMenu } from '../others/AppContextMenu';
import bibleHelper from '../bible-helper/bibleHelper';
import { useChangingBible } from '../event/PresentEventListener';

const convertPresent = (present: BiblePresentType,
    oldPresents: BiblePresentType[]) => {
    if (oldPresents.length < 2) {
        return [present];
    }
    return oldPresents.map((oldPresent) => {
        oldPresent.target = present.target;
        return oldPresent;
    });
};

let isMounted = false;
export default function BiblePreviewer() {
    const [biblePresents, setBiblePresents] = useState<BiblePresentType[]>(getBiblePresentingSetting());
    const applyPresents = (newBiblePresents: BiblePresentType[]) => {
        setBiblePresents(newBiblePresents);
        setBiblePresentingSetting(newBiblePresents);
    };

    useEffect(() => {
        isMounted = true;
        previewer.show = () => {
            if (!isMounted) {
                return;
            }
            fullTextPresentHelper.renderBibleFromBiblePresentList(biblePresents);
        };
        if (getSetting(FULL_TEXT_AUTO_SAVE_SETTING) === 'true') {
            previewer.show();
        }
        return () => {
            isMounted = false;
        };
    });
    useBiblePresenting((present) => {
        applyPresents(convertPresent(present, biblePresents));
    });
    useChangingBible((isNext) => {
        const bibleList = bibleHelper.getBibleListWithStatus()
            .filter(([_, isAvailable]) => isAvailable)
            .map(([bible]) => bible);
        if (biblePresents.length === 1 && bibleList.length > 1) {
            const currentBible = biblePresents[0].bible;
            let currentIndex = bibleList.indexOf(currentBible);
            if (~currentIndex) {
                currentIndex = (bibleList.length + currentIndex + (isNext ? 1 : -1))
                    % bibleList.length;
                const newPresents = [...biblePresents];
                newPresents[0].bible = bibleList[currentIndex];
                applyPresents(newPresents);
            }
        }
    });

    if (biblePresents === null) {
        return (
            <div className="alert alert-warning">No Bible Selected</div>
        );
    }
    return (
        <div className='d-flex d-flex-row overflow-hidden h-100'>
            {biblePresents.length ? biblePresents.map((biblePresent, i) => {
                return (
                    <BibleView key={`${i}`} biblePresent={biblePresent}
                        i={i} onBibleChange={(bible: string) => {
                            applyPresents(biblePresents.map((present, i1) => {
                                if (i1 === i) {
                                    present.bible = bible;
                                }
                                return present;
                            }));
                        }}
                        onClose={() => {
                            applyPresents(biblePresents.filter((_, i1) => i1 !== i));
                        }} />
                );
            }) : 'No Bible Available'}
            {biblePresents.length && <button className="btn btn-info" onClick={(e) => {
                const addBibleView = (bible: string) => {
                    const newPresent = JSON.parse(JSON.stringify(biblePresents[0])) as BiblePresentType;
                    newPresent.bible = bible;
                    const newPresents = [...biblePresents, newPresent];
                    applyPresents(newPresents);
                };
                const bibleList = bibleHelper.getBibleListWithStatus();
                const biblePresentingList = biblePresents.map(({ bible: bibleViewing }) => bibleViewing);
                const bibleListFiltered = bibleList.filter(([bible]) => !~biblePresentingList.indexOf(bible));

                showAppContextMenu(e, bibleListFiltered.map(([bible, isAvailable]) => {
                    return {
                        title: bible, disabled: !isAvailable, onClick: () => {
                            addBibleView(bible);
                        },
                    };
                }));
            }}>
                <i className="bi bi-plus" />
            </button>
            }
        </div>
    );
}
