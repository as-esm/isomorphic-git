import { getIterator } from './getIterator.ts'

// inspired by 'gartal' but lighter-weight and more battle-tested.
export class StreamReader {
  private stream: AsyncIterator<Buffer | Uint8Array>
  private buffer: Buffer | null = null
  private cursor = 0
  private undoCursor = 0
  private started = false
  private _ended = false
  private _discardedBytes = 0

  constructor(stream: AsyncIterable<Buffer | Uint8Array> | ReadableStream) {
    // TODO: fix usage in bundlers before Buffer dependency is removed #1855
    if (typeof Buffer === 'undefined') {
      throw new Error('Missing Buffer dependency')
    }
    this.stream = getIterator(stream)
  }

  eof(): boolean {
    return this._ended && this.buffer !== null && this.cursor === this.buffer.length
  }

  tell(): number {
    return this._discardedBytes + this.cursor
  }

  async byte(): Promise<number | undefined> {
    if (this.eof()) return
    if (!this.started) await this._init()
    if (this.buffer && this.cursor === this.buffer.length) {
      await this._loadnext()
      if (this._ended) return
    }
    this._moveCursor(1)
    return this.buffer?.[this.undoCursor]
  }

  async chunk(): Promise<Buffer | undefined> {
    if (this.eof()) return
    if (!this.started) await this._init()
    if (this.buffer && this.cursor === this.buffer.length) {
      await this._loadnext()
      if (this._ended) return
    }
    this._moveCursor(this.buffer?.length ?? 0)
    return this.buffer?.slice(this.undoCursor, this.cursor)
  }

  async read(n: number): Promise<Buffer | undefined> {
    if (this.eof()) return
    if (!this.started) await this._init()
    if (this.buffer && this.cursor + n > this.buffer.length) {
      this._trim()
      await this._accumulate(n)
    }
    this._moveCursor(n)
    return this.buffer?.slice(this.undoCursor, this.cursor)
  }

  async skip(n: number): Promise<void> {
    if (this.eof()) return
    if (!this.started) await this._init()
    if (this.buffer && this.cursor + n > this.buffer.length) {
      this._trim()
      await this._accumulate(n)
    }
    this._moveCursor(n)
  }

  async undo(): Promise<void> {
    this.cursor = this.undoCursor
  }

  private async _next(): Promise<Buffer> {
    this.started = true
    const { done, value } = await this.stream.next()
    if (done) {
      this._ended = true
      if (!value) return Buffer.alloc(0)
    }
    if (value) {
      return Buffer.isBuffer(value) ? value : Buffer.from(value)
    }
    return Buffer.alloc(0)
  }

  private _trim(): void {
    // Throw away parts of the buffer we don't need anymore
    // assert(this.cursor <= this.buffer.length)
    if (this.buffer) {
      this.buffer = this.buffer.slice(this.undoCursor)
      this.cursor -= this.undoCursor
      this._discardedBytes += this.undoCursor
      this.undoCursor = 0
    }
  }

  private _moveCursor(n: number): void {
    this.undoCursor = this.cursor
    this.cursor += n
    if (this.buffer && this.cursor > this.buffer.length) {
      this.cursor = this.buffer.length
    }
  }

  private async _accumulate(n: number): Promise<void> {
    if (this._ended) return
    // Expand the buffer until we have N bytes of data
    // or we've reached the end of the stream
    const buffers: Buffer[] = this.buffer ? [this.buffer] : []
    while (this.buffer && this.cursor + n > lengthBuffers(buffers)) {
      const nextbuffer = await this._next()
      if (this._ended) break
      buffers.push(nextbuffer)
    }
    this.buffer = Buffer.concat(buffers)
  }

  private async _loadnext(): Promise<void> {
    if (this.buffer) {
      this._discardedBytes += this.buffer.length
    }
    this.undoCursor = 0
    this.cursor = 0
    this.buffer = await this._next()
  }

  private async _init(): Promise<void> {
    this.buffer = await this._next()
  }
}

// This helper function helps us postpone concatenating buffers, which
// would create intermediate buffer objects,
const lengthBuffers = (buffers: Buffer[]): number => {
  return buffers.reduce((acc, buffer) => acc + buffer.length, 0)
}

