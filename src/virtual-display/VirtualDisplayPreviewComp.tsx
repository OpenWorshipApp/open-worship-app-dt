import { tran } from '../lang/langHelpers';
import { toVirtualDisplayPagePath } from '../../electron/virtualDisplayProtocol';

// What the virtual display shows, drawn the way a browser watching it draws
// it -- its own page, from this computer's address, silent. Nothing is encoded
// for it, and it is mounted only while the operator asks for it.
export default function VirtualDisplayPreviewComp({
    port,
    number,
    width,
    height,
}: Readonly<{ port: number; number: number; width: number; height: number }>) {
    return (
        <iframe
            className="w-100 rounded border"
            style={{ aspectRatio: `${width} / ${height}`, background: '#000' }}
            title={tran('Preview')}
            src={`http://127.0.0.1:${port}${toVirtualDisplayPagePath(number)}?preview=1`}
        />
    );
}
