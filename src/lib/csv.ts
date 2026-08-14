// CSV writing for creator-facing exports.
//
// The point of these exports is the round trip: a creator downloads their
// rewards, edits them in a spreadsheet, and imports the file back. So the
// output has to be readable by our own importer, not merely by Excel.

/**
 * RFC 4180 field escaping: wrap in quotes when the value contains a comma,
 * a quote or a line break, and double any embedded quotes.
 *
 * Line breaks are flattened to a space rather than quoted. RFC 4180 permits
 * them inside quotes, but the rewards importer splits the file on newlines
 * before parsing fields, so a description containing one would be read as two
 * broken rows. Flattening loses the line break; quoting it would lose the row.
 */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const flattened = String(value).replace(/\r\n|\r|\n/g, " ");
  if (/[",]/.test(flattened)) {
    return `"${flattened.replace(/"/g, '""')}"`;
  }
  return flattened;
}

/** Build a CSV document from a header row and body rows. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  // Trailing newline: some spreadsheet tools drop the final row without it.
  return lines.join("\n") + "\n";
}

/**
 * Trigger a browser download.
 *
 * Prefixed with a BOM so Excel reads the file as UTF-8 — without it, a pound
 * sign or an accented character in a reward title arrives mojibaked. Our own
 * importer strips the BOM before parsing, so this doesn't cost the round trip.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Filesystem-safe slug for a download filename. */
export function csvFilename(base: string, suffix: string): string {
  const safe = (base || "campaign")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${safe || "campaign"}-${suffix}.csv`;
}
