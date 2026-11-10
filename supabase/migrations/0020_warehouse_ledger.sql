-- ConsignTrack — 0020 warehouse stock ledger (consignor side of the custody chain)
-- Completes the chain Warehouse → In Transit → On Hand → Sold / Return.
-- warehouse_entries mirrors ledger_entries but is consignor-scoped.

create table if not exists public.warehouse_entries (
  id uuid primary key default gen_random_uuid(),
  consignor_id uuid not null references public.consignors(id),
  sku_id uuid not null references public.products(id),
  entry_type text not null check (entry_type in ('PRODUCE','DISPATCH','RETURN_IN','ADJUSTMENT')),
  qty int not null,
  ref_type text,
  ref_id uuid,
  actor_user_id uuid references auth.users(id),
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists warehouse_consignor_sku_idx on public.warehouse_entries(consignor_id, sku_id);

-- append-only (reuse the generic ledger guard)
drop trigger if exists trg_wh_no_update on public.warehouse_entries;
drop trigger if exists trg_wh_no_delete on public.warehouse_entries;
create trigger trg_wh_no_update before update on public.warehouse_entries for each row execute function public.block_ledger_mutation();
create trigger trg_wh_no_delete before delete on public.warehouse_entries for each row execute function public.block_ledger_mutation();

create or replace view public.v_warehouse_on_hand as
  select consignor_id, sku_id, coalesce(sum(qty),0)::int as qty
  from public.warehouse_entries group by consignor_id, sku_id;
grant select on public.v_warehouse_on_hand to authenticated;

create or replace function public.get_warehouse_on_hand(p_consignor uuid, p_sku uuid)
returns int language sql stable as $$
  select coalesce(sum(qty),0)::int from public.warehouse_entries where consignor_id=p_consignor and sku_id=p_sku;
$$;

alter table public.warehouse_entries enable row level security;
drop policy if exists warehouse_select on public.warehouse_entries;
create policy warehouse_select on public.warehouse_entries for select to authenticated
  using (public.is_admin() or consignor_id = public.current_consignor_id());

-- ---------------------------------------------------------------------------
-- dispatch now decrements the warehouse (one scan at pickup) with a guard.
-- ---------------------------------------------------------------------------
create or replace function public.dispatch_package(p_package_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pk public.packages; pl record; v_wh int;
begin
  select * into pk from public.packages where id=p_package_id for update;
  if not found then raise exception 'package not found'; end if;
  if pk.status <> 'PACKED' then raise exception 'Only a PACKED package can be dispatched (is %)', pk.status using errcode='check_violation'; end if;
  -- guard + decrement warehouse per line
  for pl in select sku_id, qty_expected from public.package_lines where package_id=p_package_id loop
    v_wh := public.get_warehouse_on_hand(pk.consignor_id, pl.sku_id);
    if pl.qty_expected > v_wh then
      raise exception 'Not enough warehouse stock for % (need %, have %)',
        (select sku from public.products where id=pl.sku_id), pl.qty_expected, v_wh using errcode='check_violation';
    end if;
  end loop;
  for pl in select sku_id, qty_expected from public.package_lines where package_id=p_package_id loop
    insert into public.warehouse_entries (consignor_id, sku_id, entry_type, qty, ref_type, ref_id, actor_user_id)
    values (pk.consignor_id, pl.sku_id, 'DISPATCH', -pl.qty_expected, 'package', pk.id, auth.uid());
  end loop;
  update public.packages set status='IN_TRANSIT', in_transit_at=now(), updated_at=now() where id=p_package_id;
end $$;

-- ---------------------------------------------------------------------------
-- receive_return_package — consignor scans a RET package in → warehouse +qty,
-- custody closes. Mirror of the store's receive flow.
-- p_lines: [{"line_id":uuid,"qty_received":int}]
-- ---------------------------------------------------------------------------
create or replace function public.receive_return_package(p_package_id uuid, p_lines jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare pk public.packages; v_line jsonb; pl public.package_lines;
begin
  select * into pk from public.packages where id=p_package_id for update;
  if not found then raise exception 'package not found'; end if;
  if not (public.is_admin() or pk.consignor_id = public.current_consignor_id()) then
    raise exception 'This return is not addressed to your warehouse' using errcode='insufficient_privilege';
  end if;
  if pk.direction <> 'RETURN' or pk.status <> 'RETURN_IN_TRANSIT' then
    raise exception 'Only a return in transit can be received (is %)', pk.status using errcode='check_violation';
  end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into pl from public.package_lines where id=(v_line->>'line_id')::uuid and package_id=p_package_id;
    if not found then continue; end if;
    update public.package_lines set qty_received=(v_line->>'qty_received')::int where id=pl.id;
    if coalesce((v_line->>'qty_received')::int,0) > 0 then
      insert into public.warehouse_entries (consignor_id, sku_id, entry_type, qty, ref_type, ref_id, actor_user_id)
      values (pk.consignor_id, pl.sku_id, 'RETURN_IN', (v_line->>'qty_received')::int, 'package', pk.id, auth.uid());
    end if;
  end loop;
  update public.packages set status='RECEIVED_BY_CONSIGNOR', settled_at=now(), updated_at=now() where id=p_package_id;
end $$;

-- ---------------------------------------------------------------------------
-- Opening warehouse balances so consignors can ship (idempotent).
-- ---------------------------------------------------------------------------
do $$
begin
  insert into public.warehouse_entries (consignor_id, sku_id, entry_type, qty, ref_type, reason)
  select p.consignor_id, p.id, 'PRODUCE', 100, 'opening', 'opening warehouse stock'
  from public.products p
  where p.status='active'
    and not exists (select 1 from public.warehouse_entries w where w.consignor_id=p.consignor_id and w.sku_id=p.id and w.ref_type='opening');
end $$;
