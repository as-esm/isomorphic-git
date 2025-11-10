export function parseRefsAdResponse(stream: any, { service }: {
    service: any;
}): Promise<{
    protocolVersion: number;
    capabilities2: {
        [x: string]: string | true;
    };
} | {
    capabilities: Set<any>;
    refs: Map<any, any>;
    symrefs: Map<any, any>;
    protocolVersion?: undefined;
} | {
    protocolVersion: number;
    capabilities: Set<any>;
    refs: Map<any, any>;
    symrefs: Map<any, any>;
}>;
