export function mergeFile({ branches, contents }: {
    branches: any;
    contents: any;
}): {
    cleanMerge: boolean;
    mergedText: string;
};
