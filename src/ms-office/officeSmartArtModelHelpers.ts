/**
 * A SmartArt's boxes added, taken out or moved, and its layout taken from
 * another SmartArt of the deck, in ANY of PowerPoint's layouts
 * (2026-11-21, `EC-787`, the goal _chatbot can change do everything on a
 * given pptx_: five layouts were done by hand and about 190 others were
 * left to PowerPoint).
 *
 * Every SmartArt carries the definition of its own layout (`layout1.xml`),
 * and a program lays it out from that and the data alone. What the data
 * must hold besides the person's boxes is the presentation points: one per
 * shape the definition draws, named after its layout nodes, joined to the
 * box whose words it shows -- LibreOffice, which shows a deck in this app,
 * draws nothing without them. This reads the definition (its `forEach`,
 * `choose`, variables and repeats) over the boxes and writes those points as
 * PowerPoint writes them. Measured on the 55 SmartArts in LibreOffice's own
 * test decks, 34 layouts saved by PowerPoint: the points and their links
 * came out as PowerPoint wrote them in 54 (the 55th is a definition edited
 * by hand after the save), every text link's order in 511 of 511, a shape's
 * colour number in 49.
 *
 * Nothing is changed unless the SmartArt's own points come out of its
 * definition exactly as they are in the file before the change: a layout
 * read wrongly is refused, never written. The drawing PowerPoint keeps
 * beside a SmartArt for programs that do not lay one out is dropped after
 * such a change, as in a deck PowerPoint 2007 saved: PowerPoint and
 * LibreOffice lay it out again from the definition. Pure.
 */

import {
    type ConnectionType,
    type PointType,
    genModelIdMaker,
    listConnections,
    listPoints,
    readAttribute,
    readWordsText,
    setAttribute,
} from './officeSmartArtLayoutHelpers';

type LayoutElementType = {
    name: string;
    attrs: Map<string, string>;
    children: LayoutElementType[];
};

const XML_ENTITY_MAP: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
};

function toUnescapedText(value: string) {
    return value.replace(/&(amp|lt|gt|quot|apos);/g, (_all, name: string) => {
        return XML_ENTITY_MAP[name];
    });
}

