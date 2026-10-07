alter table public.notifications
  add column if not exists email_attempts integer not null default 0,
  add column if not exists email_attempted_at timestamptz,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error_code text;

create or replace function public.update_request_status_with_notification(
  target_request_id uuid,
  expected_status public.request_status,
  next_status public.request_status,
  actor_id uuid,
  status_remarks text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_request public.id_requests%rowtype;
  staff_role public.user_role;
  notification_id uuid;
begin
  select role into staff_role from public.users
  where id = actor_id and active = true;
  if staff_role is null or staff_role not in ('registrar', 'idoffice', 'admin') then
    raise exception 'Staff authorization required' using errcode = '42501';
  end if;

  select * into current_request from public.id_requests
  where id = target_request_id for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if current_request.status = next_status then return null; end if;
  if current_request.status <> expected_status then
    raise exception 'Application changed' using errcode = '40001';
  end if;
  if staff_role = 'registrar' and not (
    (next_status = 'Under Review' and current_request.status = 'Submitted') or
    (next_status = 'Documents Required' and current_request.status in ('Submitted', 'Under Review')) or
    (next_status in ('Approved', 'Rejected') and current_request.status in ('Under Review', 'Documents Required'))
  ) then
    raise exception 'Registrar transition not allowed' using errcode = '42501';
  end if;
  if staff_role = 'idoffice' and not (
    (next_status = 'Processing' and current_request.status = 'Approved') or
    (next_status = 'Ready for Issuance' and current_request.status = 'Processing') or
    (next_status = 'Issued' and current_request.status = 'Ready for Issuance')
  ) then
    raise exception 'ID Office transition not allowed' using errcode = '42501';
  end if;

  -- The status, history, and email record commit together before SMTP is attempted.
  update public.id_requests set
    status = next_status,
    updated_at = now(),
    registrar_remarks = case when staff_role = 'registrar' then status_remarks else registrar_remarks end,
    id_office_remarks = case when staff_role = 'idoffice' then status_remarks else id_office_remarks end,
    date_issued = case when next_status = 'Issued' then now() else date_issued end,
    processed_by = case when next_status = 'Issued' then actor_id else processed_by end
  where id = target_request_id;

  insert into public.application_status_history (request_id, status, remarks, actor_user_id, actor_role)
  values (target_request_id, next_status, status_remarks, actor_id, staff_role);

  insert into public.notifications (user_id, request_id, title, message, email_status)
  values (
    current_request.student_user_id,
    target_request_id,
    'Application ' || next_status::text,
    current_request.application_no || ' is now ' || next_status::text || '. ' || status_remarks,
    case when next_status in ('Ready for Issuance', 'Documents Required') then 'pending' else 'not_requested' end
  ) returning id into notification_id;
  return notification_id;
end;
$$;

revoke all on function public.update_request_status_with_notification(uuid, public.request_status, public.request_status, uuid, text)
  from public, anon, authenticated;
grant execute on function public.update_request_status_with_notification(uuid, public.request_status, public.request_status, uuid, text)
  to service_role;
