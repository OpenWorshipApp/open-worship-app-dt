import { createRoot } from 'react-dom/client';
import MiniScreenAppComp from './MiniScreenAppComp';
import { getScreenManagerBase } from '../managers/screenManagerBaseHelpers';
import type ScreenManagerBase from '../managers/ScreenManagerBase';
import { type DetailedHTMLProps, type HTMLAttributes } from 'react';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';

const HTML_TAG_NAME = 'mini-screen-previewer-custom-html';

declare module 'react/jsx-runtime' {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace JSX {
        interface IntrinsicElements {
            [HTML_TAG_NAME]: DetailedHTMLProps<
                HTMLAttributes<HTMLElement> & { screenId: number },
                HTMLElement
            >;
        }
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
        // Contain the preview within the parent box. In normal view the
        // parent's height already tracks the screen's aspect ratio, so width is
        // the binding dimension; but in full view the parent can be
        // proportionally wider than the screen, and scaling by width alone
        // overflows the height and clips the bottom (transform-origin top-left +
        // the parent's overflow:hidden). Scale by whichever dimension is
        // smaller and center the result within the leftover space.
        const { width, height } = screenManagerBase;
        const scale = Math.min(
            parentElement.clientWidth / width,
            parentElement.clientHeight / height,
        );
        const offsetX = (parentElement.clientWidth - width * scale) / 2;
        const offsetY = (parentElement.clientHeight - height * scale) / 2;
        const div = this.mountPoint;
        div.style.width = `${width}px`;
        div.style.height = `${height}px`;
        div.style.transformOrigin = 'top left';
        div.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
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
        screenManagerBase.getElementsByDomSelector = (domSelector: string) => {
            return Array.from(div.querySelectorAll(domSelector));
        };
        screenManagerBase.registerEventListener(['scale'], () => {
            this.setMountPointScale(screenManagerBase);
            this.attemptTimeout(() => {
                this.setMountPointScale(screenManagerBase);
            });
        });
        this.setMountPointScale(screenManagerBase);
        root.render(<MiniScreenAppComp screenId={this.screenId} />);
    }
}

if (customElements.get(HTML_TAG_NAME) === undefined) {
    customElements.define(HTML_TAG_NAME, CustomHTMLScreenPreviewer);
}
