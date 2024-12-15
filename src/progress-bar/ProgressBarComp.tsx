import './ProgressBarComp.scss';

export default function ProgressBarComp({ title }: Readonly<{
    title?: string;
}>) {
    return (
        <div className='app-progress-bar progress w-100 h-100'
            title={
                title === undefined ? undefined :
                    `Progress: ${title}`
            }>
            <div className={
                'progress-bar progress-bar-striped ' +
                'progress-bar-animated bg-success'
            }
                role='progressbar'
                aria-valuenow={100}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{
                    width: '100%',
                }}
            />
        </div>
    );
}
