export class FIFO {
    _queue: any[];
    write(chunk: any): void;
    _waiting: ((value: any) => void) | null | undefined;
    end(): void;
    _ended: boolean | undefined;
    destroy(err: any): void;
    error: any;
    next(): Promise<any>;
}
