create extension if not exists pgcrypto;

create type public.profile_role as enum ('customer', 'staff', 'admin');
create type public.reward_status as enum ('locked', 'available', 'redeemed');
create type public.loyalty_transaction_type as enum (
  'stamp_added',
  'fifth_reward_redeemed',
  'tenth_reward_redeemed'
);
create type public.wallet_provider as enum ('google', 'apple');
create type public.wallet_pass_status as enum ('active', 'disabled', 'revoked');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text check (last_name is null or char_length(last_name) between 1 and 80),
  email text not null unique check (email = lower(email) and position('@' in email) > 1),
  birthday date,
  role public.profile_role not null default 'customer',
  loyalty_member_code text not null unique check (
    loyalty_member_code = upper(loyalty_member_code)
    and loyalty_member_code ~ '^ZB-[0-9A-F]{6}$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.loyalty_accounts (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  current_stamps integer not null default 0 check (current_stamps between 0 and 10),
  cycle_number integer not null default 1 check (cycle_number >= 1),
  fifth_reward_status public.reward_status not null default 'locked',
  tenth_reward_status public.reward_status not null default 'locked',
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint fifth_reward_requires_five_stamps check (
    current_stamps >= 5 or fifth_reward_status = 'locked'
  ),
  constraint tenth_reward_requires_ten_stamps check (
    current_stamps >= 10 or tenth_reward_status = 'locked'
  ),
  constraint tenth_available_at_exactly_ten check (
    tenth_reward_status <> 'available' or current_stamps = 10
  )
);

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  staff_id uuid not null references public.profiles(id),
  transaction_type public.loyalty_transaction_type not null,
  stamp_count_before integer not null check (stamp_count_before between 0 and 10),
  stamp_count_after integer not null check (stamp_count_after between 0 and 10),
  cycle_number integer not null check (cycle_number >= 1),
  request_id text not null unique check (
    char_length(request_id) between 36 and 80
    and request_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);

create table public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint qr_token_expiry_is_short check (expires_at <= created_at + interval '3 minutes')
);

create table public.wallet_passes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  provider public.wallet_provider not null,
  provider_object_id text,
  status public.wallet_pass_status not null default 'active',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, provider)
);

create index loyalty_transactions_customer_created_idx
  on public.loyalty_transactions (customer_id, created_at desc);
create index qr_tokens_hash_valid_idx
  on public.qr_tokens (token_hash, expires_at)
  where used_at is null and revoked_at is null;

create or replace function public.normalize_profile_name(p_value text, p_fallback text default null)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(left(regexp_replace(trim(coalesce(p_value, p_fallback, '')), '\s+', ' ', 'g'), 80), '')
$$;

create or replace function public.safe_optional_birthday(p_value text)
returns date
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_value is null or trim(p_value) = '' then
    return null;
  end if;

  if p_value !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;

  return p_value::date;
exception
  when others then
    return null;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger wallet_passes_touch_updated_at
before update on public.wallet_passes
for each row execute function public.touch_updated_at();

create or replace function public.generate_member_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return 'ZB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
end;
$$;

create or replace function public.enforce_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = new.customer_id and role = 'customer'
  ) then
    raise exception 'Loyalty records must belong to a customer profile.';
  end if;

  return new;
end;
$$;

create trigger loyalty_accounts_customer_profile
before insert or update of customer_id on public.loyalty_accounts
for each row execute function public.enforce_customer_profile();

create trigger qr_tokens_customer_profile
before insert or update of customer_id on public.qr_tokens
for each row execute function public.enforce_customer_profile();

create trigger wallet_passes_customer_profile
before insert or update of customer_id on public.wallet_passes
for each row execute function public.enforce_customer_profile();

create or replace function public.enforce_transaction_participants()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = new.customer_id and role = 'customer'
  ) then
    raise exception 'Transaction customer must be a customer profile.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = new.staff_id and role in ('staff', 'admin')
  ) then
    raise exception 'Transaction staff member must be staff or admin.';
  end if;

  return new;
end;
$$;

create trigger loyalty_transactions_participants
before insert or update of customer_id, staff_id on public.loyalty_transactions
for each row execute function public.enforce_transaction_participants();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_first_name text;
  v_last_name text;
  v_birthday date;
  v_email text;
  v_member_code text;
