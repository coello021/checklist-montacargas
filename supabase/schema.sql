-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Después, crea usuarios en Authentication > Users y agrega cada UUID a app_users.
create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'operator' check (role in ('operator','admin'))
);

create table if not exists public.inspections (
  id text primary key check (length(id) between 2 and 120),
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.inspection_history (
  inspection_id text not null references public.inspections(id),
  version integer not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id),
  action text not null check (action in ('created','updated','archived')),
  record jsonb not null,
  primary key (inspection_id,version)
);
create index if not exists inspections_updated_idx on public.inspections(updated_at desc);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.check_inspection_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.version <> old.version + 1 then
    raise exception 'La versión debe avanzar exactamente una vez';
  end if;
  if auth.uid() is null or new.id <> old.id or new.created_by <> old.created_by
     or new.created_at <> old.created_at or old.deleted_at is not null
     or new.updated_by <> auth.uid() then
    raise exception 'Actualización no permitida';
  end if;
  if new.deleted_at is not null and new.record <> old.record then
    raise exception 'No se puede modificar y archivar al mismo tiempo';
  end if;
  new.updated_at := now();
  return new;
end; $$;

create or replace function private.audit_inspection()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or new.updated_by <> auth.uid() then
    raise exception 'Auditoría sin usuario autorizado';
  end if;
  insert into public.inspection_history(inspection_id,version,changed_by,action,record)
  values(new.id,new.version,new.updated_by,
    case when tg_op = 'INSERT' then 'created'
         when new.deleted_at is not null then 'archived' else 'updated' end,
    new.record);
  return new;
end; $$;

drop trigger if exists before_inspection_update on public.inspections;
create trigger before_inspection_update before update on public.inspections
for each row execute function private.check_inspection_update();
drop trigger if exists after_inspection_change on public.inspections;
create trigger after_inspection_change after insert or update on public.inspections
for each row execute function private.audit_inspection();

alter table public.app_users enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_history enable row level security;

create policy "Cada usuario ve su acceso" on public.app_users for select to authenticated
using (user_id = (select auth.uid()));
create policy "Miembros ven inspecciones" on public.inspections for select to authenticated
using (exists(select 1 from public.app_users u where u.user_id = (select auth.uid())));
create policy "Miembros crean inspecciones" on public.inspections for insert to authenticated
with check (
  created_by = (select auth.uid()) and updated_by = (select auth.uid())
  and version = 1 and deleted_at is null
  and (record->>'id') = id
  and exists(select 1 from public.app_users u where u.user_id = (select auth.uid()))
);
create policy "Miembros editan inspecciones" on public.inspections for update to authenticated
using (deleted_at is null and exists(select 1 from public.app_users u where u.user_id = (select auth.uid())))
with check (updated_by = (select auth.uid())
  and (record->>'id') = id
  and exists(select 1 from public.app_users u where u.user_id = (select auth.uid())));
create policy "Miembros ven historial" on public.inspection_history for select to authenticated
using (exists(select 1 from public.app_users u where u.user_id = (select auth.uid())));

revoke all on public.app_users, public.inspections, public.inspection_history from anon;
grant select on public.app_users to authenticated;
grant select, insert, update on public.inspections to authenticated;
grant select on public.inspection_history to authenticated;
revoke all on function private.check_inspection_update() from public, anon, authenticated;
revoke all on function private.audit_inspection() from public, anon, authenticated;

-- Agrega usuarios autorizados DESPUÉS de crearlos en Authentication > Users:
-- insert into public.app_users(user_id,display_name,role)
-- values ('UUID-DEL-USUARIO','Nombre del operador','operator');
