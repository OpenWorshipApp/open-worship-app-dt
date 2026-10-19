// Only what a TypeScript caller reads off the Open Lyric grammar: the fences'
// headers, which the chatbot's answer cleaner keeps a copy of (a test holds
// the two equal).

export declare const OPEN_LYRIC_FENCE_LIST: ReadonlyArray<{
  header: string;
  allowsNumbering: boolean;
  structureCode: string | null;
  bodyRule: string;
}>;
