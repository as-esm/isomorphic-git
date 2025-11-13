type ParsedConfigEntry = {
  line: string
  comment?: boolean
  ref?: string
  oid?: string
  peeled?: string
}

export class GitPackedRefs {
  refs: Map<string, string>
  parsedConfig: ParsedConfigEntry[]

  constructor(text?: string | null) {
    this.refs = new Map()
    this.parsedConfig = []
    if (text) {
      let key: string | null = null
      this.parsedConfig = text
        .trim()
        .split('\n')
        .map(line => {
          if (/^\s*#/.test(line)) {
            return { line, comment: true }
          }
          const i = line.indexOf(' ')
          if (line.startsWith('^')) {
            // This is a oid for the commit associated with the annotated tag immediately preceding this line.
            // Trim off the '^'
            const value = line.slice(1)
            // The tagname^{} syntax is based on the output of `git show-ref --tags -d`
            if (key) {
              this.refs.set(key + '^{}', value)
            }
            return { line, ref: key || undefined, peeled: value }
          } else {
            // This is an oid followed by the ref name
            const value = line.slice(0, i)
            key = line.slice(i + 1)
            this.refs.set(key, value)
            return { line, ref: key, oid: value }
          }
        })
    }
  }

  static from(text?: string | null): GitPackedRefs {
    return new GitPackedRefs(text)
  }

  delete(ref: string): void {
    this.parsedConfig = this.parsedConfig.filter(entry => entry.ref !== ref)
    this.refs.delete(ref)
  }

  toString(): string {
    return this.parsedConfig.map(({ line }) => line).join('\n') + '\n'
  }
}

