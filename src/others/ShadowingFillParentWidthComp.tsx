import {
    createContext,
    use,
    useRef,
    type DetailedHTMLProps,
    type HTMLAttributes,
    type JSX,
} from 'react';
import { createRoot } from 'react-dom/client';
import { useAppEffect } from '../helper/debuggerHelpers';

declare module 'react/jsx-runtime' {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace JSX {
        interface IntrinsicElements {
            'shadowing-parent-width-tag': DetailedHTMLProps<
                HTMLAttributes<HTMLElement>,
                HTMLElement
            > & {
                myContent: JSX.Element;
                parentWidth?: number;
            };
        }
    }
}

const defaultStyle = `
* {
    transition: transform 0.1s ease-in-out;
}
`;

const ShadowingParentWidthContext = createContext<number | undefined>(
    undefined,
);
export function useShadowingParentWidth() {
    const parentWidth = use(ShadowingParentWidthContext);
    return parentWidth;
}

class ShadowingParentWidthCustomHTMLTag extends HTMLElement {
    myContent: JSX.Element;
    root: ReturnType<typeof createRoot>;
    constructor() {
        super();
        this.myContent = <></>;
        const div = document.createElement('div');
        Object.assign(div.style, {
            width: '100%',
            height: '100%',
            padding: '0',
            margin: '0',
            border: 'none',
        });
        this.attachShadow({
            mode: 'open',
        }).appendChild(div);
        this.root = createRoot(div);
    }

    setParentWidth(width: number) {
        this.setAttribute('parentWidth', width.toString());
        this.connectedCallback();
    }

    connectedCallback() {
        const parentWidthAttr = this.getAttribute('parentWidth');
        let parentWidth =
            parentWidthAttr === null
                ? undefined
                : Number.parseFloat(parentWidthAttr);
        if (Number.isNaN(parentWidth)) {
            parentWidth = undefined;
        }
        this.root.render(
            <ShadowingParentWidthContext value={parentWidth}>
                <style>{defaultStyle}</style>
                {this.myContent}
            </ShadowingParentWidthContext>,
        );
    }
}

if (!customElements.get('shadowing-parent-width-tag')) {
    customElements.define(
        'shadowing-parent-width-tag',
        ShadowingParentWidthCustomHTMLTag,
    );
}

export default function ShadowingFillParentWidthComp({
    children,
    width,
}: Readonly<{
    children: JSX.Element;
    width?: number;
}>) {
    const myRef = useRef<ShadowingParentWidthCustomHTMLTag>(null);

    useAppEffect(() => {
        myRef.current?.connectedCallback();
    }, [myRef, children]);

    useAppEffect(() => {
        const current = myRef.current;
        if (current === null) {
            return;
        }
        const targetElement = current.parentElement;
        if (targetElement instanceof HTMLElement === false) {
            return;
        }
        current.setParentWidth(targetElement.clientWidth);
        const resizeObserver = new ResizeObserver(() => {
            current.setParentWidth(targetElement.clientWidth);
        });
        resizeObserver.observe(targetElement);
        return () => {
            resizeObserver.disconnect();
        };
    }, [myRef.current, width]);

    return (
        <shadowing-parent-width-tag
            ref={myRef}
            myContent={children}
            parentWidth={width}
        />
    );
}
