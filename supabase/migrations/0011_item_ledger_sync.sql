-- ConsignTrack — 0011 sync the serialized Item lifecycle into the aggregate
-- ledger (stock_levels / sales / returns / settlement).
--
-- Before: item_scan only moved the item's own status; inventory, sales and
-- settlement never saw it. After: every item is backed by a catalogue product,
-- and a scan writes the matching stock_movement / sale / return so Inventory,
-- Sales, Analytics, Reconciliation and Settlement all stay in sync.

-- create_item now guarantees a backing product (auto-created if none chosen).
create or replace function public.create_item(
  p_store_id uuid, p_description text, p_asking_price numeric,
  p_category text default null, p_condition text default null,
  p_agreement_id uuid default null, p_product_id uuid default null, p_consignor_id uuid default null)
returns public.items language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_consignor uuid; v_id uuid := gen_random_uuid();
  v_product uuid; v_item public.items;
begin
  v_consignor := coalesce(p_consignor_id, public.current_consignor_id());
  if not (public.is_admin() or (public.is_consignor_user() and v_consignor = public.current_consignor_id())) then
    raise exception 'only the owning consignor or admin can create items' using errcode = 'insufficient_privilege'; end if;
  if v_consignor is null then raise exception 'consignor required' using errcode = 'check_violation'; end if;

  if p_product_id is not null then
    v_product := p_product_id;
  else
    insert into public.products (consignor_id, name, unit_price)
    values (v_consignor, p_description, coalesce(p_asking_price, 0))
    returning id into v_product;
  end if;

  insert into public.items (id, consignor_id, store_id, agreement_id, product_id, code, qr_token,
      description, category, condition, asking_price, status, current_holder, created_by)
  values (v_id, v_consignor, p_store_id, p_agreement_id, v_product,
      'CT-' || upper(substr(replace(v_id::text, '-', ''), 1, 6)), public.sign_item_token(v_id),
      p_description, p_category, p_condition, coalesce(p_asking_price, 0), 'labeled', 'consignor', v_uid)
  returning * into v_item;

  insert into public.scan_events (item_id, actor_id, actor_role, event_type, from_status, to_status, note)
  values (v_id, v_uid, public.current_app_role(), 'label', 'created', 'labeled', 'QR label issued');
  insert into public.audit_log (table_name, row_id, field, old_value, new_value, changed_by)
  values ('items', v_id, 'status', 'created', 'labeled', v_uid);
  return v_item;
end; $$;

