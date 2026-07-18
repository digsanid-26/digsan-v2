/** Convert an arbitrary string into a URL-safe slug. */
export function slugify(input: string, fallback = 'keluarga'): string {
  const slug = (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}
