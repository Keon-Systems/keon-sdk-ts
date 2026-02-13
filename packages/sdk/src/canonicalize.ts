/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) for Keon
 *
 * This is the TypeScript implementation of the Keon canonicalization standard,
 * matching the behavior of the C# KeonCanonicalJsonV1.cs implementation.
 *
 * Guarantees:
 * - Byte-identical output for identical inputs across platforms
 * - Unicode NFC normalization applied before canonicalization
 * - Properties sorted by UTF-16 code unit (lexicographic/ordinal)
 * - Deterministic number formatting
 * - No unnecessary escape sequences
 *
 * Version: 1.0.0
 * Spec: CANONICALIZATION_SPEC_V1_LOCKED.md + RFC 8785
 */

/**
 * Canonicalizes a value to canonical JSON bytes.
 *
 * @param value - Any JSON-serializable value
 * @returns Canonical JSON as Uint8Array (UTF-8 encoded)
 */
export function canonicalize(value: unknown): Uint8Array {
  const str = canonicalizeToString(value);
  return new TextEncoder().encode(str);
}

/**
 * Canonicalizes a value to a canonical JSON string.
 *
 * @param value - Any JSON-serializable value
 * @returns Canonical JSON string
 */
export function canonicalizeToString(value: unknown): string {
  return canonicalizeValue(value);
}

/**
 * Canonicalizes JSON string bytes to canonical form.
 *
 * @param jsonBytes - JSON as Uint8Array
 * @returns Canonical JSON as Uint8Array
 */
export function canonicalizeBytes(jsonBytes: Uint8Array): Uint8Array {
  const str = new TextDecoder().decode(jsonBytes);
  const parsed = JSON.parse(str);
  return canonicalize(parsed);
}

/**
 * Validates that bytes are already in canonical form.
 *
 * @param jsonBytes - JSON bytes to validate
 * @returns true if bytes are canonical
 */
export function validateIntegrity(jsonBytes: Uint8Array): boolean {
  try {
    const canonical = canonicalizeBytes(jsonBytes);
    if (jsonBytes.length !== canonical.length) return false;
    for (let i = 0; i < jsonBytes.length; i++) {
      if (jsonBytes[i] !== canonical[i]) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively canonicalizes a JSON value.
 */
function canonicalizeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'null';
  }

  const type = typeof value;

  switch (type) {
    case 'boolean':
      return value ? 'true' : 'false';

    case 'number':
      return canonicalizeNumber(value as number);

    case 'string':
      return canonicalizeString(value as string);

    case 'object':
      if (Array.isArray(value)) {
        return canonicalizeArray(value);
      }
      return canonicalizeObject(value as Record<string, unknown>);

    default:
      throw new Error(`Unsupported type: ${type}`);
  }
}

/**
 * Canonicalizes a string with NFC normalization and proper escaping.
 */
function canonicalizeString(str: string): string {
  // Apply Unicode NFC normalization
  const normalized = str.normalize('NFC');

  let result = '"';
  for (const char of normalized) {
    const code = char.charCodeAt(0);

    switch (char) {
      case '"':
        result += '\\"';
        break;
      case '\\':
        result += '\\\\';
        break;
      case '\b':
        result += '\\b';
        break;
      case '\f':
        result += '\\f';
        break;
      case '\n':
        result += '\\n';
        break;
      case '\r':
        result += '\\r';
        break;
      case '\t':
        result += '\\t';
        break;
      default:
        if (code < 0x20) {
          // Control characters: use \uXXXX
          result += '\\u' + code.toString(16).padStart(4, '0');
        } else {
          // RFC 8785: Non-control Unicode characters (U+0020 to U+10FFFF)
          // MUST be written as literal UTF-8, NOT escaped
          result += char;
        }
    }
  }
  result += '"';
  return result;
}

/**
 * Canonicalizes a number per RFC 8785.
 */
function canonicalizeNumber(num: number): string {
  // Handle special cases
  if (!Number.isFinite(num)) {
    throw new Error('NaN and Infinity are not valid JSON numbers');
  }

  // Normalize -0 to 0
  if (Object.is(num, -0)) {
    return '0';
  }

  // Check if it's an integer
  if (Number.isInteger(num) && Number.isSafeInteger(num)) {
    return num.toString();
  }

  // For decimals that are actually integers (e.g., 100.0)
  if (num === Math.trunc(num) && Math.abs(num) <= Number.MAX_SAFE_INTEGER) {
    return Math.trunc(num).toString();
  }

  // Format with minimal representation
  // JavaScript's toString() for numbers is already RFC 8785 compliant
  return num.toString();
}

/**
 * Canonicalizes an array (preserves order).
 */
function canonicalizeArray(arr: unknown[]): string {
  const elements = arr.map(canonicalizeValue);
  return '[' + elements.join(',') + ']';
}

/**
 * Canonicalizes an object (sorts keys by UTF-16 code unit order).
 */
function canonicalizeObject(obj: Record<string, unknown>): string {
  // Get keys and apply NFC normalization
  const keys = Object.keys(obj).map((k) => k.normalize('NFC'));

  // Sort by UTF-16 code unit order (JavaScript's default string comparison)
  // This matches StringComparer.Ordinal in .NET
  keys.sort((a, b) => {
    // Compare character by character using UTF-16 code units
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
      const aCode = a.charCodeAt(i);
      const bCode = b.charCodeAt(i);
      if (aCode !== bCode) {
        return aCode - bCode;
      }
    }
    return a.length - b.length;
  });

  const pairs = keys.map((key) => {
    // Find original key (pre-normalization) to get value
    const originalKey = Object.keys(obj).find((k) => k.normalize('NFC') === key);
    const value = obj[originalKey!];
    return canonicalizeString(key) + ':' + canonicalizeValue(value);
  });

  return '{' + pairs.join(',') + '}';
}