function toEscapedText(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** An XML part as a tree of its elements, prefixes dropped. */
export function parseSmartArtXmlTree(xml: string): LayoutElementType | null {
    const stack: LayoutElementType[] = [];
    let root: LayoutElementType | null = null;
    const pattern =
        /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
    for (const match of xml.matchAll(pattern)) {
        if (match[2] === undefined) {
            continue;
        }
        if (match[1] === '/') {
            stack.pop();
            continue;
        }
        const attrs = new Map<string, string>();
        for (const attr of match[3].matchAll(
            /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
        )) {
            attrs.set(
                attr[1].replace(/^[^:]*:/, ''),
                toUnescapedText(attr[2] ?? attr[3] ?? ''),
            );
        }
        const element: LayoutElementType = {
            name: match[2].replace(/^[^:]*:/, ''),
            attrs,
            children: [],
        };
        const parent = stack.at(-1);
        if (parent !== undefined) {
            parent.children.push(element);
        } else if (root === null) {
            root = element;
        }
        if (match[4] !== '/') {
            stack.push(element);
        }
    }
    return root;
}

// --- the boxes as the data holds them ---------------------------------------

type DiagramModelType = {
    points: PointType[];
    connections: ConnectionType[];
    typeMap: Map<string, string>;
    docId: string;
    childMap: Map<string, string[]>;
    parentMap: Map<string, string>;
};

const PRESENTATION_LINK_TYPE_SET = new Set(['presOf', 'presParOf']);

function readDiagramModel(dataXml: string): DiagramModelType | null {
    const points = listPoints(dataXml);
    const connections = listConnections(dataXml);
    const typeMap = new Map(
        points.map((point) => {
            return [point.modelId, point.type];
        }),
    );
    const doc = points.find((point) => {
        return point.type === 'doc';
    });
    if (doc === undefined) {
        return null;
    }
    const linkMap = new Map<string, ConnectionType[]>();
    for (const connection of connections) {
        if (
            connection.type !== 'parOf' ||
            !typeMap.has(connection.srcId) ||
            !typeMap.has(connection.destId)
        ) {
            continue;
        }
        const list = linkMap.get(connection.srcId) ?? [];
        list.push(connection);
        linkMap.set(connection.srcId, list);
    }
    const childMap = new Map<string, string[]>();
    const parentMap = new Map<string, string>();
    for (const [srcId, list] of linkMap) {
        const sequence: string[] = [];
        for (const connection of list.sort((one, other) => {
            return one.srcOrd - other.srcOrd;
        })) {
            for (const id of [
                connection.parTransId,
                connection.destId,
                connection.sibTransId,
            ]) {
                if (id !== null && typeMap.has(id)) {
                    sequence.push(id);
                    parentMap.set(id, srcId);
                }
            }
        }
        childMap.set(srcId, sequence);
    }
    return {
        points,
        connections,
        typeMap,
        docId: doc.modelId,
        childMap,
        parentMap,
    };
}

function checkIsPointOfType(
    model: DiagramModelType,
    modelId: string,
    wanted: string,
) {
    const type = model.typeMap.get(modelId);
    switch (wanted) {
        case '':
        case 'all':
            return type !== 'pres';
        case 'node':
            return type === 'node' || type === 'asst';
        case 'norm':
        case 'nonAsst':
            return type === 'node';
        case 'nonNorm':
        case 'asst':
            return type === 'asst';
        default:
            return type === wanted;
    }
}

function listOnAxis(model: DiagramModelType, modelId: string, axis: string) {
    const { childMap, parentMap } = model;
    const parentId = parentMap.get(modelId);
    switch (axis) {
        case 'self':
            return [modelId];
        case 'ch':
            return [...(childMap.get(modelId) ?? [])];
        case 'par':
            return parentId === undefined ? [] : [parentId];
        case 'des':
        case 'desOrSelf': {
            const list = axis === 'desOrSelf' ? [modelId] : [];
            const walk = (id: string) => {
                for (const child of childMap.get(id) ?? []) {
                    list.push(child);
                    walk(child);
                }
            };
            walk(modelId);
            return list;
        }
        case 'ancst':
        case 'ancstOrSelf': {
            const list = axis === 'ancstOrSelf' ? [modelId] : [];
            let id = parentMap.get(modelId);
            while (id !== undefined) {
                list.push(id);
                id = parentMap.get(id);
            }
            return list;
        }
        case 'root':
            return [model.docId];
        case 'followSib':
        case 'precedSib': {
            if (parentId === undefined) {
                return [];
            }
            const siblings = childMap.get(parentId) ?? [];
            const at = siblings.indexOf(modelId);
            return axis === 'followSib'
                ? siblings.slice(at + 1)
                : siblings.slice(0, at);
        }
        default:
            return [];
    }
}

function measureDepth(model: DiagramModelType, modelId: string) {
    let depth = 0;
    let id = model.parentMap.get(modelId);
    while (id !== undefined) {
        const type = model.typeMap.get(id);
        if (type === 'node' || type === 'asst' || type === 'doc') {
            depth += 1;
        }
        id = model.parentMap.get(id);
    }
    return depth;
}

function checkIsLastSiblingTransition(
    model: DiagramModelType,
    modelId: string,
) {
    const parentId = model.parentMap.get(modelId);
    if (model.typeMap.get(modelId) !== 'sibTrans' || parentId === undefined) {
        return false;
    }
    const list = (model.childMap.get(parentId) ?? []).filter((id) => {
        return model.typeMap.get(id) === 'sibTrans';
    });
    return list.at(-1) === modelId;
}

function readList(element: LayoutElementType, name: string) {
    const value = element.attrs.get(name);
    return value === undefined || value.trim() === ''
        ? []
        : value.trim().split(/\s+/);
}

// python-like slicing: from `start` (1-based, negative from the end) by
// `step`, at most `count`
function sliceSelection(list: string[], start: number, step: number) {
    let first = start;
    if (first < 0) {
        first = list.length + first + 1;
    }
    if (first < 1) {
        return list;
    }
    const result: string[] = [];
    if (step > 0) {
        for (let at = first - 1; at < list.length; at += step) {
            result.push(list[at]);
        }
    } else if (step < 0) {
        for (
            let at = Math.min(first - 1, list.length - 1);
            at >= 0;
            at += step
        ) {
            result.push(list[at]);
        }
    }
    return result;
}

function selectPoints(
    model: DiagramModelType,
    contextId: string,
    iterator: LayoutElementType,
) {
    const axisList = readList(iterator, 'axis');
    if (axisList.length === 0) {
        return [];
    }
    const typeList = readList(iterator, 'ptType');
    const startList = readList(iterator, 'st');
    const countList = readList(iterator, 'cnt');
    const stepList = readList(iterator, 'step');
    const hideList = readList(iterator, 'hideLastTrans');
    let current = [contextId];
    axisList.forEach((axis, index) => {
        const wanted = typeList[index] ?? typeList.at(-1) ?? 'all';
        const hide = hideList[index] ?? hideList.at(-1) ?? 'true';
        const next: string[] = [];
        for (const id of current) {
            let list = listOnAxis(model, id, axis).filter((one) => {
                return checkIsPointOfType(model, one, wanted);
            });
            if (
                (hide === 'true' || hide === '1') &&
                wanted === 'sibTrans' &&
                axis === 'ch' &&
                list.length > 0
            ) {
                list = list.slice(0, -1);
            }
            const start = Number(startList[index] ?? '1') || 1;
            const step = Number(stepList[index] ?? '1') || 1;
            const count = Number(countList[index] ?? '0') || 0;
            list = sliceSelection(list, start, step);
            if (count > 0) {
                list = list.slice(0, count);
            }
            next.push(...list);
        }
        current = next;
    });
    return current;
}

// --- the shapes a definition draws over the boxes ---------------------------

export type SmartArtPresType = {
    name: string;
    assocId: string;
    label: string | null;
    varList: LayoutElementType[];
    index: number;
};

type ScopeType = {
    assocId: string;
    name: string;
    vars: Map<string, string | null>;
};

const VAR_DEFAULT_MAP: Record<string, string> = {
    dir: 'norm',
    hierBranch: 'std',
    orgChart: 'false',
    bulletEnabled: 'false',
    chMax: '-1',
    chPref: '-1',
    animOne: 'one',
    animLvl: 'none',
    resizeHandles: 'rel',
};

function toVarValue(value: string | undefined) {
    if (value === '1') {
        return 'true';
    }
    if (value === '0') {
        return 'false';
    }
    return value ?? '';
}

const MAX_PRES_COUNT = 5000;

class PresGenerator {
    readonly presList: SmartArtPresType[] = [];
    readonly presOfList: { dataId: string; presIndex: number }[] = [];
    readonly presParOfList: { parentIndex: number; childIndex: number }[] = [];
    private readonly namedMap = new Map<string, LayoutElementType>();
    private readonly model: DiagramModelType;
    // a person's own setting of a layout's variable, by `assoc|name`
    private readonly oldVarMap: Map<string, Map<string, string | null>>;

    constructor(
        model: DiagramModelType,
        oldVarMap: Map<string, Map<string, string | null>>,
        definition: LayoutElementType,
    ) {
        this.model = model;
        this.oldVarMap = oldVarMap;
        const walk = (element: LayoutElementType) => {
            const name = element.attrs.get('name');
            if (element.name === 'forEach' && name !== undefined) {
                this.namedMap.set(name, element);
            }
            element.children.forEach(walk);
        };
        walk(definition);
    }

    private readVar(name: string, scope: ScopeType[]) {
        for (let at = scope.length - 1; at >= 0; at -= 1) {
            const { assocId, name: presName, vars } = scope[at];
            const old = this.oldVarMap.get(`${assocId}|${presName}`);
            if (old?.has(name)) {
                return old.get(name) ?? VAR_DEFAULT_MAP[name];
            }
            if (vars.has(name)) {
                return vars.get(name) ?? VAR_DEFAULT_MAP[name];
            }
        }
        return VAR_DEFAULT_MAP[name];
    }

    private test(
        element: LayoutElementType,
        contextId: string,
        position: number,
        count: number,
        scope: ScopeType[],
    ) {
        const func = element.attrs.get('func');
        const op = element.attrs.get('op') ?? 'equ';
        const value = element.attrs.get('val') ?? '';
        if (func === 'var') {
            const got = toVarValue(
                this.readVar(element.attrs.get('arg') ?? '', scope),
            );
            const wanted = toVarValue(value);
            if (op === 'equ') {
                return got === wanted;
            }
            if (op === 'neq') {
                return got !== wanted;
            }
            return false;
        }
        let got = 0;
        if (func === 'cnt') {
            got = selectPoints(this.model, contextId, element).length;
        } else if (func === 'maxDepth') {
            const base = measureDepth(this.model, contextId);
            got = selectPoints(this.model, contextId, element).reduce(
                (most, id) => {
                    return Math.max(most, measureDepth(this.model, id) - base);
                },
                0,
            );
        } else if (func === 'depth') {
            got = measureDepth(this.model, contextId);
        } else if (func === 'pos') {
            got = position;
        } else if (func === 'revPos') {
            got = count - position + 1;
        } else if (func === 'posEven') {
            got = position % 2 === 0 ? 1 : 0;
        } else if (func === 'posOdd') {
            got = position % 2 === 1 ? 1 : 0;
        }
        const wanted =
            value === 'true' ? 1 : value === 'false' ? 0 : Number(value);
        switch (op) {
            case 'equ':
                return got === wanted;
            case 'neq':
                return got !== wanted;
            case 'gt':
                return got > wanted;
            case 'lt':
                return got < wanted;
            case 'gte':
                return got >= wanted;
            case 'lte':
                return got <= wanted;
            default:
                return false;
        }
    }

    // the branch of a `choose` taken, if any
    private pickBranch(
        choose: LayoutElementType,
        contextId: string,
        position: number,
        count: number,
        scope: ScopeType[],
    ) {
        for (const branch of choose.children) {
            if (branch.name === 'else') {
                return branch;
            }
            if (
                branch.name === 'if' &&
                this.test(branch, contextId, position, count, scope)
            ) {
                return branch;
            }
        }
        return null;
    }

    private readAlg(
        element: LayoutElementType,
        contextId: string,
        position: number,
        count: number,
        scope: ScopeType[],
    ): string | null {
        for (const child of element.children) {
            if (child.name === 'alg') {
                return child.attrs.get('type') ?? null;
            }
            if (child.name === 'choose') {
                const branch = this.pickBranch(
                    child,
                    contextId,
                    position,
                    count,
                    scope,
                );
                if (branch !== null) {
                    const alg = this.readAlg(
                        branch,
                        contextId,
                        position,
                        count,
                        scope,
                    );
                    if (alg !== null) {
                        return alg;
                    }
                }
            }
        }
        return null;
    }

    private addPresOf(
        element: LayoutElementType,
        contextId: string,
        pres: SmartArtPresType,
        position: number,
        count: number,
        scope: ScopeType[],
    ) {
        for (const child of element.children) {
            if (child.name === 'presOf' && child.attrs.has('axis')) {
                for (const dataId of selectPoints(
                    this.model,
                    contextId,
                    child,
                )) {
                    this.presOfList.push({ dataId, presIndex: pres.index });
                }
            } else if (child.name === 'choose') {
                const branch = this.pickBranch(
                    child,
                    contextId,
                    position,
                    count,
                    scope,
                );
                if (branch !== null) {
                    this.addPresOf(
                        branch,
                        contextId,
                        pres,
                        position,
                        count,
                        scope,
                    );
                }
            }
        }
    }

    private addNode(
        element: LayoutElementType,
        contextId: string,
        parent: SmartArtPresType | null,
        position: number,
        count: number,
        scope: ScopeType[],
    ) {
        if (this.presList.length >= MAX_PRES_COUNT) {
            throw new Error('too many shapes');
        }
        const name = element.attrs.get('name') ?? '';
        const varLst = element.children.find((child) => {
            return child.name === 'varLst';
        });
        const varList = varLst?.children ?? [];
        const pres: SmartArtPresType = {
            name,
            assocId: contextId,
            label: element.attrs.get('styleLbl') ?? null,
            varList,
            index: this.presList.length,
        };
        this.presList.push(pres);
        if (parent !== null) {
            this.presParOfList.push({
                parentIndex: parent.index,
                childIndex: pres.index,
            });
        }
        const ownScope = [
            ...scope,
            {
                assocId: contextId,
                name,
                vars: new Map(
                    varList.map((one) => {
                        return [one.name, one.attrs.get('val') ?? null];
                    }),
                ),
            },
        ];
        // a composite only holds the shapes it is drawn with
        if (
            this.readAlg(element, contextId, position, count, ownScope) !==
            'composite'
        ) {
            this.addPresOf(element, contextId, pres, position, count, ownScope);
        }
        this.addChildren(element, contextId, pres, position, count, ownScope);
    }

    private addChildren(
        element: LayoutElementType,
        contextId: string,
        parent: SmartArtPresType | null,
        position: number,
        count: number,
        scope: ScopeType[],
    ) {
        for (const child of element.children) {
            if (child.name === 'layoutNode') {
                this.addNode(child, contextId, parent, position, count, scope);
            } else if (child.name === 'forEach') {
                const ref = child.attrs.get('ref');
                const body = ref === undefined ? child : this.namedMap.get(ref);
                if (body === undefined) {
                    continue;
                }
                const hide = body.attrs.get('hideLastTrans') ?? 'true';
                let list = selectPoints(this.model, contextId, body);
                if (hide === 'true' || hide === '1') {
                    list = list.filter((id) => {
                        return !checkIsLastSiblingTransition(this.model, id);
                    });
                }
                list.forEach((id, index) => {
                    this.addChildren(
                        body,
                        id,
                        parent,
                        index + 1,
                        list.length,
                        scope,
                    );
                });
            } else if (child.name === 'choose') {
                const branch = this.pickBranch(
                    child,
                    contextId,
                    position,
                    count,
                    scope,
                );
                if (branch !== null) {
                    this.addChildren(
                        branch,
                        contextId,
                        parent,
                        position,
                        count,
                        scope,
                    );
                }
            }
        }
    }

    run(definition: LayoutElementType) {
        const root = definition.children.find((child) => {
            return child.name === 'layoutNode';
        });
        if (root === undefined) {
            return false;
        }
        this.addNode(root, this.model.docId, null, 1, 1, []);
        this.presOfList.push({ dataId: this.model.docId, presIndex: 0 });
        return true;
    }
}

type OldPresType = {
    point: PointType;
    name: string;
    assocId: string;
    label: string | null;
    styleIndex: string | null;
    styleCount: string | null;
};

function readOldPres(point: PointType): OldPresType {
    const set = /<dgm:prSet\b[^>]*?\/?>/.exec(point.xml)?.[0] ?? '';
    return {
        point,
        name: readAttribute(set, 'presName') ?? '',
        assocId: readAttribute(set, 'presAssocID') ?? '',
        label: readAttribute(set, 'presStyleLbl'),
        styleIndex: readAttribute(set, 'presStyleIdx'),
        styleCount: readAttribute(set, 'presStyleCnt'),
    };
}

function readOldVarMap(oldList: OldPresType[]) {
    const map = new Map<string, Map<string, string | null>>();
    for (const old of oldList) {
        const inner =
            /<dgm:presLayoutVars>([\s\S]*?)<\/dgm:presLayoutVars>/.exec(
                old.point.xml,
            )?.[1];
        if (inner === undefined) {
            continue;
        }
        const vars = new Map<string, string | null>();
        for (const match of inner.matchAll(/<dgm:(\w+)\b([^>]*?)\/?>/g)) {
            vars.set(match[1], readAttribute(`<x${match[2]}>`, 'val'));
        }
        map.set(`${old.assocId}|${old.name}`, vars);
    }
    return map;
}

function genPresentation(
    model: DiagramModelType,
    definition: LayoutElementType,
    oldList: OldPresType[],
) {
    const generator = new PresGenerator(
        model,
        readOldVarMap(oldList),
        definition,
    );
    try {
        return generator.run(definition) ? generator : null;
    } catch {
        return null;
    }
}

// the shapes and links as a set, to tell whether two sets are the same
function toShapeKeySet(
    presList: { name: string; assocId: string }[],
    parentOf: (index: number) => number | null,
    presOfList: { dataId: string; presIndex: number }[],
) {
    const keySet = new Set<string>();
    presList.forEach((pres, index) => {
        const parentIndex = parentOf(index);
        const parent = parentIndex === null ? null : presList[parentIndex];
        keySet.add(
            `pres|${pres.name}|${pres.assocId}|` +
                `${parent?.name ?? ''}|${parent?.assocId ?? ''}`,
        );
    });
    for (const { dataId, presIndex } of presOfList) {
        const pres = presList[presIndex];
        keySet.add(`of|${dataId}|${pres.name}|${pres.assocId}`);
    }
    return keySet;
}

function checkIsSameSet(one: Set<string>, other: Set<string>) {
    return (
        one.size === other.size &&
        [...one].every((key) => {
            return other.has(key);
        })
    );
}

/**
 * Whether the SmartArt's own shapes are what its definition draws over its
 * boxes -- the test that the definition is read rightly before anything is
 * written with it.
 */
export function checkSmartArtPresMatches(dataXml: string, layoutXml: string) {
    const model = readDiagramModel(dataXml);
    const definition = parseSmartArtXmlTree(layoutXml);
    if (model === null || definition === null) {
        return false;
    }
    const oldList = model.points
        .filter((point) => {
            return point.type === 'pres';
        })
        .map(readOldPres);
    const generator = genPresentation(model, definition, oldList);
    if (generator === null) {
        return false;
    }
    const indexById = new Map(
        oldList.map((old, index) => {
            return [old.point.modelId, index];
        }),
    );
    const oldParentMap = new Map<number, number>();
    const oldPresOfList: { dataId: string; presIndex: number }[] = [];
    for (const connection of model.connections) {
        const childIndex = indexById.get(connection.destId);
        if (childIndex === undefined) {
            continue;
        }
        if (connection.type === 'presParOf') {
            const parentIndex = indexById.get(connection.srcId);
            if (parentIndex !== undefined) {
                oldParentMap.set(childIndex, parentIndex);
            }
        } else if (connection.type === 'presOf') {
            oldPresOfList.push({
                dataId: connection.srcId,
                presIndex: childIndex,
            });
        }
    }
    const newParentMap = new Map(
        generator.presParOfList.map(({ parentIndex, childIndex }) => {
            return [childIndex, parentIndex];
        }),
    );
    return checkIsSameSet(
        toShapeKeySet(
            oldList,
            (index) => {
                return oldParentMap.get(index) ?? null;
            },
            oldPresOfList,
        ),
        toShapeKeySet(
            generator.presList,
            (index) => {
                return newParentMap.get(index) ?? null;
            },
            generator.presOfList,
        ),
    );
}

// PowerPoint's label for a shape its definition names none for: by what it
// shows and how deep that is
function toDefaultLabel(model: DiagramModelType, shownId: string | null) {
    if (shownId === null) {
        return null;
    }
    const type = model.typeMap.get(shownId);
    const depth = Math.min(measureDepth(model, shownId), 4);
    switch (type) {
        case 'node':
            return `node${depth}`;
        case 'asst':
            return `asst${Math.max(depth - 1, 0)}`;
        case 'parTrans':
            return `parChTrans1D${Math.max(depth, 1)}`;
        case 'sibTrans':
            return 'sibTrans2D1';
        default:
            return null;
    }
}

function serializeVarList(varList: LayoutElementType[]) {
    return varList
        .map((one) => {
            const val = one.attrs.get('val');
            return val === undefined
                ? `<dgm:${one.name}/>`
                : `<dgm:${one.name} val="${toEscapedText(val)}"/>`;
        })
        .join('');
}

function setStyleNumbers(pointXml: string, index: string, count: string) {
    return pointXml.replace(/<dgm:prSet\b[^>]*?(?=\/?>)/, (tag) => {
        let set = setAttribute(`${tag}>`, 'presStyleIdx', index);
        set = setAttribute(set, 'presStyleCnt', count);
        return set.slice(0, -1);
    });
}

export type SmartArtPresWriteType = {
    // every point and link of the data, the shapes written again
    pointsXml: string;
    connectionsXml: string;
    // the style labels the shapes draw with
    labelList: string[];
};

/**
 * The shapes a definition draws over the data's boxes, written as the data's
 * presentation points and links -- an old shape of the same name for the
 * same box kept with its look, its id and its settings.
 */
export function genSmartArtPresXml(
    data: {
        points: PointType[];
        connections: ConnectionType[];
    },
    layoutXml: string,
    old: { points: PointType[]; connections: ConnectionType[] },
    takenIds: Set<string>,
): SmartArtPresWriteType | null {
    const definition = parseSmartArtXmlTree(layoutXml);
    if (definition === null) {
        return null;
    }
    const uniqueId = definition.attrs.get('uniqueId') ?? '';
    const pointsXml = data.points
        .map((point) => {
            return point.xml;
        })
        .join('');
    const dataXml =
        `<dgm:ptLst>${pointsXml}</dgm:ptLst><dgm:cxnLst>` +
        data.connections
            .map((connection) => {
                return connection.xml;
            })
            .join('') +
        '</dgm:cxnLst>';
    const model = readDiagramModel(dataXml);
    if (model === null) {
        return null;
    }
    const oldList = old.points
        .filter((point) => {
            return point.type === 'pres';
        })
        .map(readOldPres);
    const generator = genPresentation(model, definition, oldList);
    if (generator === null) {
        return null;
    }
    // what each old shape showed, else the box it belonged to
    const oldShownMap = new Map<string, string>();
    for (const connection of old.connections) {
        if (
            connection.type === 'presOf' &&
            !oldShownMap.has(connection.destId)
        ) {
            oldShownMap.set(connection.destId, connection.srcId);
        }
    }
    const makeId = genModelIdMaker(takenIds);
    const { presList, presOfList, presParOfList } = generator;
    // what each shape shows, else the box it belongs to
    const shownIdMap = new Map<number, string>();
    for (const { dataId, presIndex } of presOfList) {
        if (!shownIdMap.has(presIndex)) {
            shownIdMap.set(presIndex, dataId);
        }
    }
    // an old shape of the same name for the same box, kept
    const oldQueueMap = new Map<string, OldPresType[]>();
    for (const old of oldList) {
        const key = `${old.assocId}|${old.name}`;
        oldQueueMap.set(key, [...(oldQueueMap.get(key) ?? []), old]);
    }
    const keptList = presList.map((pres) => {
        const queue = oldQueueMap.get(`${pres.assocId}|${pres.name}`);
        return queue?.shift() ?? null;
    });
    // a label read off old shapes of the same name, as deep, when this
    // layout is the one they were drawn in
    const oldLabelMap = new Map<string, string | null>();
    const zeroNameSet = new Set<string>();
    const countedNameSet = new Set<string>();
    for (const old of oldList) {
        const shownId = oldShownMap.get(old.point.modelId) ?? old.assocId;
        const depth = measureDepth(model, shownId);
        oldLabelMap.set(`${old.name}|${depth}`, old.label);
        if (!oldLabelMap.has(old.name)) {
            oldLabelMap.set(old.name, old.label);
        }
        if (old.styleCount === null || old.styleCount === '0') {
            zeroNameSet.add(old.name);
        } else {
            countedNameSet.add(old.name);
        }
    }
    const labelList = presList.map((pres, index) => {
        const kept = keptList[index];
        if (kept !== null) {
            return kept.label;
        }
        if (pres.label !== null) {
            return pres.label;
        }
        const shownId = shownIdMap.get(index) ?? null;
        const depth = measureDepth(model, shownId ?? pres.assocId);
        const key = `${pres.name}|${depth}`;
        if (oldLabelMap.has(key)) {
            return oldLabelMap.get(key) ?? null;
        }
        if (oldLabelMap.has(pres.name)) {
            return oldLabelMap.get(pres.name) ?? null;
        }
        return toDefaultLabel(model, shownId);
    });
    // a shape's colour number: the place of what it shows among the shapes
    // of its label
    const groupMap = new Map<string, string[]>();
    presList.forEach((pres, index) => {
        const label = labelList[index];
        if (
            label === null ||
            (zeroNameSet.has(pres.name) && !countedNameSet.has(pres.name))
        ) {
            return;
        }
        const shownId = shownIdMap.get(index) ?? pres.assocId;
        const list = groupMap.get(label) ?? [];
        if (!list.includes(shownId)) {
            list.push(shownId);
        }
        groupMap.set(label, list);
    });
    // a label whose shapes show the same boxes as before keeps its numbers
    const oldGroupMap = new Map<string, Set<string>>();
    for (const old of oldList) {
        if (old.label === null) {
            continue;
        }
        const set = oldGroupMap.get(old.label) ?? new Set<string>();
        set.add(old.assocId);
        oldGroupMap.set(old.label, set);
    }
    const presIdList: string[] = [];
    const presXmlList = presList.map((pres, index) => {
        const kept = keptList[index];
        const label = labelList[index];
        const shownId = shownIdMap.get(index) ?? pres.assocId;
        const group = label === null ? undefined : groupMap.get(label);
        const styleIndex =
            group === undefined ? '0' : String(group.indexOf(shownId));
        const styleCount = group === undefined ? '0' : String(group.length);
        if (kept !== null) {
            presIdList.push(kept.point.modelId);
            const oldGroup =
                kept.label === null ? undefined : oldGroupMap.get(kept.label);
            const newAssocSet = new Set(
                presList
                    .filter((_one, at) => {
                        return labelList[at] === kept.label;
                    })
                    .map((one) => {
                        return one.assocId;
                    }),
            );
            const isSameGroup =
                oldGroup !== undefined && checkIsSameSet(oldGroup, newAssocSet);
            return isSameGroup || kept.label === null
                ? kept.point.xml
                : setStyleNumbers(kept.point.xml, styleIndex, styleCount);
        }
        const id = makeId();
        presIdList.push(id);
        const varsXml = serializeVarList(pres.varList);
        return (
            `<dgm:pt modelId="${id}" type="pres"><dgm:prSet ` +
            `presAssocID="${pres.assocId}" presName="${toEscapedText(pres.name)}" ` +
            (label === null
                ? 'presStyleCnt="0"'
                : `presStyleLbl="${label}" presStyleIdx="${styleIndex}" ` +
                  `presStyleCnt="${styleCount}"`) +
            (varsXml === ''
                ? '/>'
                : `><dgm:presLayoutVars>${varsXml}</dgm:presLayoutVars>` +
                  '</dgm:prSet>') +
            '<dgm:spPr/></dgm:pt>'
        );
    });
    // the links: an old one between the same two kept
    const oldLinkMap = new Map<string, string>();
    for (const connection of old.connections) {
        if (!PRESENTATION_LINK_TYPE_SET.has(connection.type)) {
            continue;
        }
        oldLinkMap.set(
            `${connection.type}|${connection.srcId}|${connection.destId}`,
            connection.modelId,
        );
    }
    const usedLinkIdSet = new Set<string>();
    const toLinkId = (type: string, srcId: string, destId: string) => {
        const old = oldLinkMap.get(`${type}|${srcId}|${destId}`);
        if (old !== undefined && !usedLinkIdSet.has(old)) {
            usedLinkIdSet.add(old);
            return old;
        }
        return makeId();
    };
    const linkXmlList: string[] = [];
    const shownCountMap = new Map<string, number>();
    const showsCountMap = new Map<number, number>();
    for (const { dataId, presIndex } of presOfList) {
        const srcOrd = shownCountMap.get(dataId) ?? 0;
        const destOrd = showsCountMap.get(presIndex) ?? 0;
        shownCountMap.set(dataId, srcOrd + 1);
        showsCountMap.set(presIndex, destOrd + 1);
        const presId = presIdList[presIndex];
        linkXmlList.push(
            `<dgm:cxn modelId="${toLinkId('presOf', dataId, presId)}" ` +
                `type="presOf" srcId="${dataId}" destId="${presId}" ` +
                `srcOrd="${srcOrd}" destOrd="${destOrd}" ` +
                `presId="${toEscapedText(uniqueId)}"/>`,
        );
    }
    const childCountMap = new Map<number, number>();
    for (const { parentIndex, childIndex } of presParOfList) {
        const srcOrd = childCountMap.get(parentIndex) ?? 0;
        childCountMap.set(parentIndex, srcOrd + 1);
        const srcId = presIdList[parentIndex];
        const destId = presIdList[childIndex];
        linkXmlList.push(
            `<dgm:cxn modelId="${toLinkId('presParOf', srcId, destId)}" ` +
                `type="presParOf" srcId="${srcId}" destId="${destId}" ` +
                `srcOrd="${srcOrd}" destOrd="0" ` +
                `presId="${toEscapedText(uniqueId)}"/>`,
        );
    }
    const keptConnectionsXml = data.connections
        .filter((connection) => {
            return !PRESENTATION_LINK_TYPE_SET.has(connection.type);
        })
        .map((connection) => {
            return connection.xml;
        })
        .join('');
    return {
        pointsXml: pointsXml + presXmlList.join(''),
        connectionsXml: keptConnectionsXml + linkXmlList.join(''),
        labelList: [
            ...new Set(
                labelList.filter((label): label is string => {
                    return label !== null;
                }),
            ),
        ],
    };
}

// --- the boxes changed ------------------------------------------------------

export type SmartArtBoxPlaceType = 'after' | 'before' | 'under';

export type SmartArtBoxEditType =
    | {
          kind: 'add';
          words: string;
          place: SmartArtBoxPlaceType | null;
          target: string | null;
      }
    | { kind: 'remove'; words: string }
    | {
          kind: 'move';
          words: string;
          place: SmartArtBoxPlaceType;
          target: string;
      };

export type SmartArtBoxEditResultType = {
    dataXml: string;
    // the boxes' words afterwards, each with the words of the box it is under
    boxes: { words: string; under: string | null }[];
    // the words drawn inside a box taken out, gone with it
    takenWith: string[];
    labelList: string[];
};

// a box's words as a person reads them, a line a paragraph
function readBoxWords(pointXml: string) {
    const lines = [...pointXml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)]
        .map((match) => {
            // a line break inside a paragraph is a line too
            return readWordsText(
                match[1].replace(
                    /<a:br\b[^>]*?(?:\/>|>[\s\S]*?<\/a:br>)/g,
                    '<a:t>\n</a:t>',
                ),
            );
        })
        .filter((line) => {
            return line !== '';
        });
    return toUnescapedText(
        lines.length === 0 ? readWordsText(pointXml) : lines.join('\n'),
    );
}

