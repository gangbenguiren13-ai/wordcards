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
