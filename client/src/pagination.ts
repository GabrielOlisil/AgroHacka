export const PAGE_SIZES = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const size = PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(totalPages, Math.max(1, Math.floor(page) || 1));
  const start = (current - 1) * size;
  const pageItems = items.slice(start, start + size);
  return {
    items: pageItems,
    page: current,
    totalPages,
    from: total ? start + 1 : 0,
    to: start + pageItems.length,
    total,
  };
}
