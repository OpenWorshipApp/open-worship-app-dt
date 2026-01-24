import type { ReactNode } from 'react';
import { Suspense } from 'react';
import LoadingComp from './LoadingComp';

export default function AppSuspenseComp({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return <Suspense fallback={<LoadingComp />}>{children}</Suspense>;
}
