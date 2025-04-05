import './ModalComp.scss';

import { PropsWithChildren, ReactNode } from 'react';

interface MyProps {
    children?: ReactNode;
}

export default function PrimitiveModalComp({
    children,
}: PropsWithChildren<MyProps>) {
    return <div id="modal-container">{children}</div>;
}
