// This is straight from parse_unit_factor in config.c of canonical git
const num = (val: string | number): number => {
  if (typeof val === 'number') {
    return val
  }

  const lowerVal = val.toLowerCase()
  let n = parseInt(lowerVal, 10)
  if (lowerVal.endsWith('k')) n *= 1024
  if (lowerVal.endsWith('m')) n *= 1024 * 1024
  if (lowerVal.endsWith('g')) n *= 1024 * 1024 * 1024
  return n
}

// This is straight from git_parse_maybe_bool_text in config.c of canonical git
const bool = (val: string | boolean): boolean => {
  if (typeof val === 'boolean') {
    return val
  }

  const trimmed = val.trim().toLowerCase()
  if (trimmed === 'true' || trimmed === 'yes' || trimmed === 'on') return true
  if (trimmed === 'false' || trimmed === 'no' || trimmed === 'off') return false
  throw Error(
    `Expected 'true', 'false', 'yes', 'no', 'on', or 'off', but got ${val}`
  )
}

const schema: Record<string, Record<string, (val: string | number | boolean) => unknown>> = {
  core: {
    filemode: bool,
    bare: bool,
    logallrefupdates: bool,
    symlinks: bool,
    ignorecase: bool,
    bigFileThreshold: num,
  },
}

// https://git-scm.com/docs/git-config#_syntax

// section starts with [ and ends with ]
// section is alphanumeric (ASCII) with - and .
// section is case insensitive
// subsection is optional
// subsection is specified after section and one or more spaces
// subsection is specified between double quotes
const SECTION_LINE_REGEX = /^\[([A-Za-z0-9-.]+)(?: "(.*)")?\]$/
const SECTION_REGEX = /^[A-Za-z0-9-.]+$/

// variable lines contain a name, and equal sign and then a value
// variable lines can also only contain a name (the implicit value is a boolean true)
// variable name is alphanumeric (ASCII) with -
// variable name starts with an alphabetic character
// variable name is case insensitive
const VARIABLE_LINE_REGEX = /^([A-Za-z][A-Za-z-]*)(?: *= *(.*))?$/
const VARIABLE_NAME_REGEX = /^[A-Za-z][A-Za-z-]*$/

