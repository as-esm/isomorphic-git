export function posixifyPathBuffer(buffer: Buffer | Uint8Array): Buffer | Uint8Array {
  const bufferArray = buffer instanceof Uint8Array ? new Uint8Array(buffer) : Buffer.from(buffer)
  let idx: number
  while (~(idx = bufferArray.indexOf(92))) {
    bufferArray[idx] = 47
  }
  return bufferArray
}

