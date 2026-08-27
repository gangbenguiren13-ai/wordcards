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
