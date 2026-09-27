type AuthUser = { id: string; email?: string | null };
type ListPage = (page: number, perPage: number) => Promise<{ users: AuthUser[]; error: { message: string } | null }>;

const DEFAULT_PER_PAGE = 200;
const DEFAULT_MAX_PAGES = 50;

export async function emailsById(
  listPage: ListPage,
  ids: string[],
  options?: { perPage?: number; maxPages?: number },
): Promise<Map<string, string>> {
  const wanted = new Set(ids.filter(Boolean));
  const emails = new Map<string, string>();
  if (wanted.size === 0) return emails;

  const perPage = options?.perPage ?? DEFAULT_PER_PAGE;
  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await listPage(page, perPage);
    if (result.error) throw new Error(result.error.message);

    for (const user of result.users) {
      if (!wanted.has(user.id)) continue;
      seen.add(user.id);
      if (typeof user.email === 'string' && user.email.trim()) {
        emails.set(user.id, user.email.trim());
      }
    }

    const unseen = [...wanted].filter((id) => !seen.has(id));
    if (unseen.length === 0) return emails;
    if (result.users.length < perPage) {
      throw new Error('Không đủ dữ liệu email cho các tài khoản được yêu cầu.');
    }
  }

  throw new Error('Không đủ trang auth để đối chiếu email.');
}
