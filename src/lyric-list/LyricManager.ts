import { createContext, use } from 'react';
import { type OpenLyric } from 'open-lyric';

import type Lyric from './Lyric';

class LyricManager {
    lyric: Lyric;
    openLyricPreviewer: OpenLyric;

    constructor(lyric: Lyric, openLyricPreviewer: OpenLyric) {
        this.lyric = lyric;
        this.openLyricPreviewer = openLyricPreviewer;
    }

    get filePath() {
        return this.lyric.filePath;
    }

    get fileSource() {
        return this.lyric.fileSource;
    }
}
export default LyricManager;

export const LyricManagerContext = createContext<LyricManager | null>(null);

export function useLyricManagerContext() {
    const context = use(LyricManagerContext);
    if (context === null) {
        throw new Error(
            'useLyricManagerContext must be used within a ' +
                'LyricManagerProvider',
        );
    }
    return context;
}
