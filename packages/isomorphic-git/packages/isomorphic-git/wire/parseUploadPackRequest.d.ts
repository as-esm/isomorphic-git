export function parseUploadPackRequest(stream: any): Promise<{
    capabilities: any;
    wants: any[];
    haves: any[];
    shallows: any[];
    depth: number | undefined;
    since: number | undefined;
    exclude: any[];
    relative: boolean;
    done: boolean;
}>;
