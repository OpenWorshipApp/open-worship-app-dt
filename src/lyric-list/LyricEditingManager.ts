import { createContext, use } from 'react';
import {
    defaultLyricEditingProps,
    LyricEditingPropsType,
} from './LyricAppDocument';
import { handleError } from '../helper/errorHelpers';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import FileSource from '../helper/FileSource';
import { markdownCacheManager } from './markdownHelpers';

class LyricEditingManager {
    settingPrefix = '';
    settingName = 'lyric-editing-props';
    filePath: string | null = null;
    lyricEditingProps: LyricEditingPropsType = defaultLyricEditingProps;

    constructor(settingPrefix: string) {
        this.settingPrefix = settingPrefix;
        this.settingName = `${settingPrefix}-${this.settingName}`;
        try {
            this.lyricEditingProps = {
                ...this.lyricEditingProps,
                ...JSON.parse(
                    appLocalStorage.getItem(this.settingName) ?? '{}',
                ),
            };
        } catch (error) {
            handleError(error);
        }
    }

    saveSettings() {
        try {
            appLocalStorage.setItem(
                this.settingName,
                JSON.stringify(this.lyricEditingProps),
            );
            if (this.filePath !== null) {
                const fileSource = FileSource.getInstance(this.filePath);
                markdownCacheManager.clear();
                fileSource.fireUpdateEvent();
            }
        } catch (error) {
            handleError(error);
        }
    }

    get fontFamily() {
        return this.lyricEditingProps.fontFamily;
    }
    set fontFamily(fontFamily: string) {
        this.lyricEditingProps.fontFamily = fontFamily;
        this.saveSettings();
    }

    get fontWeight() {
        return this.lyricEditingProps.fontWeight;
    }
    set fontWeight(fontWeight: string) {
        this.lyricEditingProps.fontWeight = fontWeight;
        this.saveSettings();
    }

    get scale() {
        return this.lyricEditingProps.scale;
    }
    set scale(scale: number) {
        this.lyricEditingProps.scale = scale;
        this.saveSettings();
    }
}
export default LyricEditingManager;

export const LyricEditingManagerContext =
    createContext<LyricEditingManager | null>(null);

export function useLyricEditingManagerContext() {
    const context = use(LyricEditingManagerContext);
    if (context === null) {
        throw new Error(
            'useLyricEditingManagerContext must be used within a ' +
                'LyricEditingManagerProvider',
        );
    }
    return context;
}
