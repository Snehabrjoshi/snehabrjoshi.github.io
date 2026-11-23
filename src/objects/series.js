// Scale: 1 world unit ≈ 225 mm, so a 1.0-unit book is a 225 mm hardback.

export const SERIES = {
  width: 0.7,
  height: 1.0,
  board: 0.014,
  overhang: 0.012,
  foil: '#d6b56e',
  minThickness: 28 / 225,
  maxThickness: 45 / 225,
};

const textLength = (book) =>
  book.html.replace(/<[^>]+>/g, '').length +
  book.lead.length +
  (book.skillGroups ?? [])
    .flatMap((g) => [g.heading, ...g.items.flatMap((i) => (i.name ? [i.name, ...i.libs] : [i]))])
    .join('').length +
  (book.cards ?? [])
    .flatMap((c) => [
      c.kicker,
      c.title,
      c.meta,
      c.summary,
      ...(c.details ?? []),
      ...(c.bullets ?? []),
    ])
    .join('').length;

// Thickness follows the amount of content, so the thickest spine is the longest read.
export function thicknessesFor(books) {
  const lengths = books.map(textLength);
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  return lengths.map(
    (n) =>
      SERIES.minThickness +
      ((n - min) / Math.max(1, max - min)) * (SERIES.maxThickness - SERIES.minThickness),
  );
}