// Comments start with either # or ; and extend to the end of line
const VARIABLE_VALUE_COMMENT_REGEX = /^(.*?)( *[#;].*)$/

type ConfigEntry = {
  line: string
  isSection: boolean
  section: string | null
  subsection: string | null
  name: string | null
  value: string | null
  path: string
  modified?: boolean
}

type ConfigObject = {
  parsedConfig: ConfigEntry[]
  get: (path: string, getall?: boolean) => unknown
  getall: (path: string) => unknown[]
  getSubsections: (section: string) => (string | null)[]
  set: (path: string, value: unknown, append?: boolean) => void
  deleteSection: (section: string, subsection?: string | null) => void
}

const extractSectionLine = (line: string): [string, string | null] | null => {
  const matches = SECTION_LINE_REGEX.exec(line)
  if (matches != null) {
    const [, section, subsection] = matches
    return [section, subsection ?? null]
  }
  return null
}

const extractVariableLine = (line: string): [string, string] | null => {
  const matches = VARIABLE_LINE_REGEX.exec(line)
  if (matches != null) {
    const [, name, rawValue = 'true'] = matches
    const valueWithoutComments = removeComments(rawValue)
    const valueWithoutQuotes = removeQuotes(valueWithoutComments)
    return [name, valueWithoutQuotes]
  }
  return null
}

const removeComments = (rawValue: string): string => {
  const commentMatches = VARIABLE_VALUE_COMMENT_REGEX.exec(rawValue)
  if (commentMatches == null) {
    return rawValue
  }
  const [, valueWithoutComment, comment] = commentMatches
  // if odd number of quotes before and after comment => comment is escaped
  if (
    hasOddNumberOfQuotes(valueWithoutComment) &&
    hasOddNumberOfQuotes(comment)
  ) {
    return `${valueWithoutComment}${comment}`
  }
  return valueWithoutComment
}

const hasOddNumberOfQuotes = (text: string): boolean => {
  const numberOfQuotes = (text.match(/(?:^|[^\\])"/g) || []).length
  return numberOfQuotes % 2 !== 0
}

const removeQuotes = (text: string): string => {
  return text.split('').reduce((newText, c, idx, textArray) => {
    const isQuote = c === '"' && textArray[idx - 1] !== '\\'
    const isEscapeForQuote = c === '\\' && textArray[idx + 1] === '"'
    if (isQuote || isEscapeForQuote) {
      return newText
    }
    return newText + c
  }, '')
}

const lower = (text: string | null): string | null => {
  return text != null ? text.toLowerCase() : null
}

const getPath = (section: string | null, subsection: string | null, name: string | null): string => {
  return [lower(section), subsection, lower(name)]
    .filter(a => a != null)
    .join('.')
}

type NormalizedPath = {
  section: string | null
  subsection: string | null | undefined
  name: string | null | undefined
  path: string
  sectionPath: string
  isSection: boolean
}

const normalizePath = (path: string): NormalizedPath => {
  const pathSegments = path.split('.')
  const section = pathSegments.shift() ?? null
  const name = pathSegments.pop() ?? null
  const subsection = pathSegments.length > 0 ? pathSegments.join('.') : undefined

  return {
    section,
    subsection,
    name,
    path: getPath(section, subsection ?? null, name ?? null),
    sectionPath: getPath(section, subsection ?? null, null),
    isSection: !!section,
  }
}

const findLastIndex = <T>(array: T[], callback: (item: T) => boolean): number => {
  return array.reduce((lastIndex, item, index) => {
    return callback(item) ? index : lastIndex
  }, -1)
}

/**
 * Parses a Git config file buffer into a config object
 */
export const parse = (buffer: Buffer | string): ConfigObject => {
  const text = typeof buffer === 'string' ? buffer : buffer.toString('utf8')
  let section: string | null = null
  let subsection: string | null = null
  const parsedConfig: ConfigEntry[] = text
    ? text.split('\n').map(line => {
        let name: string | null = null
        let value: string | null = null

        const trimmedLine = line.trim()
        const extractedSection = extractSectionLine(trimmedLine)
        const isSection = extractedSection != null
        if (isSection) {
          ;[section, subsection] = extractedSection
        } else {
          const extractedVariable = extractVariableLine(trimmedLine)
          const isVariable = extractedVariable != null
          if (isVariable) {
            ;[name, value] = extractedVariable
          }
        }

        const path = getPath(section, subsection, name)
        return { line, isSection, section, subsection, name, value, path }
      })
    : []

  return {
    parsedConfig,
    get(path: string, getall = false): unknown {
      const normalizedPath = normalizePath(path).path
      const allValues = parsedConfig
        .filter(config => config.path === normalizedPath)
        .map(({ section, name, value }) => {
          const fn = section && schema[section] && name ? schema[section][name] : undefined
          return fn ? fn(value ?? '') : value
        })
      return getall ? allValues : allValues.pop()
    },
    getall(path: string): unknown[] {
      return this.get(path, true) as unknown[]
    },
    getSubsections(section: string): (string | null)[] {
      return parsedConfig
        .filter(config => config.isSection && config.section === section)
        .map(config => config.subsection)
    },
    set(path: string, value: unknown, append = false): void {
      const {
        section,
        subsection,
        name,
        path: normalizedPath,
        sectionPath,
        isSection,
      } = normalizePath(path)

      const configIndex = findLastIndex(
        parsedConfig,
        config => config.path === normalizedPath
      )
      if (value == null) {
        if (configIndex !== -1) {
          parsedConfig.splice(configIndex, 1)
        }
      } else {
        if (configIndex !== -1) {
          const config = parsedConfig[configIndex]
          const modifiedConfig: ConfigEntry = { ...config, name: name ?? null, value: String(value), modified: true }
          if (append) {
            parsedConfig.splice(configIndex + 1, 0, modifiedConfig)
          } else {
            parsedConfig[configIndex] = modifiedConfig
          }
        } else {
          const sectionIndex = parsedConfig.findIndex(
            config => config.path === sectionPath
          )
          const newConfig: ConfigEntry = {
            section,
            subsection: subsection ?? null,
            name: name ?? null,
            value: String(value),
            modified: true,
            path: normalizedPath,
            isSection: false,
            line: '',
          }
          if (section && SECTION_REGEX.test(section) && name && VARIABLE_NAME_REGEX.test(name)) {
            if (sectionIndex >= 0) {
              // Reuse existing section
              parsedConfig.splice(sectionIndex + 1, 0, newConfig)
            } else {
              // Add a new section
              const newSection: ConfigEntry = {
                isSection: true,
                section,
                subsection: subsection ?? null,
                modified: true,
                path: sectionPath,
                name: null,
                value: null,
                line: '',
              }
              parsedConfig.push(newSection, newConfig)
            }
          }
        }
      }
    },
    deleteSection(section: string, subsection?: string | null): void {
      const filtered = parsedConfig.filter(
        config =>
          !(config.section === section && config.subsection === subsection)
      )
      parsedConfig.splice(0, parsedConfig.length, ...filtered)
    },
  }
}

/**
 * Serializes a config object back to its file format
 */
export const serialize = (config: ConfigObject): Buffer => {
  const text = config.parsedConfig
    .map(({ line, section, subsection, name, value, modified = false }) => {
      if (!modified) {
        return line
      }
      if (name != null && value != null) {
        if (typeof value === 'string' && /[#;]/.test(value)) {
          // A `#` or `;` symbol denotes a comment, so we have to wrap it in double quotes
          return `\t${name} = "${value}"`
        }
        return `\t${name} = ${value}`
      }
      if (subsection != null) {
        return `[${section} "${subsection}"]`
      }
      return `[${section}]`
    })
    .join('\n')
  return Buffer.from(text, 'utf8')
}