begin
  v_email := lower(coalesce(new.email, ''));
  v_first_name := coalesce(
    public.normalize_profile_name(new.raw_user_meta_data->>'first_name'),
    public.normalize_profile_name(split_part(v_email, '@', 1)),
    'Guest'
  );
  v_last_name := public.normalize_profile_name(new.raw_user_meta_data->>'last_name');
  v_birthday := public.safe_optional_birthday(new.raw_user_meta_data->>'birthday');

  loop
    v_member_code := public.generate_member_code();

    begin
      insert into public.profiles (
        id,
        first_name,
        last_name,
        email,
        birthday,
        role,
        loyalty_member_code
      )
      values (
        new.id,
        v_first_name,
        v_last_name,
        v_email,
        v_birthday,
        'customer',
        v_member_code
      )
      on conflict (id) do nothing;

      exit;
    exception
      when unique_violation then
        if exists (select 1 from public.profiles where id = new.id) then
          exit;
        end if;
        if exists (select 1 from public.profiles where email = v_email) then
          raise exception 'Profile email already exists.';
        end if;
    end;
  end loop;

  insert into public.loyalty_accounts (customer_id)
  values (new.id)
  on conflict (customer_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff', 'admin')
  );
$$;

create or replace function public.assert_staff_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_actor_id and role in ('staff', 'admin')
  ) then
    raise exception 'Staff authorization required.';
  end if;

  return v_actor_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.wallet_passes enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.loyalty_accounts from anon, authenticated;
revoke all on table public.loyalty_transactions from anon, authenticated;
revoke all on table public.qr_tokens from anon, authenticated;
revoke all on table public.wallet_passes from anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.loyalty_accounts to authenticated;
grant select on public.loyalty_transactions to authenticated;
grant select on public.wallet_passes to authenticated;
grant insert (customer_id, token_hash, expires_at) on public.qr_tokens to authenticated;
grant select on public.qr_tokens to authenticated;

create policy "customers and staff can read profiles"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.current_user_is_staff_or_admin());

create policy "customers and staff can read loyalty accounts"
on public.loyalty_accounts for select
to authenticated
using (customer_id = auth.uid() or public.current_user_is_staff_or_admin());

create policy "customers and staff can read transactions"
on public.loyalty_transactions for select
to authenticated
using (customer_id = auth.uid() or public.current_user_is_staff_or_admin());

create policy "customers can create own short lived qr tokens"
on public.qr_tokens for insert
to authenticated
with check (
  customer_id = auth.uid()
  and used_at is null
  and revoked_at is null
  and expires_at > now()
  and expires_at <= now() + interval '3 minutes'
);

create policy "staff can read qr tokens"
on public.qr_tokens for select
to authenticated
using (
  public.current_user_is_staff_or_admin()
);

create policy "customers and staff can read wallet passes"
on public.wallet_passes for select
to authenticated
using (customer_id = auth.uid() or public.current_user_is_staff_or_admin());

