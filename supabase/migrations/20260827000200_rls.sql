-- =====================================================================
-- RLS ポリシー（データ仕様書 §6）
-- 方針: anon（生徒）はテーブルに一切アクセスできない。
--       生徒データの取得は Edge Function shared-set のみが行う。
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.material_sets enable row level security;
alter table public.cards enable row level security;

-- profiles: 本人のみ
drop policy if exists p_profiles on public.profiles;
create policy p_profiles on public.profiles
  for all
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- material_sets: 所有者のみ
drop policy if exists p_sets on public.material_sets;
create policy p_sets on public.material_sets
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- cards: 親セットの所有者のみ
drop policy if exists p_cards on public.cards;
create policy p_cards on public.cards
  for all
  to authenticated
  using (
    exists (
      select 1 from public.material_sets s
      where s.id = cards.set_id and s.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.material_sets s
      where s.id = cards.set_id and s.owner_id = (select auth.uid())
    )
  );
