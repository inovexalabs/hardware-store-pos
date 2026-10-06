-- =============================================================
--  Inovexa Labs — Hardware Shop Inventory & POS System
--  Migration 00008 : user / role management
-- =============================================================

-- Guard: nobody can silently change a user's role or activate state.
create or replace function public.guard_profile_changes()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'User ID cannot be changed.';
  end if;

  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active then
    if auth.uid() is null then
      return new;  -- system scripts / migrations (no signed-in user)
    end if;
    if not public.has_permission('users.manage') then
      raise exception 'Only the shop owner can change user roles or activate/deactivate users.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_changes on public.profiles;
create trigger guard_profile_changes
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- Change a user's role / active state / display name (owner only).
create or replace function public.update_user(
  p_user_id   uuid,
  p_role      text default null,
  p_is_active boolean default null,
  p_full_name text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_target   record;
  v_role     public.user_role;
  v_active   boolean;
  v_owners   integer;
begin
  perform public.require_permission('users.manage');

  select id, full_name, role, is_active into v_target
  from public.profiles where id = p_user_id for update;

  if not found then
    raise exception 'User not found.';
  end if;

  v_role   := coalesce(
    case when p_role in ('owner','manager','cashier','inventory')
         then p_role::public.user_role end,
    v_target.role);
  v_active := coalesce(p_is_active, v_target.is_active);

  if p_user_id = auth.uid() and (v_role <> 'owner' or not v_active) then
    raise exception 'You cannot change your own role or deactivate your own account.';
  end if;

  if (v_target.role = 'owner' and (v_role <> 'owner' or not v_active))
     or (v_target.role = 'owner' and v_role = 'owner' and not v_active) then
    select count(*) into v_owners
    from public.profiles
    where role = 'owner' and is_active and id <> p_user_id;

    if v_owners = 0 then
      raise exception 'At least one active owner must remain in the shop.';
    end if;
  end if;

  update public.profiles
     set role = v_role,
         is_active = v_active,
         full_name = coalesce(nullif(trim(coalesce(p_full_name, '')), ''), full_name)
   where id = p_user_id;

  return jsonb_build_object(
    'user_id', p_user_id,
    'role', v_role,
    'is_active', v_active
  );
end;
$$;

revoke execute on function public.update_user(uuid, text, boolean, text) from anon, public;
grant execute on function public.update_user(uuid, text, boolean, text) to authenticated;

-- Used by the login page to decide whether to offer
-- "create the first (owner) account".
create or replace function public.first_run()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.profiles where role = 'owner' and is_active
  );
$$;

revoke execute on function public.first_run() from public;
grant execute on function public.first_run() to anon, authenticated;

-- =============================================================
--  END OF SCHEMA MIGRATIONS
-- =============================================================
