-- DL Digital Services · Gestion — base de données sécurisée (Supabase)
-- À coller une seule fois dans Supabase : SQL Editor › New query › Run.
--
-- Une seule table « records » : chaque ligne appartient à une utilisatrice
-- (user_id). Les règles Row Level Security garantissent que personne d'autre
-- ne peut lire, modifier ou supprimer ces données, même avec la clé publique.

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  kind       text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists records_kind_idx on public.records (user_id, kind);

alter table public.records enable row level security;

drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;

create policy "records_select_own" on public.records
  for select using (auth.uid() = user_id);

create policy "records_insert_own" on public.records
  for insert with check (auth.uid() = user_id);

create policy "records_update_own" on public.records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Une facture, un acompte, un solde ou un avoir finalisé (qui a un numéro)
-- ne peut jamais être supprimé : conservation légale de 10 ans.
create policy "records_delete_own" on public.records
  for delete using (
    auth.uid() = user_id
    and not (
      kind = 'documents'
      and coalesce(data ->> 'number', '') <> ''
      and coalesce(data ->> 'kind', '') <> 'quote'
    )
  );

-- Une facture finalisée ne peut plus être modifiée (seul un avoir la corrige).
create or replace function public.protect_finalized_documents()
returns trigger
language plpgsql
as $$
begin
  if old.kind = 'documents'
     and coalesce(old.data ->> 'number', '') <> ''
     and coalesce(old.data ->> 'kind', '') <> 'quote'
     and (new.data - 'updatedAt') is distinct from (old.data - 'updatedAt') then
    raise exception 'Document finalisé : modification interdite. Créez un avoir.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_finalized_documents on public.records;
create trigger protect_finalized_documents
  before update on public.records
  for each row execute function public.protect_finalized_documents();
