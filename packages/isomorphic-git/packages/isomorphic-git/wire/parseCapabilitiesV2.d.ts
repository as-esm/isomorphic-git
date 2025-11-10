/**
 * @param {function} read
 */
export function parseCapabilitiesV2(read: Function): Promise<{
    protocolVersion: number;
    capabilities2: {
        [x: string]: string | true;
    };
}>;
