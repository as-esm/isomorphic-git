export function fromValue(value: any): {
    next(): Promise<{
        done: boolean;
        value: any;
    }>;
    return(): {};
    [Symbol.asyncIterator](): /*elided*/ any;
};
