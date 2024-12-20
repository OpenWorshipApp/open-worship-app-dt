import { LazyExoticComponent } from 'react';

import { tran } from '../lang';
import AppSuspense from './AppSuspense';

export type TabHeaderPropsType<T> = [T, string, string?];
export default function TabRender<T extends string>({
    tabs, activeTab, setActiveTab, className,
}: Readonly<{
    tabs: TabHeaderPropsType<T>[],
    activeTab: T,
    setActiveTab?: (t: T) => void,
    className?: string,
}>) {
    return (
        <ul className={`nav nav-tabs ${className}`}>
            {tabs.map(([tab, title, tabClassName]) => {
                const activeClass = activeTab === tab ? 'active' : '';
                return (<li key={title}
                    className={'nav-item ' + (tabClassName || '')}>
                    <button className={`btn btn-link nav-link ${activeClass}`}
                        onClick={() => {
                            setActiveTab?.(tab);
                        }}>
                        {tran(title)}
                    </button>
                </li>);
            })}
        </ul>
    );
}

export function genTabBody<T>(tabTab: T,
    data: [T, LazyExoticComponent<() => React.JSX.Element | null>]) {
    const Element = data[1];
    return (
        <AppSuspense key={data[0] as any}>
            {tabTab === data[0] && <Element />}
        </AppSuspense>
    );
}
