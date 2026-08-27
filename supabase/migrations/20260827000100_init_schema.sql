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
