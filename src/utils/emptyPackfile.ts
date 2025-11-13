// TODO: make a function that just returns obCount. then emptyPackfile = () => sizePack(pack) === 0
export function emptyPackfile(pack: Buffer | Uint8Array): boolean {
  const pheader = '5041434b'
  const version = '00000002'
  const obCount = '00000000'
  const header = pheader + version + obCount
  const packBuffer = Buffer.isBuffer(pack) ? pack : Buffer.from(pack)
  return packBuffer.slice(0, 12).toString('hex') === header
}

