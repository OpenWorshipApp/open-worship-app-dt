import ShowingScreenIcon from '../_screen/preview/ShowingScreenIcon';

export default function RenderBackgroundScreenIds({
    screenIds,
}: Readonly<{
    screenIds: number[];
}>) {
    return (
        <div
            style={{
                position: 'absolute',
                textShadow: '1px 1px 5px #000',
            }}
        >
            {screenIds.map((screenId) => {
                return <ShowingScreenIcon key={screenId} screenId={screenId} />;
            })}
        </div>
    );
}
