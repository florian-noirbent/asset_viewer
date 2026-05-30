export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let index = 0;
  let inQuotedCell = false;

  while (index < csv.length) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (inQuotedCell) {
      if (character === '"' && nextCharacter === '"') {
        cell += '"';
        index += 2;
        continue;
      }

      if (character === '"') {
        inQuotedCell = false;
        index += 1;
        continue;
      }

      cell += character;
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotedCell = true;
      index += 1;
      continue;
    }

    if (character === ",") {
      row.push(cell);
      cell = "";
      index += 1;
      continue;
    }

    if (character === "\r" || character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";

      if (character === "\r" && nextCharacter === "\n") {
        index += 2;
      } else {
        index += 1;
      }

      continue;
    }

    cell += character;
    index += 1;
  }

  if (cell.length > 0 || row.length > 0 || csv.endsWith(",")) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