function toComparedWords(words: string) {
    return words.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function listBoxWords(
    model: DiagramModelType,
    pointMap: Map<string, PointType>,
) {
    const list: { words: string; under: string | null }[] = [];
    const walk = (parentId: string, under: string | null) => {
        for (const id of model.childMap.get(parentId) ?? []) {
            const type = model.typeMap.get(id);
            if (type !== 'node' && type !== 'asst') {
                continue;
            }
            const words = readBoxWords(pointMap.get(id)?.xml ?? '');
            list.push({ words, under });
            walk(id, words);
        }
    };
    walk(model.docId, null);
    return list;
}

function genWordsXml(words: string, likePointXml: string | null) {
    const like = likePointXml ?? '';
    const body = /<a:bodyPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:bodyPr>)/.exec(like);
    const list = /<a:lstStyle\b[^>]*?(?:\/>|>[\s\S]*?<\/a:lstStyle>)/.exec(
        like,
    );
    const run = /<a:rPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:rPr>)/.exec(like);
    const runXml = (run?.[0] ?? '<a:rPr lang="en-US"/>').replace(
        /\s(?:dirty|err|smtClean)="[^"]*"/g,
        '',
    );
    const paragraphs = words
        .split(/\r?\n/)
        .map((line) => {
            return line.trim() === ''
                ? '<a:p><a:endParaRPr lang="en-US"/></a:p>'
                : `<a:p><a:r>${runXml}<a:t>${toEscapedText(line)}</a:t></a:r></a:p>`;
        })
        .join('');
    return (
        `<dgm:t>${body?.[0] ?? '<a:bodyPr/>'}` +
        `${list?.[0] ?? '<a:lstStyle/>'}${paragraphs}</dgm:t>`
    );
}

