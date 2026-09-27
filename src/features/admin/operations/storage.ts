import type { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * Clean up all objects under a given prefix in a Supabase Storage bucket.
 * Implements pagination with limit 100 to handle large object sets.
 * Idempotent: missing buckets or prefixes are treated as already clean.
 * Throws on genuine API errors or deletion failures so callers can abort safely.
 */
export async function cleanupStoragePrefix(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  bucket: string,
  prefix: string,
): Promise<void> {
  const limit = 100;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: fileList, error: listError } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit, offset, sortBy: { column: 'name', order: 'asc' } });

    if (listError) {
      const msg = listError.message?.toLowerCase() || '';
      const status = (listError as { status?: number; statusCode?: string | number })?.status || (listError as { status?: number; statusCode?: string | number })?.statusCode;
      // If folder or bucket doesn't exist, it is already clean (idempotency)
      if (status === 404 || status === '404' || msg.includes('not found') || msg.includes('does not exist')) {
        return;
      }
      throw new Error(`Lỗi liệt kê tệp tin trong bucket ${bucket} (prefix: ${prefix}): ${listError.message}`);
    }

    if (!fileList || fileList.length === 0) {
      break;
    }

    const filesToRemove = fileList
      .filter(f => f.name && f.id)
      .map(f => `${prefix}/${f.name}`);

    if (filesToRemove.length > 0) {
      const { error: removeError } = await supabase.storage
        .from(bucket)
        .remove(filesToRemove);

      if (removeError) {
        throw new Error(`Lỗi xóa tệp tin trong bucket ${bucket}: ${removeError.message}`);
      }
    }

    if (fileList.length < limit) {
      hasMore = false;
    } else {
      // Storage files shift down when deleted; only advance offset by files that were not deleted
      const nonRemovedCount = fileList.length - filesToRemove.length;
      offset += nonRemovedCount;
    }
  }
}

/**
 * Clean up both 'audio' and 'banners' storage buckets for a list of event prefixes.
 * If any prefix fails, throws immediately to prevent unsafe database deletions.
 */
export async function cleanupAllEventStorage(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  prefixes: string[],
): Promise<void> {
  for (const prefix of prefixes) {
    await cleanupStoragePrefix(supabase, 'audio', prefix);
    await cleanupStoragePrefix(supabase, 'banners', prefix);
  }
}
