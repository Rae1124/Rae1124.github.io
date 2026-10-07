begin;
set local role service_role;
do $$
<<status_email_test>>
declare
  student_id uuid := gen_random_uuid();
  office_id uuid := gen_random_uuid();
  registrar_id uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
  documents_request_id uuid := gen_random_uuid();
  notice_id uuid;
  second_notice_id uuid;
begin
  assert not has_function_privilege('anon', 'public.update_request_status_with_notification(uuid,public.request_status,public.request_status,uuid,text)', 'execute');
  assert not has_function_privilege('authenticated', 'public.update_request_status_with_notification(uuid,public.request_status,public.request_status,uuid,text)', 'execute');
  assert has_function_privilege('service_role', 'public.update_request_status_with_notification(uuid,public.request_status,public.request_status,uuid,text)', 'execute');

  insert into public.users (id, username, email, first_name, last_name, password_hash, role)
  values
    (student_id, student_id::text, student_id::text || '@example.invalid', 'Test', 'Student', 'test-only', 'student'),
    (office_id, office_id::text, office_id::text || '@example.invalid', 'Test', 'Office', 'test-only', 'idoffice'),
    (registrar_id, registrar_id::text, registrar_id::text || '@example.invalid', 'Test', 'Registrar', 'test-only', 'registrar');
  insert into public.id_requests (id, application_no, student_user_id, reason, description, status)
  values
    (request_id, 'SMTP-TEST-' || request_id::text, student_id, 'Lost ID', 'Rollback-only integration check', 'Processing'),
    (documents_request_id, 'SMTP-TEST-' || documents_request_id::text, student_id, 'Lost ID', 'Rollback-only integration check', 'Under Review');

  notice_id := public.update_request_status_with_notification(request_id, 'Processing', 'Ready for Issuance', office_id, 'Collect at the ID Office.');
  assert (select status = 'Ready for Issuance' from public.id_requests where id = request_id);
  assert (select email_status = 'pending' and user_id = student_id and message like '%Collect at the ID Office.%' from public.notifications where id = notice_id);
  assert (select count(*) = 1 from public.application_status_history where application_status_history.request_id = status_email_test.request_id);
  second_notice_id := public.update_request_status_with_notification(request_id, 'Processing', 'Ready for Issuance', office_id, 'Duplicate retry');
  assert second_notice_id is null;
  assert (select count(*) = 1 from public.notifications where notifications.request_id = status_email_test.request_id);

  begin
    perform public.update_request_status_with_notification(request_id, 'Processing', 'Issued', office_id, 'Stale request');
    raise exception 'Expected concurrent-update rejection';
  exception when serialization_failure then null;
  end;
  begin
    perform public.update_request_status_with_notification(documents_request_id, 'Under Review', 'Documents Required', student_id, 'Unauthorized');
    raise exception 'Expected staff authorization rejection';
  exception when insufficient_privilege then null;
  end;
  assert (select status = 'Under Review' from public.id_requests where id = documents_request_id);

  notice_id := public.update_request_status_with_notification(documents_request_id, 'Under Review', 'Documents Required', registrar_id, 'Upload a clearer affidavit.');
  assert (select email_status = 'pending' and message like '%Upload a clearer affidavit.%' from public.notifications where id = notice_id);

  notice_id := public.update_request_status_with_notification(request_id, 'Ready for Issuance', 'Issued', office_id, 'Collected');
  assert (select email_status = 'not_requested' from public.notifications where id = notice_id);
  assert (select date_issued is not null and processed_by = office_id from public.id_requests where id = request_id);
end;
$$;
rollback;
