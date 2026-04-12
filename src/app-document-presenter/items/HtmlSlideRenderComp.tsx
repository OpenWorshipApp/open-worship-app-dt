import { type CSSProperties, useRef } from 'react';

import { useAppEffect } from '../../helper/debuggerHelpers';
import FileSource from '../../helper/FileSource';
import { pathToFileURL } from '../../server/calcHelpers';
import appProvider from '../../server/appProvider';
import { pathResolve } from '../../server/fileHelpers';

const RESOURCE_ATTR_NAMES = ['src', 'href', 'poster', 'data'] as const;
const EXTERNAL_RESOURCE_PATTERN = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;
const BLANK_HTML = '<!DOCTYPE html><html><head></head><body></body></html>';

function decodePathValue(pathValue: string) {
    try {
        return decodeURIComponent(pathValue);
    } catch (_error) {
        return pathValue;
    }
}

function resolveHtmlResourceUrl(url: string, baseDirPath: string) {
    const trimmed = url.trim();
    if (trimmed === '' || EXTERNAL_RESOURCE_PATTERN.test(trimmed)) {
        return url;
    }
    const suffixIndex = trimmed.search(/[?#]/);
    const rawPath =
        suffixIndex === -1 ? trimmed : trimmed.substring(0, suffixIndex);
    const suffix = suffixIndex === -1 ? '' : trimmed.substring(suffixIndex);
    const absoluteFilePath = pathResolve(baseDirPath, decodePathValue(rawPath));
    return `${pathToFileURL(absoluteFilePath)}${suffix}`;
}

function rewriteCssUrls(cssText: string, baseDirPath: string) {
    return cssText.replaceAll(
        /url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
        (_match, quote: string, url: string) => {
            return `url(${quote}${resolveHtmlResourceUrl(url, baseDirPath)}${quote})`;
        },
    );
}

function rewriteSrcSet(srcset: string, baseDirPath: string) {
    return srcset
        .split(',')
        .map((candidate) => {
            const trimmed = candidate.trim();
            if (trimmed === '') {
                return trimmed;
            }
            const [url, ...rest] = trimmed.split(/\s+/);
            return [resolveHtmlResourceUrl(url, baseDirPath), ...rest].join(
                ' ',
            );
        })
        .join(', ');
}

function rebaseElementAttributes(element: Element, baseDirPath: string) {
    for (const attrName of RESOURCE_ATTR_NAMES) {
        const value = element.getAttribute(attrName);
        if (value === null) {
            continue;
        }
        element.setAttribute(
            attrName,
            resolveHtmlResourceUrl(value, baseDirPath),
        );
    }
}

function rebaseSvgHref(element: Element, baseDirPath: string) {
    const svgHref = element.getAttribute('xlink:href');
    if (svgHref !== null) {
        element.setAttribute(
            'xlink:href',
            resolveHtmlResourceUrl(svgHref, baseDirPath),
        );
    }
    const href = element.getAttribute('href');
    if (href !== null && element.tagName.toLowerCase() === 'use') {
        element.setAttribute('href', resolveHtmlResourceUrl(href, baseDirPath));
    }
}

function rebaseInlineStyle(element: Element, baseDirPath: string) {
    const styleValue = element.getAttribute('style');
    if (styleValue?.includes('url(')) {
        element.setAttribute('style', rewriteCssUrls(styleValue, baseDirPath));
    }
}

function rebaseSrcSet(element: Element, baseDirPath: string) {
    const srcset = element.getAttribute('srcset');
    if (srcset !== null) {
        element.setAttribute('srcset', rewriteSrcSet(srcset, baseDirPath));
    }
}

function rebaseStyleElements(doc: Document, baseDirPath: string) {
    for (const styleElement of Array.from(doc.querySelectorAll('style'))) {
        if (styleElement.textContent === null) {
            continue;
        }
        styleElement.textContent = rewriteCssUrls(
            styleElement.textContent,
            baseDirPath,
        );
    }
}

function rebaseHtmlDocument(doc: Document, htmlFilePath?: string) {
    if (!htmlFilePath) {
        return;
    }
    const baseDirPath = FileSource.getInstance(htmlFilePath).baseDirPath;
    for (const element of Array.from(doc.querySelectorAll('*'))) {
        rebaseElementAttributes(element, baseDirPath);
        rebaseSvgHref(element, baseDirPath);
        rebaseInlineStyle(element, baseDirPath);
        rebaseSrcSet(element, baseDirPath);
    }
    rebaseStyleElements(doc, baseDirPath);
}

function createHtmlDocument(html?: string) {
    const parser = new DOMParser();
    return parser.parseFromString(html || BLANK_HTML, 'text/html');
}

function createShadowStyleElement() {
    const style = document.createElement('style');
    style.textContent = `
:host {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent;
    color-scheme: normal;
}
html,
body {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: transparent !important;
}
::-webkit-scrollbar {
    display: none;
}
`;
    return style;
}

export function mountHtmlSlideContent(
    host: HTMLElement,
    html?: string,
    htmlFilePath?: string,
) {
    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    const doc = createHtmlDocument(html);
    rebaseHtmlDocument(doc, htmlFilePath);
    shadowRoot.replaceChildren(createShadowStyleElement(), doc.documentElement);
}

function getReactHostStyle(width: number, height: number): CSSProperties {
    return {
        display: 'block',
        colorScheme: 'normal',
        pointerEvents: appProvider.isPageScreen ? 'all' : 'none',
        backgroundColor: 'transparent',
        width,
        height,
        border: 'none',
        overflow: 'hidden',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        contain: 'strict',
    };
}

function applyHostStyle(host: HTMLDivElement, width: number, height: number) {
    Object.assign(host.style, {
        display: 'block',
        colorScheme: 'normal',
        pointerEvents: appProvider.isPageScreen ? 'all' : 'none',
        backgroundColor: 'transparent',
        width: `${width}px`,
        height: `${height}px`,
        border: 'none',
        overflow: 'hidden',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        contain: 'strict',
    });
}

export function genHtmlSlideContent({
    html,
    htmlFilePath,
    width,
    height,
    parentWidth,
}: Readonly<{
    html?: string;
    htmlFilePath?: string;
    width: number;
    height: number;
    parentWidth?: number;
}>) {
    const host = document.createElement('div');
    applyHostStyle(host, width, height);
    mountHtmlSlideContent(host, html, htmlFilePath);
    if (parentWidth === undefined) {
        return host;
    }
    const wrapper = document.createElement('div');
    const scale = parentWidth / width;
    Object.assign(wrapper.style, {
        position: 'relative',
        width: '100%',
        aspectRatio: `${width} / ${height}`,
    });
    Object.assign(host.style, {
        position: 'absolute',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        inset: '0',
    });
    wrapper.appendChild(host);
    return wrapper;
}

export default function HtmlSlideRenderComp({
    html,
    htmlFilePath,
    width,
    height,
    parentWidth,
}: Readonly<{
    html?: string;
    htmlFilePath?: string;
    width: number;
    height: number;
    parentWidth?: number;
}>) {
    const ref = useRef<HTMLDivElement>(null);
    useAppEffect(() => {
        if (ref.current === null) {
            return;
        }
        mountHtmlSlideContent(ref.current, html, htmlFilePath);
    }, [html, htmlFilePath]);

    const hostStyle = getReactHostStyle(width, height);
    if (parentWidth !== undefined) {
        const scale = parentWidth / width;
        return (
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: `${width} / ${height}`,
                }}
            >
                <div
                    ref={ref}
                    style={{
                        ...hostStyle,
                        position: 'absolute',
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        inset: 0,
                    }}
                />
            </div>
        );
    }
    return <div ref={ref} style={hostStyle} />;
}
