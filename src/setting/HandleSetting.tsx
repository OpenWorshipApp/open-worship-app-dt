import { useState } from 'react';
import { useWindowEvent } from '../event/WindowEventListener';
import SettingPopup, { openSettingEvent } from './SettingPopup';

export default function HandleSetting() {
    const [isShowing, setIsShowing] = useState(false);
    useWindowEvent(openSettingEvent, () => setIsShowing(true));
    return isShowing ? <SettingPopup /> : null;
}
