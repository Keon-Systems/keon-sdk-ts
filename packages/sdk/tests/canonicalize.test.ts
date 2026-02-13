import { describe, it, expect } from 'vitest';
import {
  canonicalize,
  canonicalizeToString,
  canonicalizeBytes,
  validateIntegrity,
} from '../src/canonicalize';

describe('Canonicalization', () => {
  describe('Key Ordering (JCS-001)', () => {
    it('should sort keys by UTF-16 code unit order', () => {
      // Uppercase ASCII (0x41-0x5A) sorts before lowercase (0x61-0x7A)
      const input = {
        z_key: 3,
        a_key: 1,
        A_key: 0,
        m_key: 2,
      };

      const result = canonicalizeToString(input);
      expect(result).toBe('{"A_key":0,"a_key":1,"m_key":2,"z_key":3}');
    });
  });

  describe('Number Normalization (JCS-004)', () => {
    it('should format integers without decimal point', () => {
      expect(canonicalizeToString(42)).toBe('42');
    });

    it('should normalize integral floats to integers', () => {
      expect(canonicalizeToString(100.0)).toBe('100');
    });

    it('should normalize -0 to 0', () => {
      expect(canonicalizeToString(-0)).toBe('0');
    });

    it('should preserve decimal precision', () => {
      expect(canonicalizeToString(3.14159)).toBe('3.14159');
    });

    it('should format small decimals correctly', () => {
      expect(canonicalizeToString(0.001)).toBe('0.001');
    });

    it('should throw for NaN', () => {
      expect(() => canonicalizeToString(NaN)).toThrow();
    });

    it('should throw for Infinity', () => {
      expect(() => canonicalizeToString(Infinity)).toThrow();
    });
  });

  describe('String Escaping', () => {
    it('should escape quotes', () => {
      expect(canonicalizeToString('say "hi"')).toBe('"say \\"hi\\""');
    });

    it('should escape backslash', () => {
      expect(canonicalizeToString('path\\to')).toBe('"path\\\\to"');
    });

    it('should escape newline', () => {
      expect(canonicalizeToString('line1\nline2')).toBe('"line1\\nline2"');
    });

    it('should escape tab', () => {
      expect(canonicalizeToString('col1\tcol2')).toBe('"col1\\tcol2"');
    });

    it('should NOT escape non-control Unicode', () => {
      // RFC 8785: Non-control Unicode should be literal, not \uXXXX
      const result = canonicalizeToString('Hello');
      expect(result).toBe('"Hello"');
      // Should NOT contain \u00F6
      expect(result).not.toContain('\\u');
    });
  });

  describe('Null Handling (JCS-005)', () => {
    it('should output explicit null', () => {
      const input = {
        present_null: null,
        present_value: 'exists',
      };

      const result = canonicalizeToString(input);
      expect(result).toBe('{"present_null":null,"present_value":"exists"}');
    });
  });

  describe('Array Order', () => {
    it('should preserve array order (not sort)', () => {
      expect(canonicalizeToString([3, 1, 2])).toBe('[3,1,2]');
    });
  });

  describe('Whitespace Elimination', () => {
    it('should have no whitespace', () => {
      const input = {
        a: 1,
        b: {
          c: 2,
        },
      };

      const result = canonicalizeToString(input);
      expect(result).toBe('{"a":1,"b":{"c":2}}');
    });
  });

  describe('validateIntegrity', () => {
    it('should return true for canonical bytes', () => {
      const canonical = new TextEncoder().encode('{"A":1,"a":2}');
      expect(validateIntegrity(canonical)).toBe(true);
    });

    it('should return false for non-canonical whitespace', () => {
      const notCanonical = new TextEncoder().encode('{ "A": 1, "a": 2 }');
      expect(validateIntegrity(notCanonical)).toBe(false);
    });

    it('should return false for wrong key order', () => {
      const wrongOrder = new TextEncoder().encode('{"a":2,"A":1}');
      expect(validateIntegrity(wrongOrder)).toBe(false);
    });
  });

  describe('Round-trip invariant', () => {
    it('should not change under re-canonicalization', () => {
      const input = { z: 3, a: 1, m: 2 };

      const first = canonicalize(input);
      const second = canonicalizeBytes(first);

      expect(first).toEqual(second);
    });
  });

  describe('Cross-platform determinism', () => {
    it('should produce expected bytes for test vector', () => {
      // Test vector from evidence-pack-test-vectors-v1.json
      const input = {
        A_key: 0,
        a_key: 1,
        m_key: 2,
        z_key: 3,
      };

      const result = canonicalizeToString(input);
      expect(result).toBe('{"A_key":0,"a_key":1,"m_key":2,"z_key":3}');
    });
  });
});
