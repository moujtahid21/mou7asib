// A small RFC4180-shaped CSV parser (quoted fields, embedded commas/newlines, doubled-quote
// escaping, CRLF/LF, optional BOM) — hand-written rather than pulling in a dependency: the
// historical-journal-import use case (lib/journalImport.ts) only needs correct field
// splitting, not encoding detection or streaming, so this is small enough to own directly
// and review (CLAUDE.md §4 — new dependencies are supply-chain surface, especially on the
// import/ledger path).

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string): ParsedCsv {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let sawAnyFieldInRow = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
    sawAnyFieldInRow = false;
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else if (ch !== undefined) {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      sawAnyFieldInRow = true;
    } else if (ch === ",") {
      sawAnyFieldInRow = true;
      pushField();
    } else if (ch === "\r") {
      continue;
    } else if (ch === "\n") {
      if (sawAnyFieldInRow || field.length > 0) {
        pushRow();
      }
    } else if (ch !== undefined) {
      sawAnyFieldInRow = true;
      field += ch;
    }
  }
  if (sawAnyFieldInRow || field.length > 0) {
    pushRow();
  }

  const nonBlank = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  const headerRow = nonBlank[0];
  if (headerRow === undefined) {
    return { headers: [], rows: [] };
  }
  return { headers: headerRow.map((h) => h.trim()), rows: nonBlank.slice(1) };
}
