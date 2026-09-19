import type { AppColorType } from '../others/color/colorHelpers';

export default function ScreenBackgroundColorComp({
    color,
}: Readonly<{
    color: AppColorType;
}>) {
    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                backgroundColor: color,
            }}
        />
    );
}
