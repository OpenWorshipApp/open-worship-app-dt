/**
 * Every demo in the playground, grouped for the sidebar.
 */
import type { DemoType } from './htmlInCanvasTypes';
import {
    BasicDrawComp,
    OverloadsComp,
    PaintEventComp,
    RequestPaintClockComp,
} from './basicsDemos';
import {
    CanvasSpaceAnimComp,
    RootVsDescendantComp,
} from './animationSemanticsDemos';
import {
    BackdropFilterComp,
    ClipWipeComp,
    FilterComp,
} from './paintSemanticsDemos';
import { LayoutRulesComp } from './layoutRulesDemo';
import { TransitionsComp } from './transitionsDemo';
import { CachedBackgroundComp, PerItemStaggerComp } from './perItemDemos';
import { InsideItemAnimationComp, NestedCanvasComp } from './insideItemDemos';
import { IframeComp, RichTextComp, VideoComp } from './contentDemos';
import { SnapshotComp } from './snapshotDemo';
import { HitTestComp } from './interactionDemo';
import { MiniPreviewComp, StagingComp } from './previewDemos';
import { BenchmarkComp } from './benchmarkDemo';

export const DEMO_LIST: DemoType[] = [
    {
        id: 'basic',
        group: 'Basics',
        title: 'Draw a subtree',
        Comp: BasicDrawComp,
    },
    {
        id: 'overloads',
        group: 'Basics',
        title: 'Draw overloads',
        Comp: OverloadsComp,
    },
    {
        id: 'paint',
        group: 'Basics',
        title: 'The paint event',
        Comp: PaintEventComp,
    },
    {
        id: 'clock',
        group: 'Basics',
        title: 'requestPaint() clock',
        Comp: RequestPaintClockComp,
    },
    {
        id: 'root-vs-descendant',
        group: 'Semantics',
        title: 'Root vs descendant animation',
        Comp: RootVsDescendantComp,
    },
    {
        id: 'canvas-space',
        group: 'Semantics',
        title: 'Canvas-space transform',
        Comp: CanvasSpaceAnimComp,
    },
    { id: 'filter', group: 'Semantics', title: 'ctx.filter', Comp: FilterComp },
    {
        id: 'clip',
        group: 'Semantics',
        title: 'ctx.clip() wipes',
        Comp: ClipWipeComp,
    },
    {
        id: 'backdrop',
        group: 'Semantics',
        title: 'backdrop-filter',
        Comp: BackdropFilterComp,
    },
    {
        id: 'layout',
        group: 'Semantics',
        title: 'Child layout rules',
        Comp: LayoutRulesComp,
    },
    {
        id: 'transitions',
        group: 'Transitions',
        title: '10 slide transitions',
        Comp: TransitionsComp,
    },
    {
        id: 'per-item',
        group: 'Nested',
        title: 'Per-item stagger',
        Comp: PerItemStaggerComp,
    },
    {
        id: 'cached-bg',
        group: 'Nested',
        title: 'Cached background + live item',
        Comp: CachedBackgroundComp,
    },
    {
        id: 'inside-item',
        group: 'Nested',
        title: 'Animation inside an item',
        Comp: InsideItemAnimationComp,
    },
    {
        id: 'nested-canvas',
        group: 'Nested',
        title: 'Nested canvas (dead end)',
        Comp: NestedCanvasComp,
    },
    { id: 'text', group: 'Content', title: 'Rich text', Comp: RichTextComp },
    { id: 'iframe', group: 'Content', title: 'Iframes', Comp: IframeComp },
    { id: 'video', group: 'Content', title: 'Video', Comp: VideoComp },
    {
        id: 'snapshot',
        group: 'Snapshots',
        title: 'captureElementImage',
        Comp: SnapshotComp,
    },
    {
        id: 'hit-test',
        group: 'Interaction',
        title: 'Hit testing',
        Comp: HitTestComp,
    },
    {
        id: 'preview',
        group: 'Previews',
        title: 'Mini previews',
        Comp: MiniPreviewComp,
    },
    {
        id: 'staging',
        group: 'Previews',
        title: 'Off-screen staging',
        Comp: StagingComp,
    },
    {
        id: 'benchmark',
        group: 'Performance',
        title: 'Benchmark',
        Comp: BenchmarkComp,
    },
];
