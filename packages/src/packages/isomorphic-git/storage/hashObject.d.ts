export function hashObject({ type, object, format, oid, }: {
    type: any;
    object: any;
    format?: string | undefined;
    oid?: undefined;
}): Promise<{
    oid: undefined;
    object: any;
}>;
