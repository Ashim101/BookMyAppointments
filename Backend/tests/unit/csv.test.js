import { describe, expect, it } from 'vitest';
import { csvLine, escapeCsv } from '../../src/utils/csv.js';

describe('escapeCsv', () => {
  it('leaves plain values alone and renders empties as blank', () => {
    expect(escapeCsv('hello')).toBe('hello');
    expect(escapeCsv(42)).toBe('42');
    expect(escapeCsv(0)).toBe('0');
    expect(escapeCsv(null)).toBe('');
    expect(escapeCsv(undefined)).toBe('');
  });

  it('quotes commas, quotes and newlines, doubling embedded quotes', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"');
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsv('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsv('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it.each(['=SUM(A1)', '+1', '-1', '@cmd', '\t=1', '\r=1'])(
    'neutralises the formula prefix in %j',
    (value) => {
      expect(escapeCsv(value).replace(/^"/, '').startsWith("'")).toBe(true);
    },
  );

  it('prefixes then quotes values that are both formulas and need quoting', () => {
    expect(escapeCsv('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
  });

  it('does not treat a dash in the middle as a formula', () => {
    expect(escapeCsv('a-b')).toBe('a-b');
  });

  it('serialises dates as ISO strings', () => {
    expect(escapeCsv(new Date('2026-03-02T04:00:00.000Z'))).toBe('2026-03-02T04:00:00.000Z');
  });
});

describe('csvLine', () => {
  it('joins fields with commas and ends with CRLF', () => {
    expect(csvLine(['a', 'b,c', 3])).toBe('a,"b,c",3\r\n');
  });
});
