import './SettingPopup.scss';

import HeaderEditorPopup from './HeaderSettingPopup';
import Modal from '../others/Modal';
import { SettingGeneral } from './SettingGeneral';
import { SettingBible } from './SettingBible';
import { SettingAbout } from './SettingAbout';
import { useStateSettingString } from '../helper/settingHelper';
import TabRender from '../others/TabRender';

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
// g: general, b: bible, a: about
type TabType = 'g' | 'b' | 'a';
function Setting() {
    const [tabType, setTabType] = useStateSettingString<TabType>('popup-setting-tab', 'b');
    return (
        <div className='card-body d-flex flex-column'>
            <div className='setting-header d-flex'>
                <TabRender<TabType> tabs={[
                    ['g', 'General'],
                    ['b', 'Bible'],
                    ['a', 'About'],
                ]}
                    activeTab={tabType}
                    setActiveTab={setTabType} />
            </div>
            <div className='setting-body flex-fill flex h'>
                {tabType === 'g' && <SettingGeneral />}
                {tabType === 'b' && <SettingBible />}
                {tabType === 'a' && <SettingAbout />}
            </div>
        </div>
    );
}
