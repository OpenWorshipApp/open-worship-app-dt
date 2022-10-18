import './SettingPopup.scss';

import HeaderEditorPopup from './HeaderSettingPopup';
import Modal from '../others/Modal';
import { useStateSettingString } from '../helper/settingHelper';
import TabRender, { genTabBody } from '../others/TabRender';
import React from 'react';

const SettingGeneral = React.lazy(() => import('./SettingGeneral'));
const SettingBible = React.lazy(() => import('./SettingBible'));
const SettingAbout = React.lazy(() => import('./SettingAbout'));

export default function SettingPopup() {
    return (
        <Modal>
            <div id='setting-popup'
                className='app-modal shadow card'>
                <HeaderEditorPopup />
                <Setting />
            </div>
        </Modal>
    );
}
const tabTypeList = [
    ['g', 'General', SettingGeneral],
    ['b', 'Bible', SettingBible],
    ['a', 'About', SettingAbout],
] as const;
type TabType = typeof tabTypeList[number][0];
function Setting() {
    const [tabType, setTabType] = useStateSettingString<TabType>('popup-setting-tab', 'b');
    return (
        <div className='card-body d-flex flex-column'>
            <div className='setting-header d-flex'>
                <TabRender<TabType>
                    tabs={tabTypeList.map(([type, name]) => {
                        return [type, name];
                    })}
                    activeTab={tabType}
                    setActiveTab={setTabType} />
            </div>
            <div className='setting-body flex-fill flex h'>
                {tabTypeList.map(([type, _, target]) => {
                    return genTabBody<TabType>(tabType, [type, target]);
                })}
            </div>
        </div>
    );
}
