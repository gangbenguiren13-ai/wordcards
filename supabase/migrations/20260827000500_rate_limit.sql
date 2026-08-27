-- =====================================================================
-- Edge Function 用の簡易レート制限
-- 関数インスタンスをまたいで効くよう、メモリではなくテーブルで数える。
-- service_role からのみ読み書きする（RLSは有効のままポリシーを付けない）。
-- =====================================================================

create table if not exists public.rate_limits (
  bucket text not null,          -- 例: 'signup:203.0.113.9'
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);

alter table public.rate_limits enable row level security;
-- ポリシーを作らない = anon/authenticated からは一切アクセス不可

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

/**
 * 1ウィンドウあたりの実行回数を加算し、上限を超えていたら false を返す。
 * p_window_seconds 単位の固定ウィンドウ方式。
 */
create or replace function public.bump_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits (bucket, window_start, count)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;

  -- 古い記録の掃除（確率的に実行してコストを抑える）
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.bump_rate_limit(text, integer, integer) from public;