/**
 * A box added, taken out (the words drawn inside it with it, the boxes
 * of their own under it moved up into its place) or moved, by the words on the boxes, and the shapes drawn again from the
 * SmartArt's own definition -- refused when that definition does not give
 * back the shapes the file holds now.
 */
export function editSmartArtBoxesXml(
    dataXml: string,
    layoutXml: string,
    edit: SmartArtBoxEditType,
): SmartArtBoxEditResultType | { reason: string } {
    const model = readDiagramModel(dataXml);
    if (model === null) {
        return { reason: 'its data part names no diagram.' };
    }
    // a file holding no shapes at all (one written by a program other
    // than PowerPoint) has nothing to disagree with: they are drawn anew
    const hasPres = model.points.some((point) => {
        return point.type === 'pres';
    });
    if (hasPres && !checkSmartArtPresMatches(dataXml, layoutXml)) {
        return {
            reason:
                'its layout is one this app does not read rightly yet, so ' +
                'nothing changed: in PowerPoint, SmartArt Design → Add ' +
                'Shape, or select a box and press Delete.',
        };
    }
    const pointMap = new Map(
        model.points.map((point) => {
            return [point.modelId, point];
        }),
    );
    const boxIdList = [...model.typeMap]
        .filter(([id, type]) => {
            return (
                (type === 'node' || type === 'asst') && model.parentMap.has(id)
            );
        })
        .map(([id]) => {
            return id;
        });
    const shownBoxes = listBoxWords(model, pointMap)
        .map((box) => {
            return JSON.stringify(box.words);
        })
        .join(', ');
    // a box by all its words, else by one of its lines
    const findBox = (words: string): string | { reason: string } => {
        const wanted = toComparedWords(words);
        const toLines = (id: string) => {
            return readBoxWords(pointMap.get(id)?.xml ?? '').split('\n');
        };
        let found = boxIdList.filter((id) => {
            return toComparedWords(toLines(id).join(' ')) === wanted;
        });
        for (const pick of [
            (lines: string[]) => {
                return lines.slice(0, 1);
            },
            (lines: string[]) => {
                return lines;
            },
        ]) {
            if (found.length > 0) {
                break;
            }
            found = boxIdList.filter((id) => {
                return pick(toLines(id)).some((line) => {
                    return toComparedWords(line) === wanted;
                });
            });
        }
        if (found.length === 1) {
            return found[0];
        }
        return {
            reason:
                found.length === 0
                    ? `no box of it reads "${words}"; its boxes: ${shownBoxes}.`
                    : `${found.length} of its boxes read "${words}"; name ` +
                      'one by the words of the box beside or over it.',
        };
    };
    // the boxes under each box, in order, as links
    const linkList = model.connections.filter((connection) => {
        return (
            connection.type === 'parOf' &&
            model.typeMap.has(connection.srcId) &&
            model.typeMap.has(connection.destId)
        );
    });
    const linkByDest = new Map(
        linkList.map((connection) => {
            return [connection.destId, connection];
        }),
    );
    const orderMap = new Map<string, string[]>();
    for (const connection of [...linkList].sort((one, other) => {
        return one.srcOrd - other.srcOrd;
    })) {
        const list = orderMap.get(connection.srcId) ?? [];
        list.push(connection.destId);
        orderMap.set(connection.srcId, list);
    }
    const takenIds = new Set([
        ...model.points.map((point) => {
            return point.modelId;
        }),
        ...model.connections.map((connection) => {
            return connection.modelId;
        }),
    ]);
    const makeId = genModelIdMaker(takenIds);
    const removedIdSet = new Set<string>();
    const takenWith: string[] = [];
    const addedPoints: PointType[] = [];
    const addedConnections: ConnectionType[] = [];
    const parentOfBox = new Map<string, string>();
    for (const connection of linkList) {
        parentOfBox.set(connection.destId, connection.srcId);
    }
    const takeOut = (boxId: string) => {
        const parentId = parentOfBox.get(boxId) ?? model.docId;
        const list = orderMap.get(parentId) ?? [];
        const at = list.indexOf(boxId);
        list.splice(at, 1);
        orderMap.set(parentId, list);
        return { parentId, at };
    };
    const placeIn = (
        boxId: string,
        place: SmartArtBoxPlaceType | null,
        targetId: string | null,
    ) => {
        let parentId = model.docId;
        const topList = orderMap.get(model.docId) ?? [];
        // at its end: under the one box at its top, when its boxes are
        // under it (an org chart, a radial cycle's centre)
        if (
            targetId === null &&
            topList.length === 1 &&
            (orderMap.get(topList[0]) ?? []).length > 0
        ) {
            parentId = topList[0];
        }
        let at = (orderMap.get(parentId) ?? []).length;
        if (targetId !== null && place === 'under') {
            parentId = targetId;
            at = (orderMap.get(targetId) ?? []).length;
        } else if (targetId !== null) {
            parentId = parentOfBox.get(targetId) ?? model.docId;
            const list = orderMap.get(parentId) ?? [];
            at = list.indexOf(targetId) + (place === 'after' ? 1 : 0);
        }
        const list = orderMap.get(parentId) ?? [];
        list.splice(at, 0, boxId);
        orderMap.set(parentId, list);
        parentOfBox.set(boxId, parentId);
    };
    const findTarget = (words: string | null) => {
        return words === null ? null : findBox(words);
    };
    if (edit.kind === 'add') {
        const target = findTarget(edit.target);
        if (target !== null && typeof target !== 'string') {
            return target;
        }
        const boxId = makeId();
        const linkId = makeId();
        const parTransId = makeId();
        const sibTransId = makeId();
        const like =
            target ??
            (orderMap.get(model.docId) ?? []).at(-1) ??
            boxIdList[0] ??
            null;
        addedPoints.push(
            {
                modelId: boxId,
                type: 'node',
                xml:
                    `<dgm:pt modelId="${boxId}"><dgm:prSet ` +
                    'phldrT="[Text]"/><dgm:spPr/>' +
                    genWordsXml(
                        edit.words,
                        like === null
                            ? null
                            : (pointMap.get(like)?.xml ?? null),
                    ) +
                    '</dgm:pt>',
            },
            ...[
                [parTransId, 'parTrans'],
                [sibTransId, 'sibTrans'],
            ].map(([id, type]) => {
                return {
                    modelId: id,
                    type,
                    xml:
                        `<dgm:pt modelId="${id}" type="${type}" ` +
                        `cxnId="${linkId}"><dgm:prSet/><dgm:spPr/>` +
                        '<dgm:t><a:bodyPr/><a:lstStyle/><a:p>' +
                        '<a:endParaRPr lang="en-US"/></a:p></dgm:t></dgm:pt>',
                };
            }),
        );
        const link: ConnectionType = {
            modelId: linkId,
            type: 'parOf',
            srcId: model.docId,
            destId: boxId,
            srcOrd: 0,
            parTransId,
            sibTransId,
            xml:
                `<dgm:cxn modelId="${linkId}" srcId="${model.docId}" ` +
                `destId="${boxId}" srcOrd="0" destOrd="0" ` +
                `parTransId="${parTransId}" sibTransId="${sibTransId}"/>`,
        };
        addedConnections.push(link);
        linkByDest.set(boxId, link);
        placeIn(boxId, edit.place, target);
    } else {
        const box = findBox(edit.words);
        if (typeof box !== 'string') {
            return box;
        }
        if (edit.kind === 'remove') {
            if (boxIdList.length < 2) {
                return {
                    reason:
                        'it has no other box: take the SmartArt itself away ' +
                        '({slide, removeBox}).',
                };
            }
            // a box under it drawn only inside its shapes -- a bullet line
            // of a list -- goes with it; a box with a shape of its own (an
            // org chart's) moves up into its place, as in PowerPoint
            const assocMap = new Map<string, string>();
            for (const point of model.points) {
                if (point.type === 'pres') {
                    assocMap.set(point.modelId, readOldPres(point).assocId);
                }
            }
            const shownInMap = new Map<string, Set<string>>();
            for (const connection of model.connections) {
                const assocId = assocMap.get(connection.destId);
                if (connection.type === 'presOf' && assocId !== undefined) {
                    const shownIn =
                        shownInMap.get(connection.srcId) ?? new Set<string>();
                    shownIn.add(assocId);
                    shownInMap.set(connection.srcId, shownIn);
                }
            }
            const goneList = [box];
            const movedUp: string[] = [];
            const sortOut = (id: string) => {
                for (const childId of orderMap.get(id) ?? []) {
                    const shownIn = [...(shownInMap.get(childId) ?? [])];
                    if (
                        shownIn.length > 0 &&
                        shownIn.every((assocId) => {
                            return goneList.includes(assocId);
                        })
                    ) {
                        goneList.push(childId);
                        sortOut(childId);
                    } else {
                        movedUp.push(childId);
                    }
                }
            };
            sortOut(box);
            if (goneList.length >= boxIdList.length) {
                return {
                    reason:
                        'it has no other box: take the SmartArt itself away ' +
                        '({slide, removeBox}).',
                };
            }
            const { parentId, at } = takeOut(box);
            const list = orderMap.get(parentId) ?? [];
            list.splice(at, 0, ...movedUp);
            orderMap.set(parentId, list);
            for (const id of movedUp) {
                parentOfBox.set(id, parentId);
            }
            for (const id of goneList) {
                orderMap.delete(id);
                removedIdSet.add(id);
                const link = linkByDest.get(id);
                if (link !== undefined) {
                    removedIdSet.add(link.modelId);
                    for (const transId of [link.parTransId, link.sibTransId]) {
                        if (transId !== null) {
                            removedIdSet.add(transId);
                        }
                    }
                }
            }
            takenWith.push(
                ...goneList.slice(1).map((id) => {
                    return readBoxWords(pointMap.get(id)?.xml ?? '');
                }),
            );
        } else {
            const target = findBox(edit.target);
            if (typeof target !== 'string') {
                return target;
            }
            if (target === box) {
                return { reason: 'a box cannot be put beside itself.' };
            }
            let id: string | undefined = target;
            while (id !== undefined) {
                if (id === box) {
                    return {
                        reason:
                            `"${edit.target}" is under "${edit.words}": a ` +
                            'box cannot be put under its own boxes.',
                    };
                }
                id = parentOfBox.get(id);
            }
            takeOut(box);
            placeIn(box, edit.place, target);
        }
    }
    // every box's link written again with its place
    const linkXmlMap = new Map<string, string>();
    for (const [parentId, list] of orderMap) {
        list.forEach((boxId, order) => {
            const link = linkByDest.get(boxId);
            if (link === undefined) {
                return;
            }
            let tag = /^<dgm:cxn\b[^>]*?(?=\/?>)/.exec(link.xml)?.[0] ?? '';
            tag = setAttribute(`${tag}>`, 'srcId', parentId).slice(0, -1);
            tag = setAttribute(`${tag}>`, 'srcOrd', String(order)).slice(0, -1);
            linkXmlMap.set(
                link.modelId,
                link.xml.replace(/^<dgm:cxn\b[^>]*?(?=\/?>)/, tag),
            );
        });
    }
    const semanticPoints = [...model.points, ...addedPoints].filter((point) => {
        return point.type !== 'pres' && !removedIdSet.has(point.modelId);
    });
    const semanticConnections = [...model.connections, ...addedConnections]
        .filter((connection) => {
            return (
                !removedIdSet.has(connection.modelId) &&
                !PRESENTATION_LINK_TYPE_SET.has(connection.type)
            );
        })
        .map((connection) => {
            const xml = linkXmlMap.get(connection.modelId) ?? connection.xml;
            return { ...connection, xml };
        });
    const presWrite = genSmartArtPresXml(
        { points: semanticPoints, connections: semanticConnections },
        layoutXml,
        { points: model.points, connections: model.connections },
        takenIds,
    );
    if (presWrite === null) {
        return {
            reason:
                'its layout could not be drawn over the boxes as they would ' +
                'be, so nothing changed.',
        };
    }
    // a box drawn before, or the one added or moved, the layout would not
    // draw now -- a second box at the top of a layout that draws one
    const listShown = (connections: ConnectionType[]) => {
        return new Set(
            connections
                .filter((connection) => {
                    return connection.type === 'presOf';
                })
                .map((connection) => {
                    return connection.srcId;
                }),
        );
    };
    // with no shapes in the file, what its definition draws of it as it is
    const drawnBefore = hasPres
        ? null
        : genSmartArtPresXml(
              { points: model.points, connections: model.connections },
              layoutXml,
              { points: [], connections: [] },
              new Set(takenIds),
          );
    const shownBefore = listShown(
        drawnBefore === null
            ? model.connections
            : listConnections(
                  `<dgm:cxnLst>${drawnBefore.connectionsXml}</dgm:cxnLst>`,
              ),
    );
    const shownAfter = listShown(
        listConnections(`<dgm:cxnLst>${presWrite.connectionsXml}</dgm:cxnLst>`),
    );
    const askedId =
        edit.kind === 'add'
            ? (addedPoints[0]?.modelId ?? null)
            : edit.kind === 'move'
              ? findBox(edit.words)
              : null;
    const unshownList = [...boxIdList, ...(askedId === null ? [] : [askedId])]
        .filter((id, index, list) => {
            return (
                typeof id === 'string' &&
                list.indexOf(id) === index &&
                !removedIdSet.has(id) &&
                (shownBefore.has(id) || id === askedId) &&
                !shownAfter.has(id)
            );
        })
        .map((id) => {
            const point =
                pointMap.get(id as string) ??
                addedPoints.find((one) => {
                    return one.modelId === id;
                });
            return JSON.stringify(readBoxWords(point?.xml ?? ''));
        });
    if (unshownList.length > 0) {
        return {
            reason:
                `its layout would not draw ${unshownList.join(', ')} there, ` +
                'so nothing changed: put it beside or under a box it draws ' +
                '(`afterBox`, `beforeBox`, `underBox`).',
        };
    }
    const newDataXml = writeDataLists(dataXml, presWrite);
    const after = readDiagramModel(newDataXml);
    const afterPointMap = new Map(
        (after?.points ?? []).map((point) => {
            return [point.modelId, point];
        }),
    );
    return {
        dataXml: newDataXml,
        boxes: after === null ? [] : listBoxWords(after, afterPointMap),
        takenWith,
        labelList: presWrite.labelList,
    };
}

