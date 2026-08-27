-- ===================================================================
-- WordCards セットアップ用SQL（このファイル全体をコピーして、
-- Supabase の SQL Editor に貼り付けて Run を押してください）
-- 何度実行しても壊れないように書いてあります。
-- ===================================================================


-- ############ 20260827000100_init_schema.sql ############

-- =====================================================================
-- WordCards 初期スキーマ（データ仕様書 §2）
-- =====================================================================

-- 更新時刻の自動更新トリガ関数
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles: 教師のプロフィール（auth.users と 1:1）
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- material_sets: 教材セット
-- ---------------------------------------------------------------------
create table if not exists public.material_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  mode text not null check (mode in ('elementary', 'junior')),
  default_display text not null default 'image_only'
    check (default_display in (
      'word_image', 'word_only', 'image_only',
      'front_image_back_word', 'front_word_back_image'
    )),
  audio_enabled boolean not null default false,
  show_word_on_answer boolean not null default false,
  games_config jsonb not null default '{}'::jsonb,
  share_token text unique,
  share_enabled boolean not null default false,
  school_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists material_sets_owner_idx
  on public.material_sets (owner_id) where deleted_at is null;
create index if not exists material_sets_share_idx
  on public.material_sets (share_token) where share_enabled = true;

drop trigger if exists material_sets_updated_at on public.material_sets;
create trigger material_sets_updated_at
  before update on public.material_sets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- cards: カード
-- ---------------------------------------------------------------------
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.material_sets(id) on delete cascade,
  word text not null check (char_length(word) between 1 and 50),
  image_path text,
  pair_image_path text,
  audio_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_set_order_idx on public.cards (set_id, sort_order);

drop trigger if exists cards_updated_at on public.cards;
create trigger cards_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- サインアップ時に profiles 行を自動作成
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ############ 20260827000200_rls.sql ############

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

-- ############ 20260827000300_storage.sql ############

-- =====================================================================
-- Storage バケットとポリシー（データ仕様書 §4, §6）
-- 方針: バケットは非公開。読み取りポリシーは付与しない。
--       画像・音声は署名付きURLでのみ配信される（恒久的な直リンクを作らない）。
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do update set public = false;

-- 書き込み系: ログイン済み、かつパスの第1セグメントが自分のUIDのときのみ
drop policy if exists media_insert_own on storage.objects;
create policy media_insert_own on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists media_update_own on storage.objects;
create policy media_update_own on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists media_delete_own on storage.objects;
create policy media_delete_own on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 読み取り: 所有者が自分のファイルの署名付きURLを発行するために必要。
-- anon には付与しないため、生徒側は shared-set 関数（service_role）経由のみ。
drop policy if exists media_select_own on storage.objects;
create policy media_select_own on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ############ 20260827000400_share_rpc.sql ############

-- =====================================================================
-- 共有トークンの発行・再発行（サーバー側で生成し、クライアントに任せない）
-- =====================================================================

create or replace function public.issue_share_token(p_set_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner uuid;
  v_token text;
begin
  select owner_id into v_owner
  from public.material_sets
  where id = p_set_id and deleted_at is null;

  if v_owner is null then
    raise exception 'セットが見つかりません';
  end if;
  if v_owner <> auth.uid() then
    raise exception '権限がありません';
  end if;

  -- URLセーフな21文字（nanoid相当の強度）
  v_token := replace(replace(encode(extensions.gen_random_bytes(16), 'base64'), '+', '-'), '/', '_');
  v_token := left(replace(v_token, '=', ''), 21);

  update public.material_sets
  set share_token = v_token, share_enabled = true
  where id = p_set_id;

  return v_token;
end;
$$;

revoke all on function public.issue_share_token(uuid) from public;
grant execute on function public.issue_share_token(uuid) to authenticated;

-- ############ 20260827000500_rate_limit.sql ############

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
