// Lyrics text format (what the admin types):
//
//   [المقطع الأول]        ← optional section label in square brackets
//   first line
//   second line
//                          ← a blank line starts a new stanza
//   [الكورس]              ← sections whose label mentions the chorus are highlighted
//   chorus line
//
// parseLyrics() turns that into [{ label, isChorus, lines: [...] }, ...].
// It is shared by the attendee viewer and the admin live preview.

const LABEL_RE = /^\s*\[(.+)\]\s*$/;
const CHORUS_RE = /(كورس|كوراس|الكورس|اللازمة|chorus|refrain)/i;

export function parseLyrics(text) {
  const sections = [];
  let current = null;

  const startSection = (label = '') => {
    current = { label, isChorus: CHORUS_RE.test(label), lines: [] };
    sections.push(current);
  };

  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim();
    const label = line.match(LABEL_RE);
    if (label) {
      startSection(label[1].trim());
    } else if (line === '') {
      if (current && current.lines.length) current = null; // end of stanza
    } else {
      if (!current) startSection();
      current.lines.push(line);
    }
  }
  return sections.filter((s) => s.lines.length || s.label);
}
