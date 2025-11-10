/**
 * Determine whether a file is binary (and therefore not worth trying to merge automatically)
 *
 * @param {Uint8Array} buffer
 *
 * If it looks incredibly simple / naive to you, compare it with the original:
 *
 * // xdiff-interface.c
 *
 * #define FIRST_FEW_BYTES 8000
 * int buffer_is_binary(const char *ptr, unsigned long size)
 * {
 *  if (FIRST_FEW_BYTES < size)
 *   size = FIRST_FEW_BYTES;
 *  return !!memchr(ptr, 0, size);
 * }
 *
 * Yup, that's how git does it. We could try to be smarter
 */
export function isBinary(buffer: Uint8Array): boolean;