function writeDataLists(dataXml: string, write: SmartArtPresWriteType) {
    return dataXml
        .replace(/<dgm:ptLst>[\s\S]*?<\/dgm:ptLst>|<dgm:ptLst\/>/, () => {
            return `<dgm:ptLst>${write.pointsXml}</dgm:ptLst>`;
        })
        .replace(/<dgm:cxnLst>[\s\S]*?<\/dgm:cxnLst>|<dgm:cxnLst\/>/, () => {
            return `<dgm:cxnLst>${write.connectionsXml}</dgm:cxnLst>`;
        });
}

/** The id of a SmartArt's layout, as `read` names it ("chevron1"). */
export function readSmartArtLayoutId(xml: string) {
    const uniqueId =
        /<dgm:layoutDef\b[^>]*?\suniqueId="([^"]*)"/.exec(xml)?.[1] ??
        /<dgm:prSet\b[^>]*?\sloTypeId="([^"]*)"/.exec(xml)?.[1] ??
        null;
    if (uniqueId === null || uniqueId === '') {
        return null;
    }
    return uniqueId.split('/').at(-1) ?? null;
}

/**
 * The SmartArt given another SmartArt's layout, its definition copied: the
 * shapes drawn again over its own boxes. Refused when that definition does
 * not give back the other SmartArt's own shapes.
 */
