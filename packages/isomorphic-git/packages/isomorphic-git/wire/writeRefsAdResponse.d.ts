export function writeRefsAdResponse({ capabilities, refs, symrefs }: {
    capabilities: any;
    refs: any;
    symrefs: any;
}): Promise<Buffer<ArrayBuffer>[]>;
