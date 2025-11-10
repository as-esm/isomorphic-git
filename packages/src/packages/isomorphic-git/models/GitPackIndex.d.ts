export class GitPackIndex {
    static fromIdx({ idx, getExternalRefDelta }: {
        idx: any;
        getExternalRefDelta: any;
    }): Promise<GitPackIndex | undefined>;
    static fromPack({ pack, getExternalRefDelta, onProgress }: {
        pack: any;
        getExternalRefDelta: any;
        onProgress: any;
    }): Promise<GitPackIndex>;
    constructor(stuff: any);
    offsetCache: {};
    toBuffer(): Promise<Buffer<ArrayBuffer>>;
    load({ pack }: {
        pack: any;
    }): Promise<void>;
    pack: any;
    unload(): Promise<void>;
    read({ oid }: {
        oid: any;
    }): any;
    readSlice({ start }: {
        start: any;
    }): any;
}