export function changeSmartArtLayoutFromXml(
    dataXml: string,
    source: { dataXml: string; layoutXml: string },
): { dataXml: string; labelList: string[] } | { reason: string } {
    const model = readDiagramModel(dataXml);
    if (model === null) {
        return { reason: 'its data part names no diagram.' };
    }
    if (!checkSmartArtPresMatches(source.dataXml, source.layoutXml)) {
        return {
            reason:
                'the layout of the SmartArt it would be taken from is one ' +
                'this app does not read rightly yet, so nothing changed: ' +
                'in PowerPoint, SmartArt Design → Layouts.',
        };
    }
    const definition = parseSmartArtXmlTree(source.layoutXml);
    const uniqueId = definition?.attrs.get('uniqueId') ?? '';
    const category =
        /<dgm:cat\b[^>]*?\stype="([^"]*)"/.exec(source.layoutXml)?.[1] ?? null;
    const semanticPoints = model.points
        .filter((point) => {
            return point.type !== 'pres';
        })
        .map((point) => {
            if (point.type !== 'doc') {
                return point;
            }
            return {
                ...point,
                xml: point.xml.replace(/<dgm:prSet\b[^>]*?(?=\/?>)/, (tag) => {
                    let set = setAttribute(
                        `${tag}>`,
                        'loTypeId',
                        toEscapedText(uniqueId),
                    );
                    if (category !== null) {
                        set = setAttribute(set, 'loCatId', category);
                    }
                    return set.slice(0, -1);
                }),
            };
        });
    const takenIds = new Set([
        ...model.points.map((point) => {
            return point.modelId;
        }),
        ...model.connections.map((connection) => {
            return connection.modelId;
        }),
    ]);
    // the old layout's shapes are not this one's: none kept
    const presWrite = genSmartArtPresXml(
        {
            points: semanticPoints,
            connections: model.connections.filter((connection) => {
                return !PRESENTATION_LINK_TYPE_SET.has(connection.type);
            }),
        },
        source.layoutXml,
        { points: [], connections: [] },
        takenIds,
    );
    if (presWrite === null) {
        return {
            reason:
                'that layout could not be drawn over its boxes, so nothing ' +
                'changed.',
        };
    }
    return {
        dataXml: writeDataLists(dataXml, presWrite),
        labelList: presWrite.labelList,
    };
}

