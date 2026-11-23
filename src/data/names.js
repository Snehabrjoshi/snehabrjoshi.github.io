export const bookName = (book) =>
  book.name ?? book.title.charAt(0) + book.title.slice(1).toLowerCase();

// The file name a book's cover is saved under (scripts/fetch-covers.mjs).
export const coverSlug = (book) =>
  `${book.title}-${book.author}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
