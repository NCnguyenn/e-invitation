export function selectHostPage<T extends { email: string }>(
  hosts: T[],
  search: string,
  page: number,
  pageSize: number,
): { hosts: T[]; totalCount: number } {
  const query = search.trim().toLowerCase();
  const filtered = query ? hosts.filter((host) => host.email.toLowerCase().includes(query)) : hosts;
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeSize = Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 50;
  const from = (safePage - 1) * safeSize;
  return {
    hosts: filtered.slice(from, from + safeSize),
    totalCount: filtered.length,
  };
}
