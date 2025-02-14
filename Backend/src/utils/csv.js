const NEEDS_QUOTES = /[",\r\n]/;
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Escapes one CSV field, neutralising spreadsheet formula injection. */
export function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const csvLine = (values) => `${values.map(escapeCsv).join(',')}\r\n`;

/** Streams a Mongo cursor as CSV, honouring backpressure. */
export async function streamCsv(res, { filename, columns, cursor, toRow }) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.write(csvLine(columns));
  try {
    for await (const doc of cursor) {
      if (!res.write(csvLine(toRow(doc)))) await new Promise((resolve) => res.once('drain', resolve));
    }
  } finally {
    await cursor.close();
  }
  res.end();
}
