-- ConsignTrack — 0009 serialized Items + QR chain-of-custody + lifecycle
-- Adds per-unit item tracking with HMAC-signed QR tokens, a server-enforced
-- lifecycle state machine, append-only ScanEvents, an exceptions queue, and
-- disputes. Coexists with the aggregate quantity ledger (which still drives
-- settlement/analytics); this layer proves physical custody per unit.

-- ---------------------------------------------------------------------------
-- private_config — server-only secrets (RLS on, no policies → definer-only)
-- ---------------------------------------------------------------------------
create table if not exists public.private_config (
  key text primary key,
  value text not null
);
alter table public.private_config enable row level security;
insert into public.private_config (key, value)
  values ('qr_secret', encode(extensions.gen_random_bytes(32), 'hex'))
  on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- items — one row per physical unit
-- ---------------------------------------------------------------------------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  consignor_id uuid not null references public.consignors (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  agreement_id uuid references public.agreements (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  code text not null unique,          -- human-readable, e.g. CT-A1B2C3
  qr_token text not null unique,      -- HMAC-signed, goes into the QR
  description text not null,
  category text,
  condition text,
  asking_price numeric(12, 2) not null default 0 check (asking_price >= 0),
  status text not null default 'created' check (status in (
    'created','labeled','dispatched','in_transit','delivered','received_confirmed',
    'listed','sold','settled','returned_to_consignor','lost','damaged','disputed')),
  current_holder text not null default 'consignor'
    check (current_holder in ('consignor','carrier','consignee','buyer','none')),
  sale_price numeric(12, 2),
  sold_at timestamptz,
  buyer_ref text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_consignor_idx on public.items (consignor_id);
create index items_store_idx on public.items (store_id);
create index items_status_idx on public.items (status);
create trigger t_items_updated before update on public.items for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- scan_events — append-only custody log
-- ---------------------------------------------------------------------------
create table public.scan_events (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  actor_id uuid references auth.users (id),
  actor_role text,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  photo_url text,
  geo text,
  is_exception boolean not null default false,
  reason text,
  created_at timestamptz not null default now()
);
create index scan_events_item_idx on public.scan_events (item_id, created_at);

create trigger t_scan_events_no_update before update on public.scan_events
  for each row execute function public.forbid_movement_mutation();
create trigger t_scan_events_no_delete before delete on public.scan_events
  for each row execute function public.forbid_movement_mutation();

-- ---------------------------------------------------------------------------
-- exceptions — the owner action queue for custody anomalies
-- ---------------------------------------------------------------------------
create table public.exceptions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items (id) on delete cascade,
  kind text not null,      -- out_of_order | wrong_actor | missing_scan | tamper | loss | damage
  detail text,
  raised_by uuid references auth.users (id),
  status text not null default 'open' check (status in ('open','resolved')),
  resolution text,
  resolved_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index exceptions_status_idx on public.exceptions (status);

-- ---------------------------------------------------------------------------
-- disputes
-- ---------------------------------------------------------------------------
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items (id) on delete set null,
  subject text not null,
  raised_by uuid references auth.users (id),
  raised_role text,
  status text not null default 'open' check (status in ('open','resolved')),
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger t_disputes_updated before update on public.disputes for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- token signing
-- ---------------------------------------------------------------------------
create or replace function public.sign_item_token(p_item_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_secret text;
begin
  select value into v_secret from public.private_config where key = 'qr_secret';
  return 'CT1.' || replace(p_item_id::text, '-', '') || '.' ||
         encode(extensions.hmac(p_item_id::text, v_secret, 'sha256'), 'hex');
end; $$;

-- ---------------------------------------------------------------------------
-- create_item — issues the item + its signed QR label (status: labeled)
-- ---------------------------------------------------------------------------
create or replace function public.create_item(
  p_store_id uuid,
  p_description text,
  p_asking_price numeric,
  p_category text default null,
  p_condition text default null,
  p_agreement_id uuid default null,
  p_product_id uuid default null,
  p_consignor_id uuid default null
)
returns public.items language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_consignor uuid;
  v_id uuid := gen_random_uuid();
  v_item public.items;
begin
  v_consignor := coalesce(p_consignor_id, public.current_consignor_id());
  if not (public.is_admin() or (public.is_consignor_user() and v_consignor = public.current_consignor_id())) then
    raise exception 'only the owning consignor or admin can create items' using errcode = 'insufficient_privilege';
  end if;
  if v_consignor is null then raise exception 'consignor required' using errcode = 'check_violation'; end if;

  insert into public.items (id, consignor_id, store_id, agreement_id, product_id, code, qr_token,
      description, category, condition, asking_price, status, current_holder, created_by)
  values (v_id, v_consignor, p_store_id, p_agreement_id, p_product_id,
      'CT-' || upper(substr(replace(v_id::text, '-', ''), 1, 6)),
      public.sign_item_token(v_id),
      p_description, p_category, p_condition, coalesce(p_asking_price, 0), 'labeled', 'consignor', v_uid)
  returning * into v_item;

  insert into public.scan_events (item_id, actor_id, actor_role, event_type, from_status, to_status, note)
  values (v_id, v_uid, public.current_app_role(), 'label', 'created', 'labeled', 'QR label issued');

  insert into public.audit_log (table_name, row_id, field, old_value, new_value, changed_by)
  values ('items', v_id, 'status', 'created', 'labeled', v_uid);

  return v_item;
end; $$;

-- ---------------------------------------------------------------------------
-- item_scan — the heart: verify signed token, enforce transition, dual-scan,
-- record ScanEvent + audit, or raise an exception into the owner queue.
-- Returns jsonb { ok, status, message, exception }.
-- ---------------------------------------------------------------------------
create or replace function public.item_scan(
  p_token text,
  p_event_type text,
  p_note text default null,
  p_photo_url text default null,
  p_sale_price numeric default null,
  p_buyer_ref text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  it public.items;
  v_uid uuid := auth.uid();
  v_role text := public.current_app_role();
  v_is_admin boolean := public.is_admin();
  v_is_consignor boolean;
  v_is_consignee boolean;
  v_new_status text;
  v_holder text;
  v_has_dispatch boolean;
  v_reason text;
  v_kind text;
begin
  select * into it from public.items where qr_token = p_token for update;
  if not found then
    raise exception 'Unknown or invalid QR code' using errcode = 'no_data_found';
  end if;
  -- verify signature (tamper-evident)
  if p_token is distinct from public.sign_item_token(it.id) then
    raise exception 'Tampered or invalid QR code' using errcode = 'check_violation';
  end if;

  v_is_consignor := (it.consignor_id = public.current_consignor_id());
  v_is_consignee := (it.store_id = public.current_store_id());

  -- resolve intended transition
  v_new_status := null; v_reason := null; v_kind := null;
  if p_event_type = 'dispatch' then
    if not (v_is_admin or v_is_consignor) then v_kind := 'wrong_actor'; v_reason := 'Only the consignor can dispatch this item';
    elsif it.status <> 'labeled' then v_kind := 'out_of_order'; v_reason := 'Item must be labeled before dispatch';
    else v_new_status := 'dispatched'; v_holder := 'carrier'; end if;

  elsif p_event_type = 'deliver' then
    if not (v_is_admin or v_is_consignee) then v_kind := 'wrong_actor'; v_reason := 'Only the consignee can mark delivered';
    elsif it.status not in ('dispatched','in_transit') then v_kind := 'out_of_order'; v_reason := 'Item is not in transit';
    else v_new_status := 'delivered'; v_holder := 'carrier'; end if;

  elsif p_event_type = 'receive' then
    if not (v_is_admin or v_is_consignee) then v_kind := 'wrong_actor'; v_reason := 'Only the receiving consignee can confirm receipt';
    elsif it.status not in ('dispatched','in_transit','delivered') then v_kind := 'out_of_order'; v_reason := 'Item has not been dispatched';
    else
      select exists(select 1 from public.scan_events where item_id = it.id and event_type = 'dispatch' and not is_exception)
        into v_has_dispatch;
      if not v_has_dispatch then v_kind := 'missing_scan'; v_reason := 'No consignor dispatch scan on record (dual-scan required)';
      else v_new_status := 'received_confirmed'; v_holder := 'consignee'; end if;
    end if;

  elsif p_event_type = 'list' then
    if not (v_is_admin or v_is_consignee) then v_kind := 'wrong_actor'; v_reason := 'Only the consignee can list';
    elsif it.status <> 'received_confirmed' then v_kind := 'out_of_order'; v_reason := 'Item must be received before listing';
    else v_new_status := 'listed'; v_holder := 'consignee'; end if;

  elsif p_event_type = 'sell' then
    if not (v_is_admin or v_is_consignee) then v_kind := 'wrong_actor'; v_reason := 'Only the consignee can record a sale';
    elsif it.status <> 'listed' then v_kind := 'out_of_order'; v_reason := 'Item must be listed before it can be sold';
    else v_new_status := 'sold'; v_holder := 'buyer'; end if;

  elsif p_event_type = 'return' then
    if not (v_is_admin or v_is_consignee) then v_kind := 'wrong_actor'; v_reason := 'Only the consignee can return goods';
    elsif it.status not in ('received_confirmed','listed') then v_kind := 'out_of_order'; v_reason := 'Only received/listed items can be returned';
    else v_new_status := 'returned_to_consignor'; v_holder := 'consignor'; end if;

  elsif p_event_type in ('flag_lost','flag_damaged') then
    v_new_status := case when p_event_type = 'flag_lost' then 'lost' else 'damaged' end;
    v_holder := 'none';

  else
    raise exception 'Unknown scan type: %', p_event_type using errcode = 'check_violation';
  end if;

  -- exception path: record the scan as an exception, do NOT advance state
  if v_new_status is null then
    insert into public.scan_events (item_id, actor_id, actor_role, event_type, from_status, to_status, note, photo_url, is_exception, reason)
    values (it.id, v_uid, v_role, p_event_type, it.status, null, p_note, p_photo_url, true, v_reason);
    insert into public.exceptions (item_id, kind, detail, raised_by)
    values (it.id, coalesce(v_kind,'out_of_order'), v_reason, v_uid);
    return jsonb_build_object('ok', false, 'exception', true, 'status', it.status, 'message', v_reason);
  end if;

  -- valid transition
  update public.items
     set status = v_new_status,
         current_holder = v_holder,
         sale_price = case when p_event_type = 'sell' then coalesce(p_sale_price, asking_price) else sale_price end,
         sold_at = case when p_event_type = 'sell' then now() else sold_at end,
         buyer_ref = case when p_event_type = 'sell' then p_buyer_ref else buyer_ref end
   where id = it.id;

  insert into public.scan_events (item_id, actor_id, actor_role, event_type, from_status, to_status, note, photo_url)
  values (it.id, v_uid, v_role, p_event_type, it.status, v_new_status, p_note, p_photo_url);

  insert into public.audit_log (table_name, row_id, field, old_value, new_value, changed_by)
  values ('items', it.id, 'status', it.status, v_new_status, v_uid);

  -- flagged items also raise an owner exception
  if p_event_type in ('flag_lost','flag_damaged') then
    insert into public.exceptions (item_id, kind, detail, raised_by)
    values (it.id, case when p_event_type='flag_lost' then 'loss' else 'damage' end, coalesce(p_note, v_new_status), v_uid);
  end if;

  return jsonb_build_object('ok', true, 'exception', false, 'status', v_new_status, 'message', 'Scan recorded');
end; $$;

-- ---------------------------------------------------------------------------
-- exception + dispute resolution
-- ---------------------------------------------------------------------------
create or replace function public.resolve_exception(p_id uuid, p_resolution text)
returns public.exceptions language plpgsql security definer set search_path = public as $$
declare v_row public.exceptions;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = 'insufficient_privilege'; end if;
  update public.exceptions set status='resolved', resolution=p_resolution, resolved_by=auth.uid(), resolved_at=now()
   where id=p_id returning * into v_row;
  return v_row;
end; $$;

create or replace function public.raise_dispute(p_item_id uuid, p_subject text)
returns public.disputes language plpgsql security definer set search_path = public as $$
declare v_row public.disputes;
begin
  insert into public.disputes (item_id, subject, raised_by, raised_role)
  values (p_item_id, p_subject, auth.uid(), public.current_app_role()) returning * into v_row;
  if p_item_id is not null then
    update public.items set status='disputed' where id=p_item_id and status not in ('sold','settled');
  end if;
  return v_row;
end; $$;

create or replace function public.resolve_dispute(p_id uuid, p_resolution text)
returns public.disputes language plpgsql security definer set search_path = public as $$
declare v_row public.disputes;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = 'insufficient_privilege'; end if;
  update public.disputes set status='resolved', resolution=p_resolution where id=p_id returning * into v_row;
  return v_row;
end; $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.items enable row level security;
alter table public.scan_events enable row level security;
alter table public.exceptions enable row level security;
alter table public.disputes enable row level security;

create policy items_select on public.items for select to authenticated
  using (public.is_admin() or consignor_id = public.current_consignor_id() or store_id = public.current_store_id());
create policy items_admin_write on public.items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy scan_events_select on public.scan_events for select to authenticated
  using (exists (select 1 from public.items i where i.id = item_id and (
    public.is_admin() or i.consignor_id = public.current_consignor_id() or i.store_id = public.current_store_id())));

create policy exceptions_select on public.exceptions for select to authenticated
  using (public.is_admin() or exists (select 1 from public.items i where i.id = item_id and (
    i.consignor_id = public.current_consignor_id() or i.store_id = public.current_store_id())));

create policy disputes_select on public.disputes for select to authenticated
  using (public.is_admin() or raised_by = auth.uid() or exists (select 1 from public.items i where i.id = item_id and (
    i.consignor_id = public.current_consignor_id() or i.store_id = public.current_store_id())));

grant select, insert, update, delete on public.items, public.scan_events, public.exceptions, public.disputes to authenticated;
grant execute on all functions in schema public to authenticated;
