-- =============================================================
--  Inovexa Labs — Hardware Shop Inventory & POS System
--  Migration 00012 : role checks in database functions
--
--  Current Supabase (PostgREST v10+) passes the signed-in user's
--  token only as request.jwt.claims (one JSON value).  The older
--  per-claim settings such as request.jwt.claim.role are no longer
--  set, so require_permission() found no role, treated the call as
--  a trusted script and skipped the check: any signed-in user could
--  call any business function directly (a cashier could cancel a
--  sale or post a journal entry).  Read the role from either place.
-- =============================================================
create or replace function public.require_permission(p_code text)
returns void
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_claim text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    '');
begin
  -- No JWT in context = a direct database session (migrations, seed scripts).
  -- The service key is the trusted server-side key. Everything else
  -- (anon / authenticated app users) must pass the permission check.
  if v_claim = '' or v_claim in ('postgres', 'service_role') then
    return;
  end if;
  if not public.has_permission(p_code) then
    raise exception 'You do not have permission to do this. Ask the shop owner to help.';
  end if;
end;
$$;

revoke execute on function public.require_permission(text) from anon, public;
grant execute on function public.require_permission(text) to authenticated;
