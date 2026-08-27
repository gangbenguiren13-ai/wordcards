import { useQuery } from '@tanstack/react-query'
import { signedUrls } from '@/lib/mediaStore'
import { SIGNED_URL_TTL_SEC } from '@/lib/constants'

/**
 * 教師画面のサムネイル用に署名付きURLをまとめて取得する。
 * 有効期限より十分短い間隔でキャッシュを切らす。
 */
export function useSignedUrls(paths: (string | null)[]) {
  const list = paths.filter((p): p is string => Boolean(p)).sort()
  return useQuery({
    queryKey: ['signed-urls', list.join('|')],
    queryFn: () => signedUrls(list),
    enabled: list.length > 0,
    staleTime: (SIGNED_URL_TTL_SEC / 2) * 1000,
    gcTime: (SIGNED_URL_TTL_SEC / 2) * 1000,
  })
}
