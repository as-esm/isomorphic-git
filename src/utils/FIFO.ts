export class FIFO {
  private _queue: Buffer[] = []
  private _ended: boolean = false
  private _waiting: ((value: IteratorResult<Buffer>) => void) | null = null
  error?: Error

  constructor() {
    this._queue = []
  }

  write(chunk: Buffer): void {
    if (this._ended) {
      throw Error('You cannot write to a FIFO that has already been ended!')
    }
    if (this._waiting) {
      const resolve = this._waiting
      this._waiting = null
      resolve({ value: chunk })
    } else {
      this._queue.push(chunk)
    }
  }

  end(): void {
    this._ended = true
    if (this._waiting) {
      const resolve = this._waiting
      this._waiting = null
      resolve({ done: true } as IteratorResult<Buffer>)
    }
  }

  destroy(err: Error): void {
    this.error = err
    this.end()
  }

  async next(): Promise<IteratorResult<Buffer>> {
    if (this._queue.length > 0) {
      return { value: this._queue.shift()! }
    }
    if (this._ended) {
      return { done: true } as IteratorResult<Buffer>
    }
    if (this._waiting) {
      throw Error(
        'You cannot call read until the previous call to read has returned!'
      )
    }
    return new Promise<IteratorResult<Buffer>>(resolve => {
      this._waiting = resolve
    })
  }
}

