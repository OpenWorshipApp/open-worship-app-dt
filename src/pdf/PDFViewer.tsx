import React, { Component } from 'react';
import { PDFImageData } from './PDFManager';

export type PDFViewerStateType = {
};
export type PDFViewerPropsType = {
    images: PDFImageData[];
};
export default class PDFViewer extends Component<PDFViewerPropsType, PDFViewerStateType> {
    ref: React.RefObject<HTMLDivElement>;
    constructor(props: PDFViewerPropsType) {
        super(props);
        this.ref = React.createRef();
    }
    render() {
        return (
            <div style={{
                height: '600px',
                overflow: 'auto',
            }} ref={this.ref} >
                {this.props.images.map(({
                    width,
                    height,
                    src,
                }, index) => {
                    return (
                        <img key={index}
                            width={width}
                            height={height}
                            src={src} />
                    );
                })}
            </div>
        );
    }
}