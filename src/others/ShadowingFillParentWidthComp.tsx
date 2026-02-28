import {
    createContext,
    use,
    useEffect,
    useRef,
    useState,
    type DetailedHTMLProps,
    type HTMLAttributes,
    type JSX,
} from 'react';
import { createRoot } from 'react-dom/client';

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
    _parentWidth?: number;
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

    get parentWidth() {
        return this._parentWidth;
    }

    set parentWidth(value: number | undefined) {
        this._parentWidth = value;
        this.connectedCallback();
    }

    connectedCallback() {
        this.root.render(
            <ShadowingParentWidthContext value={this.parentWidth}>
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
    const [parentWidth, setParentWidth] = useState<number | undefined>(width);

    useEffect(() => {
        setParentWidth(width);
    }, [width]);

    useEffect(() => {
        if (myRef.current) {
            myRef.current.connectedCallback();
        }
    }, [myRef, children]);

    useEffect(() => {
        const targetElement = myRef.current?.parentElement;
        if (targetElement instanceof HTMLElement === false) {
            return;
        }
        setParentWidth(targetElement.clientWidth);
        const resizeObserver = new ResizeObserver(() => {
            setParentWidth(targetElement.clientWidth);
        });
        resizeObserver.observe(targetElement);
        return () => {
            resizeObserver.disconnect();
        };
    }, [myRef]);

    return (
        <shadowing-parent-width-tag
            ref={myRef}
            myContent={children}
            parentWidth={parentWidth}
        />
    );
}
