import { LoadingProgress } from '@/components/LoadingProgress'
export function Spinner({ label = '教材を よみこみちゅう' }: { label?: string }) {
  return <LoadingProgress label={label} />
}