create or replace function public.update_profile(
  p_first_name text,
  p_last_name text default null,
  p_birthday text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  update public.profiles
  set
    first_name = coalesce(public.normalize_profile_name(p_first_name), first_name),
    last_name = public.normalize_profile_name(p_last_name),
    birthday = public.safe_optional_birthday(p_birthday)
  where id = auth.uid() and role = 'customer'
  returning * into v_profile;

  if not found then
    raise exception 'Customer profile not found.';
  end if;

  return v_profile;
end;
$$;

create or replace function public.resolve_loyalty_customer(
  p_customer_id uuid,
  p_member_code text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
begin
  if p_customer_id is not null then
    select id into v_customer_id
    from public.profiles
    where id = p_customer_id and role = 'customer';
  elsif p_member_code is not null then
    select id into v_customer_id
    from public.profiles
    where loyalty_member_code = upper(trim(p_member_code)) and role = 'customer';
  end if;

  if v_customer_id is null then
    raise exception 'Customer is invalid.';
  end if;

  return v_customer_id;
end;
$$;

create or replace function public.assert_valid_request_id(p_request_id text)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_request_id is null
    or char_length(p_request_id) > 80
    or p_request_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    raise exception 'A valid random request ID is required.';
  end if;
end;
$$;

create or replace function public.return_idempotent_account(
  p_request_id text,
  p_transaction_type public.loyalty_transaction_type,
  p_actor_id uuid,
  p_customer_id uuid default null,
  p_member_code text default null,
  p_qr_token_hash text default null
)
returns public.loyalty_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transaction public.loyalty_transactions%rowtype;
  v_expected_customer_id uuid;
  v_account public.loyalty_accounts%rowtype;
begin
  select * into v_transaction
  from public.loyalty_transactions
  where request_id = p_request_id;

  if not found then
    return null;
  end if;

  if v_transaction.transaction_type <> p_transaction_type
    or v_transaction.staff_id <> p_actor_id
  then
    raise exception 'Request ID was already used for a different operation.';
  end if;

  if p_customer_id is not null then
    v_expected_customer_id := p_customer_id;
  elsif p_member_code is not null then
    v_expected_customer_id := public.resolve_loyalty_customer(null, p_member_code);
  elsif p_qr_token_hash is not null then
    select customer_id into v_expected_customer_id
    from public.qr_tokens
    where token_hash = p_qr_token_hash;
  end if;

  if v_expected_customer_id is not null
    and v_expected_customer_id <> v_transaction.customer_id
  then
    raise exception 'Request ID was already used for a different customer.';
  end if;

  select * into v_account
  from public.loyalty_accounts
  where customer_id = v_transaction.customer_id;

  if not found then
    raise exception 'Loyalty account not found.';
  end if;

  return v_account;
end;
$$;

create or replace function public.add_stamp(
  p_customer_id uuid default null,
  p_member_code text default null,
  p_qr_token_hash text default null,
  p_request_id text default null,
  p_note text default null
)
returns public.loyalty_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid;
  v_customer_id uuid;
  v_account public.loyalty_accounts%rowtype;
  v_idempotent public.loyalty_accounts%rowtype;
  v_before integer;
  v_last_stamp_at timestamptz;
  v_cooldown_seconds integer;
  v_qr_token_id uuid;
begin
  v_actor_id := public.assert_staff_actor();
  perform public.assert_valid_request_id(p_request_id);

  v_idempotent := public.return_idempotent_account(
    p_request_id,
    'stamp_added',
    v_actor_id,
    p_customer_id,
    p_member_code,
    p_qr_token_hash
  );

  if v_idempotent.customer_id is not null then
    return v_idempotent;
  end if;

  if p_qr_token_hash is not null then
    select id, customer_id into v_qr_token_id, v_customer_id
    from public.qr_tokens
    where token_hash = p_qr_token_hash
      and expires_at > now()
      and used_at is null
      and revoked_at is null
    for update;

    if v_customer_id is null then
      raise exception 'QR token is invalid, expired, or already used.';
    end if;

    update public.qr_tokens
    set used_at = now()
    where id = v_qr_token_id and used_at is null;

    if not found then
      raise exception 'QR token is invalid, expired, or already used.';
    end if;
  else
    v_customer_id := public.resolve_loyalty_customer(p_customer_id, p_member_code);
  end if;

  select * into v_account
  from public.loyalty_accounts
  where customer_id = v_customer_id
  for update;

  if not found then
    raise exception 'Loyalty account not found.';
  end if;

  if v_account.current_stamps >= 10 then
    raise exception 'The tenth reward must be redeemed before adding stamps.';
  end if;

  select created_at into v_last_stamp_at
  from public.loyalty_transactions
  where customer_id = v_customer_id
    and transaction_type = 'stamp_added'
  order by created_at desc
  limit 1;

  v_cooldown_seconds := coalesce(
    nullif(current_setting('app.loyalty_stamp_cooldown_seconds', true), '')::integer,
    300
  );

  if v_last_stamp_at is not null
    and v_last_stamp_at > now() - make_interval(secs => v_cooldown_seconds)
  then
    raise exception 'Stamp cooldown is still active.';
  end if;

  v_before := v_account.current_stamps;

  update public.loyalty_accounts
  set
    current_stamps = current_stamps + 1,
    fifth_reward_status = case
      when current_stamps + 1 >= 5 and fifth_reward_status = 'locked'
      then 'available'::public.reward_status
      else fifth_reward_status
    end,
    tenth_reward_status = case
      when current_stamps + 1 >= 10 and tenth_reward_status = 'locked'
      then 'available'::public.reward_status
      else tenth_reward_status
    end,
    version = version + 1,
    updated_at = now()
  where customer_id = v_customer_id
  returning * into v_account;

  insert into public.loyalty_transactions (
    customer_id,
    staff_id,
    transaction_type,
    stamp_count_before,
    stamp_count_after,
    cycle_number,
    request_id,
    note
  )
  values (
    v_customer_id,
    v_actor_id,
    'stamp_added',
    v_before,
    v_account.current_stamps,
    v_account.cycle_number,
    p_request_id,
    p_note
  );

  return v_account;
end;
$$;

create or replace function public.redeem_fifth_reward(
  p_customer_id uuid,
  p_request_id text,
  p_note text default null
)
returns public.loyalty_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid;
  v_account public.loyalty_accounts%rowtype;
  v_idempotent public.loyalty_accounts%rowtype;
begin
  v_actor_id := public.assert_staff_actor();
  perform public.assert_valid_request_id(p_request_id);

  v_idempotent := public.return_idempotent_account(
    p_request_id,
    'fifth_reward_redeemed',
    v_actor_id,
    p_customer_id
  );

  if v_idempotent.customer_id is not null then
    return v_idempotent;
  end if;

  perform public.resolve_loyalty_customer(p_customer_id, null);

  select * into v_account
  from public.loyalty_accounts
  where customer_id = p_customer_id
  for update;

  if not found then
    raise exception 'Loyalty account not found.';
  end if;

  if v_account.fifth_reward_status <> 'available' then
    raise exception 'The 10%% reward is not available.';
  end if;

  update public.loyalty_accounts
  set
    fifth_reward_status = 'redeemed',
    version = version + 1,
    updated_at = now()
  where customer_id = p_customer_id
  returning * into v_account;

  insert into public.loyalty_transactions (
    customer_id,
    staff_id,
    transaction_type,
    stamp_count_before,
    stamp_count_after,
    cycle_number,
    request_id,
    note
  )
  values (
    p_customer_id,
    v_actor_id,
    'fifth_reward_redeemed',
    v_account.current_stamps,
    v_account.current_stamps,
    v_account.cycle_number,
    p_request_id,
    p_note
  );

  return v_account;
end;
$$;

create or replace function public.redeem_tenth_reward(
  p_customer_id uuid,
  p_request_id text,
  p_note text default null
)
returns public.loyalty_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid;
  v_account public.loyalty_accounts%rowtype;
  v_idempotent public.loyalty_accounts%rowtype;
  v_before integer;
  v_cycle integer;
begin
  v_actor_id := public.assert_staff_actor();
  perform public.assert_valid_request_id(p_request_id);

  v_idempotent := public.return_idempotent_account(
    p_request_id,
    'tenth_reward_redeemed',
    v_actor_id,
    p_customer_id
  );

  if v_idempotent.customer_id is not null then
    return v_idempotent;
  end if;

  perform public.resolve_loyalty_customer(p_customer_id, null);

  select * into v_account
  from public.loyalty_accounts
  where customer_id = p_customer_id
  for update;

  if not found then
    raise exception 'Loyalty account not found.';
  end if;

  if v_account.current_stamps <> 10
    or v_account.tenth_reward_status <> 'available'
  then
    raise exception 'The 50%% reward is not available.';
  end if;

  v_before := v_account.current_stamps;
  v_cycle := v_account.cycle_number;

  insert into public.loyalty_transactions (
    customer_id,
    staff_id,
    transaction_type,
    stamp_count_before,
    stamp_count_after,
    cycle_number,
    request_id,
    note
  )
  values (
    p_customer_id,
    v_actor_id,
    'tenth_reward_redeemed',
    v_before,
    0,
    v_cycle,
    p_request_id,
    p_note
  );

  update public.loyalty_accounts
  set
    current_stamps = 0,
    cycle_number = cycle_number + 1,
    fifth_reward_status = 'locked',
    tenth_reward_status = 'locked',
    version = version + 1,
    updated_at = now()
  where customer_id = p_customer_id
  returning * into v_account;

  return v_account;
end;
$$;

revoke execute on function public.normalize_profile_name(text, text) from public, anon, authenticated;
revoke execute on function public.safe_optional_birthday(text) from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.generate_member_code() from public, anon, authenticated;
revoke execute on function public.enforce_customer_profile() from public, anon, authenticated;
revoke execute on function public.enforce_transaction_participants() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.current_user_is_staff_or_admin() from public, anon;
revoke execute on function public.assert_staff_actor() from public, anon, authenticated;
revoke execute on function public.resolve_loyalty_customer(uuid, text) from public, anon, authenticated;
revoke execute on function public.assert_valid_request_id(text) from public, anon, authenticated;
revoke execute on function public.return_idempotent_account(text, public.loyalty_transaction_type, uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.update_profile(text, text, text) from public, anon;
revoke execute on function public.add_stamp(uuid, text, text, text, text) from public, anon;
revoke execute on function public.redeem_fifth_reward(uuid, text, text) from public, anon;
revoke execute on function public.redeem_tenth_reward(uuid, text, text) from public, anon;

grant execute on function public.current_user_is_staff_or_admin() to authenticated;
grant execute on function public.update_profile(text, text, text) to authenticated;
grant execute on function public.add_stamp(uuid, text, text, text, text) to authenticated;
grant execute on function public.redeem_fifth_reward(uuid, text, text) to authenticated;
grant execute on function public.redeem_tenth_reward(uuid, text, text) to authenticated;