-- item_scan now also posts the aggregate-ledger rows on receive / sell / return
-- / loss / damage, so the serialized flow and the quantity ledger are one.
create or replace function public.item_scan(
  p_token text, p_event_type text, p_note text default null, p_photo_url text default null,
  p_sale_price numeric default null, p_buyer_ref text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  it public.items; v_uid uuid := auth.uid(); v_role text := public.current_app_role();
  v_is_admin boolean := public.is_admin(); v_is_consignor boolean; v_is_consignee boolean;
  v_new_status text; v_holder text; v_has_dispatch boolean; v_reason text; v_kind text;
  v_sale_id uuid; v_price numeric(12,2);
begin
  select * into it from public.items where qr_token = p_token for update;
  if not found then raise exception 'Unknown or invalid QR code' using errcode = 'no_data_found'; end if;
  if p_token is distinct from public.sign_item_token(it.id) then
    raise exception 'Tampered or invalid QR code' using errcode = 'check_violation'; end if;
  v_is_consignor := coalesce(it.consignor_id = public.current_consignor_id(), false);
  v_is_consignee := coalesce(it.store_id = public.current_store_id(), false);
  v_new_status := null; v_reason := null; v_kind := null;

  if p_event_type = 'dispatch' then
    if not (v_is_admin or v_is_consignor) then v_kind:='wrong_actor'; v_reason:='Only the consignor can dispatch this item';
    elsif it.status <> 'labeled' then v_kind:='out_of_order'; v_reason:='Item must be labeled before dispatch';
    else v_new_status:='dispatched'; v_holder:='carrier'; end if;
  elsif p_event_type = 'deliver' then
    if not (v_is_admin or v_is_consignee) then v_kind:='wrong_actor'; v_reason:='Only the consignee can mark delivered';
    elsif it.status not in ('dispatched','in_transit') then v_kind:='out_of_order'; v_reason:='Item is not in transit';
    else v_new_status:='delivered'; v_holder:='carrier'; end if;
  elsif p_event_type = 'receive' then
    if not (v_is_admin or v_is_consignee) then v_kind:='wrong_actor'; v_reason:='Only the receiving consignee can confirm receipt';
    elsif it.status not in ('dispatched','in_transit','delivered') then v_kind:='out_of_order'; v_reason:='Item has not been dispatched';
    else
      select exists(select 1 from public.scan_events where item_id=it.id and event_type='dispatch' and not is_exception) into v_has_dispatch;
      if not v_has_dispatch then v_kind:='missing_scan'; v_reason:='No consignor dispatch scan on record (dual-scan required)';
      else v_new_status:='received_confirmed'; v_holder:='consignee'; end if;
    end if;
  elsif p_event_type = 'list' then
    if not (v_is_admin or v_is_consignee) then v_kind:='wrong_actor'; v_reason:='Only the consignee can list';
    elsif it.status <> 'received_confirmed' then v_kind:='out_of_order'; v_reason:='Item must be received before listing';
    else v_new_status:='listed'; v_holder:='consignee'; end if;
  elsif p_event_type = 'sell' then
    if not (v_is_admin or v_is_consignee) then v_kind:='wrong_actor'; v_reason:='Only the consignee can record a sale';
    elsif it.status <> 'listed' then v_kind:='out_of_order'; v_reason:='Item must be listed before it can be sold';
    else v_new_status:='sold'; v_holder:='buyer'; end if;
  elsif p_event_type = 'return' then
    if not (v_is_admin or v_is_consignee) then v_kind:='wrong_actor'; v_reason:='Only the consignee can return goods';
    elsif it.status not in ('received_confirmed','listed') then v_kind:='out_of_order'; v_reason:='Only received/listed items can be returned';
    else v_new_status:='returned_to_consignor'; v_holder:='consignor'; end if;
  elsif p_event_type in ('flag_lost','flag_damaged') then
    v_new_status := case when p_event_type='flag_lost' then 'lost' else 'damaged' end; v_holder:='none';
  else raise exception 'Unknown scan type: %', p_event_type using errcode='check_violation'; end if;

  if v_new_status is null then
    insert into public.scan_events (item_id, actor_id, actor_role, event_type, from_status, to_status, note, photo_url, is_exception, reason)
    values (it.id, v_uid, v_role, p_event_type, it.status, null, p_note, p_photo_url, true, v_reason);
    insert into public.exceptions (item_id, kind, detail, raised_by) values (it.id, coalesce(v_kind,'out_of_order'), v_reason, v_uid);
    return jsonb_build_object('ok', false, 'exception', true, 'status', it.status, 'message', v_reason);
  end if;

  v_price := coalesce(p_sale_price, it.asking_price);
  update public.items set status=v_new_status, current_holder=v_holder,
    sale_price = case when p_event_type='sell' then v_price else sale_price end,
    sold_at = case when p_event_type='sell' then now() else sold_at end,
    buyer_ref = case when p_event_type='sell' then p_buyer_ref else buyer_ref end
   where id=it.id;
  insert into public.scan_events (item_id, actor_id, actor_role, event_type, from_status, to_status, note, photo_url)
  values (it.id, v_uid, v_role, p_event_type, it.status, v_new_status, p_note, p_photo_url);
  insert into public.audit_log (table_name, row_id, field, old_value, new_value, changed_by)
  values ('items', it.id, 'status', it.status, v_new_status, v_uid);

  -- ===== aggregate-ledger sync =====
  if it.product_id is not null then
    if p_event_type = 'receive' then
      insert into public.stock_movements (entity_type, entity_id, movement_type, qty_delta, store_id, product_id, consignor_id, created_by, note)
      values ('item', it.id, 'delivery', 1, it.store_id, it.product_id, it.consignor_id, v_uid, 'Item received: '||it.code);
    elsif p_event_type = 'sell' then
      insert into public.sales (store_id, sold_at, recorded_by) values (it.store_id, now(), v_uid) returning id into v_sale_id;
      insert into public.sale_items (sale_id, product_id, consignor_id, qty, unit_price)
      values (v_sale_id, it.product_id, it.consignor_id, 1, v_price);
      insert into public.stock_movements (entity_type, entity_id, movement_type, qty_delta, store_id, product_id, consignor_id, created_by, note)
      values ('item', it.id, 'sale', -1, it.store_id, it.product_id, it.consignor_id, v_uid, 'Item sold: '||it.code);
    elsif p_event_type = 'return' then
      insert into public.returns (store_id, product_id, consignor_id, qty, reason, return_date)
      values (it.store_id, it.product_id, it.consignor_id, 1, coalesce(p_note,'Item returned'), current_date);
      insert into public.stock_movements (entity_type, entity_id, movement_type, qty_delta, store_id, product_id, consignor_id, created_by, note)
      values ('item', it.id, 'return', -1, it.store_id, it.product_id, it.consignor_id, v_uid, 'Item returned: '||it.code);
    elsif p_event_type in ('flag_lost','flag_damaged') and it.status in ('received_confirmed','listed') then
      insert into public.stock_movements (entity_type, entity_id, movement_type, qty_delta, store_id, product_id, consignor_id, created_by, note)
      values ('item', it.id, 'adjustment', -1, it.store_id, it.product_id, it.consignor_id, v_uid, p_event_type||': '||it.code);
    end if;
  end if;

  if p_event_type in ('flag_lost','flag_damaged') then
    insert into public.exceptions (item_id, kind, detail, raised_by)
    values (it.id, case when p_event_type='flag_lost' then 'loss' else 'damage' end, coalesce(p_note, v_new_status), v_uid);
  end if;

  return jsonb_build_object('ok', true, 'exception', false, 'status', v_new_status, 'message', 'Scan recorded');
end; $$;