/** The data part without its link to the drawing kept beside it. */
export function removeSmartArtDrawingLink(dataXml: string) {
    return dataXml
        .replace(
            /<a:ext\b[^>]*>(?:(?!<\/a:ext>)[\s\S])*?<dsp:dataModelExt\b[\s\S]*?<\/a:ext>/g,
            '',
        )
        .replace(/<dgm:extLst>\s*<\/dgm:extLst>|<dgm:extLst\/>/g, '');
}

/** The style labels `nameList` asks for that a part lacks, from another. */
export function copyMissingStyleLabels(
    xml: string | null,
    sourceXml: string | null,
    closeTag: string,
    nameList: string[],
) {
    if (xml === null || sourceXml === null || !xml.includes(closeTag)) {
        return xml;
    }
    const added = nameList
        .filter((name) => {
            return !xml.includes(`<dgm:styleLbl name="${name}"`);
        })
        .map((name) => {
            const pattern = new RegExp(
                `<dgm:styleLbl name="${name.replace(/[^\w]/g, '')}"[\\s\\S]*?</dgm:styleLbl>`,
            );
            return pattern.exec(sourceXml)?.[0] ?? '';
        })
        .join('');
    return added === '' ? xml : xml.replace(closeTag, `${added}${closeTag}`);
}

/** A SmartArt's boxes in order, each with the words of the box it is under. */
export function listSmartArtBoxWords(dataXml: string) {
    const model = readDiagramModel(dataXml);
    if (model === null) {
        return [];
    }
    return listBoxWords(
        model,
        new Map(
            model.points.map((point) => {
                return [point.modelId, point];
            }),
        ),
    );
}

/** The boxes said back: "Read", "Pray" (under "Read"). */
export function describeSmartArtBoxWords(
    boxes: { words: string; under: string | null }[],
) {
    return boxes
        .map((box) => {
            return (
                JSON.stringify(box.words) +
                (box.under === null
                    ? ''
                    : ` (under ${JSON.stringify(box.under)})`)
            );
        })
        .join(', ');
}
