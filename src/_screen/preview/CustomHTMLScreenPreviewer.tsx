import { DOMAttributes } from 'react';

import { createRoot } from 'react-dom/client';
import MiniScreenAppComp from './MiniScreenAppComp';
import { getScreenManagerBase } from '../managers/screenManagerBaseHelpers';
import { genTimeoutAttempt } from '../../helper/helpers';
import ScreenManagerBase from '../managers/ScreenManagerBase';

const HTML_TAG_NAME = 'mini-screen-previewer-custom-html';

type CustomEvents<K extends string> = {
    [key in K]: (event: CustomEvent) => void;
};
type CustomElement<T, K extends string> = Partial<
    T &
        DOMAttributes<T> & {
            children: any;
        } & CustomEvents<`on${K}`>
>;
declare module 'react' {
    interface IntrinsicElements {
        [HTML_TAG_NAME]: CustomElement<
            CustomHTMLScreenPreviewer,
            'FTScroll' | 'VerseHover' | 'VerseSelect'
        >;
    }
}

export default class CustomHTMLScreenPreviewer extends HTMLElement {
    mountPoint: HTMLDivElement;
    attemptTimeout: (func: () => void) => void;
    screenId: number;
    constructor() {
        super();
        this.screenId = -1;
        this.mountPoint = document.createElement('div');
        this.attemptTimeout = genTimeoutAttempt(100);
    }
    setMountPointScale(screenManagerBase: ScreenManagerBase) {
        const parentElement = this.parentElement;
        if (parentElement === null) {
            return;
        }
        const scale = parentElement.clientWidth / screenManagerBase.width;
        const div = this.mountPoint;
        div.style.width = `${screenManagerBase.width}px`;
        div.style.height = `${screenManagerBase.height}px`;
        div.style.transform = `scale(${scale})`;
        div.style.transformOrigin = 'top left';
    }
    connectedCallback() {
        if (this.screenId === -1) {
            return;
        }
        const div = this.mountPoint;
        this.attachShadow({
            mode: 'open',
        }).appendChild(div);

        const root = createRoot(div);
        const screenManagerBase = getScreenManagerBase(this.screenId);
        if (screenManagerBase === null) {
            return;
        }
        screenManagerBase.registerEventListener(['resize'], () => {
            this.setMountPointScale(screenManagerBase);
            this.attemptTimeout(() => {
                this.setMountPointScale(screenManagerBase);
            });
        });
        this.setMountPointScale(screenManagerBase);
        root.render(<MiniScreenAppComp screenId={this.screenId} />);
    }
}

customElements.define(HTML_TAG_NAME, CustomHTMLScreenPreviewer);
