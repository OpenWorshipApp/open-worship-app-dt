import { type CSSProperties, type ReactNode, useMemo } from 'react';

import type { SlideStageViewType } from './documentStageContexts';
import {
    fitSlideIntoBox,
    genDocumentStageLayout,
    genStageBoxStyle,
    genStageContentStyle,
    genStageFrameStyle,
    genStageIndexStyle,
    getStageSideOpacity,
} from './documentStageHelpers';
import VarySlideSideContentComp from './VarySlideSideContentComp';
import type { LookAheadBoundsType } from '../../lyric-list/lyricLookAheadHelpers';

// A slide's corner count, at the bottom right of its box.
function StageIndexLabelComp({
    box,
    label,
}: Readonly<{ box: LookAheadBoundsType; label: string }>) {
    return (
        <div style={genStageBoxStyle(box) as CSSProperties}>
            <div
                className="stage-look-ahead-index"
                style={genStageIndexStyle(box) as CSSProperties}
            >
                {label}
            </div>
        </div>
    );
}

/**
 * A document's slide as a stage draws it in a Stage Previewer card: the slide
 * (`children`, at its own `width` x `height`) in the current box, the slides
 * around it smaller in theirs, and each one's corner count. The projector draws the
 * same layout from the same helpers (`stageLookAheadDomHelpers`).
 */
export default function StageLookAheadComp({
    width,
    height,
    view,
    children,
}: Readonly<{
    width: number;
    height: number;
    view: SlideStageViewType;
    children: ReactNode;
}>) {
    const { definition, label, sides } = view;
    const layout = useMemo(() => {
        return genDocumentStageLayout(definition, width, height);
    }, [definition, width, height]);
    const isArranged = definition.arrangement !== null;
    return (
        <div
            style={{
                position: 'relative',
                width: `${width}px`,
                height: `${height}px`,
                overflow: 'hidden',
            }}
        >
            <div style={genStageBoxStyle(layout.current) as CSSProperties}>
                <div
                    style={
                        genStageContentStyle(
                            width,
                            height,
                            layout.currentScale,
                        ) as CSSProperties
                    }
                >
                    {children}
                </div>
            </div>
            {sides.map(({ offset, varySlide }, i) => {
                const box = layout.sideList[i];
                if (box === undefined || varySlide === null) {
                    return null;
                }
                const opacity = getStageSideOpacity(definition, offset);
                const fit = fitSlideIntoBox(
                    box,
                    varySlide.width,
                    varySlide.height,
                );
                return (
                    <div
                        key={offset}
                        style={genStageBoxStyle(box, opacity) as CSSProperties}
                    >
                        <div
                            style={
                                genStageContentStyle(
                                    varySlide.width,
                                    varySlide.height,
                                    fit.scale,
                                    fit.left,
                                    fit.top,
                                ) as CSSProperties
                            }
                        >
                            <VarySlideSideContentComp varySlide={varySlide} />
                        </div>
                    </div>
                );
            })}
            {isArranged ? (
                <div
                    style={
                        genStageFrameStyle(
                            layout.current,
                            height,
                        ) as CSSProperties
                    }
                />
            ) : null}
            {isArranged
                ? sides.map(({ offset, varySlide }, i) => {
                      const box = layout.sideList[i];
                      if (box === undefined || varySlide === null) {
                          return null;
                      }
                      return (
                          <div
                              key={`frame-${offset}`}
                              style={
                                  genStageFrameStyle(
                                      box,
                                      height,
                                      getStageSideOpacity(definition, offset),
                                  ) as CSSProperties
                              }
                          />
                      );
                  })
                : null}
            {label === null ? null : (
                <StageIndexLabelComp box={layout.current} label={label} />
            )}
            {sides.map((side, i) => {
                const box = layout.sideList[i];
                if (
                    box === undefined ||
                    side.varySlide === null ||
                    side.label === null
                ) {
                    return null;
                }
                return (
                    <StageIndexLabelComp
                        key={`label-${side.offset}`}
                        box={box}
                        label={side.label}
                    />
                );
            })}
        </div>
    );
}
