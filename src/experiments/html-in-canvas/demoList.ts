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
import { YouTubeComp, YouTubeOverlayComp } from './youtubeDemo';
import { YouTubeMirrorComp } from './youtubeMirrorDemo';
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
        sourceList: ['basicsDemos.tsx#BasicDrawComp'],
    },
    {
        id: 'overloads',
        group: 'Basics',
        title: 'Draw overloads',
        Comp: OverloadsComp,
        sourceList: ['basicsDemos.tsx#OverloadsComp'],
    },
    {
        id: 'paint',
        group: 'Basics',
        title: 'The paint event',
        Comp: PaintEventComp,
        sourceList: ['basicsDemos.tsx#PaintEventComp'],
    },
    {
        id: 'clock',
        group: 'Basics',
        title: 'requestPaint() clock',
        Comp: RequestPaintClockComp,
        sourceList: ['basicsDemos.tsx#RequestPaintClockComp'],
    },
    {
        id: 'root-vs-descendant',
        group: 'Semantics',
        title: 'Root vs descendant animation',
        Comp: RootVsDescendantComp,
        sourceList: ['animationSemanticsDemos.tsx#RootVsDescendantComp'],
    },
    {
        id: 'canvas-space',
        group: 'Semantics',
        title: 'Canvas-space transform',
        Comp: CanvasSpaceAnimComp,
        sourceList: ['animationSemanticsDemos.tsx#CanvasSpaceAnimComp'],
    },
    {
        id: 'filter',
        group: 'Semantics',
        title: 'ctx.filter',
        Comp: FilterComp,
        sourceList: [
            'paintSemanticsDemos.tsx#FILTER_LIST',
            'paintSemanticsDemos.tsx#FilterComp',
        ],
    },
    {
        id: 'clip',
        group: 'Semantics',
        title: 'ctx.clip() wipes',
        Comp: ClipWipeComp,
        sourceList: ['paintSemanticsDemos.tsx#ClipWipeComp'],
    },
    {
        id: 'backdrop',
        group: 'Semantics',
        title: 'backdrop-filter',
        Comp: BackdropFilterComp,
        sourceList: ['paintSemanticsDemos.tsx#BackdropFilterComp'],
    },
    {
        id: 'layout',
        group: 'Semantics',
        title: 'Child layout rules',
        Comp: LayoutRulesComp,
        sourceList: ['layoutRulesDemo.tsx#LayoutRulesComp'],
    },
    {
        id: 'transitions',
        group: 'Transitions',
        title: '10 slide transitions',
        Comp: TransitionsComp,
        sourceList: [
            'transitionEffects.ts#TRANSITION_MAP',
            'transitionsDemo.tsx#TransitionsComp',
        ],
    },
    {
        id: 'per-item',
        group: 'Nested',
        title: 'Per-item stagger',
        Comp: PerItemStaggerComp,
        sourceList: ['perItemDemos.tsx#PerItemStaggerComp'],
    },
    {
        id: 'cached-bg',
        group: 'Nested',
        title: 'Cached background + live item',
        Comp: CachedBackgroundComp,
        sourceList: ['perItemDemos.tsx#CachedBackgroundComp'],
    },
    {
        id: 'inside-item',
        group: 'Nested',
        title: 'Animation inside an item',
        Comp: InsideItemAnimationComp,
        sourceList: ['insideItemDemos.tsx#InsideItemAnimationComp'],
    },
    {
        id: 'nested-canvas',
        group: 'Nested',
        title: 'Nested canvas (dead end)',
        Comp: NestedCanvasComp,
        sourceList: ['insideItemDemos.tsx#NestedCanvasComp'],
    },
    {
        id: 'text',
        group: 'Content',
        title: 'Rich text',
        Comp: RichTextComp,
        sourceList: ['contentDemos.tsx#RichTextComp'],
    },
    {
        id: 'iframe',
        group: 'Content',
        title: 'Iframes',
        Comp: IframeComp,
        sourceList: ['contentDemos.tsx#IframeComp'],
    },
    {
        id: 'video',
        group: 'Content',
        title: 'Video',
        Comp: VideoComp,
        sourceList: ['contentDemos.tsx#VideoComp'],
    },
    {
        id: 'youtube',
        group: 'Content',
        title: 'YouTube embed vs stream',
        Comp: YouTubeComp,
        sourceList: [
            'youtubeDemo.tsx#toEmbedUrl',
            'youtubeDemo.tsx#readPixel',
            'youtubeDemo.tsx#StreamVideoComp',
            'youtubeDemo.tsx#YouTubeComp',
        ],
    },
    {
        id: 'youtube-overlay',
        group: 'Content',
        title: 'YouTube overlay (workaround)',
        Comp: YouTubeOverlayComp,
        sourceList: ['youtubeDemo.tsx#YouTubeOverlayComp'],
    },
    {
        id: 'youtube-mirror',
        group: 'Content',
        title: 'YouTube mirrored out',
        Comp: YouTubeMirrorComp,
        sourceList: [
            'youtubeMirrorDemo.tsx#startMirror',
            'youtubeMirrorDemo.tsx#YouTubeMirrorComp',
        ],
    },
    {
        id: 'snapshot',
        group: 'Snapshots',
        title: 'captureElementImage',
        Comp: SnapshotComp,
        sourceList: ['snapshotDemo.tsx#SnapshotComp'],
    },
    {
        id: 'hit-test',
        group: 'Interaction',
        title: 'Hit testing',
        Comp: HitTestComp,
        sourceList: ['interactionDemo.tsx#HitTestComp'],
    },
    {
        id: 'preview',
        group: 'Previews',
        title: 'Mini previews',
        Comp: MiniPreviewComp,
        sourceList: ['previewDemos.tsx#MiniPreviewComp'],
    },
    {
        id: 'staging',
        group: 'Previews',
        title: 'Off-screen staging',
        Comp: StagingComp,
        sourceList: [
            'previewDemos.tsx#STAGING_CASE_LIST',
            'previewDemos.tsx#StagingComp',
        ],
    },
    {
        id: 'benchmark',
        group: 'Performance',
        title: 'Benchmark',
        Comp: BenchmarkComp,
        sourceList: ['benchmarkDemo.tsx#BenchmarkComp'],
    },
];
