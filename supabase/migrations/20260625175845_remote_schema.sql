drop extension if exists "pg_net";

alter type "public"."function_code" rename to "function_code__old_version_to_be_dropped";

create type "public"."function_code" as enum ('iGV', 'iGT', 'oGV', 'oGT', 'ELD', 'EwA', 'BD', 'iGTa', 'iGTe', 'oGTa', 'oGTe', 'Conference', 'NMF', 'Miscellaneous', 'National Conference Delegation');

alter table "public"."budget_actual" alter column function_code type "public"."function_code" using function_code::text::"public"."function_code";

alter table "public"."cost_breakdown" alter column function_code type "public"."function_code" using function_code::text::"public"."function_code";

alter table "public"."revenue_streams" alter column function_code type "public"."function_code" using function_code::text::"public"."function_code";

drop type "public"."function_code__old_version_to_be_dropped";

alter table "public"."monthly_metrics" add column "petty_cash" numeric default 0;

alter table "public"."monthly_metrics" add column "reserves" numeric default 0;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.can_read_entity(_user_id uuid, _entity_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(_user_id, 'mc_user')
    OR public.has_role(_user_id, 'efb_user')
    OR (
      public.has_role(_user_id, 'lc_user')
      AND public.get_user_entity(_user_id) = _entity_id
    )
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_entity(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT entity_id FROM public.profiles WHERE user_id = _user_id
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'mc_user');
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."audit_scores" to "anon";

grant insert on table "public"."audit_scores" to "anon";

grant select on table "public"."audit_scores" to "anon";

grant update on table "public"."audit_scores" to "anon";

grant delete on table "public"."audit_scores" to "authenticated";

grant insert on table "public"."audit_scores" to "authenticated";

grant select on table "public"."audit_scores" to "authenticated";

grant update on table "public"."audit_scores" to "authenticated";

grant delete on table "public"."audit_scores" to "service_role";

grant insert on table "public"."audit_scores" to "service_role";

grant select on table "public"."audit_scores" to "service_role";

grant update on table "public"."audit_scores" to "service_role";

grant delete on table "public"."budget_actual" to "anon";

grant insert on table "public"."budget_actual" to "anon";

grant select on table "public"."budget_actual" to "anon";

grant update on table "public"."budget_actual" to "anon";

grant delete on table "public"."budget_actual" to "authenticated";

grant insert on table "public"."budget_actual" to "authenticated";

grant select on table "public"."budget_actual" to "authenticated";

grant update on table "public"."budget_actual" to "authenticated";

grant delete on table "public"."budget_actual" to "service_role";

grant insert on table "public"."budget_actual" to "service_role";

grant select on table "public"."budget_actual" to "service_role";

grant update on table "public"."budget_actual" to "service_role";

grant delete on table "public"."cost_breakdown" to "anon";

grant insert on table "public"."cost_breakdown" to "anon";

grant select on table "public"."cost_breakdown" to "anon";

grant update on table "public"."cost_breakdown" to "anon";

grant delete on table "public"."cost_breakdown" to "authenticated";

grant insert on table "public"."cost_breakdown" to "authenticated";

grant select on table "public"."cost_breakdown" to "authenticated";

grant update on table "public"."cost_breakdown" to "authenticated";

grant delete on table "public"."cost_breakdown" to "service_role";

grant insert on table "public"."cost_breakdown" to "service_role";

grant select on table "public"."cost_breakdown" to "service_role";

grant update on table "public"."cost_breakdown" to "service_role";

grant delete on table "public"."entities" to "anon";

grant insert on table "public"."entities" to "anon";

grant select on table "public"."entities" to "anon";

grant update on table "public"."entities" to "anon";

grant delete on table "public"."entities" to "authenticated";

grant insert on table "public"."entities" to "authenticated";

grant select on table "public"."entities" to "authenticated";

grant update on table "public"."entities" to "authenticated";

grant delete on table "public"."entities" to "service_role";

grant insert on table "public"."entities" to "service_role";

grant select on table "public"."entities" to "service_role";

grant update on table "public"."entities" to "service_role";

grant delete on table "public"."monthly_metrics" to "anon";

grant insert on table "public"."monthly_metrics" to "anon";

grant select on table "public"."monthly_metrics" to "anon";

grant update on table "public"."monthly_metrics" to "anon";

grant delete on table "public"."monthly_metrics" to "authenticated";

grant insert on table "public"."monthly_metrics" to "authenticated";

grant select on table "public"."monthly_metrics" to "authenticated";

grant update on table "public"."monthly_metrics" to "authenticated";

grant delete on table "public"."monthly_metrics" to "service_role";

grant insert on table "public"."monthly_metrics" to "service_role";

grant select on table "public"."monthly_metrics" to "service_role";

grant update on table "public"."monthly_metrics" to "service_role";

grant delete on table "public"."monthly_review" to "anon";

grant insert on table "public"."monthly_review" to "anon";

grant select on table "public"."monthly_review" to "anon";

grant update on table "public"."monthly_review" to "anon";

grant delete on table "public"."monthly_review" to "authenticated";

grant insert on table "public"."monthly_review" to "authenticated";

grant select on table "public"."monthly_review" to "authenticated";

grant update on table "public"."monthly_review" to "authenticated";

grant delete on table "public"."monthly_review" to "service_role";

grant insert on table "public"."monthly_review" to "service_role";

grant select on table "public"."monthly_review" to "service_role";

grant update on table "public"."monthly_review" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."revenue_streams" to "anon";

grant insert on table "public"."revenue_streams" to "anon";

grant select on table "public"."revenue_streams" to "anon";

grant update on table "public"."revenue_streams" to "anon";

grant delete on table "public"."revenue_streams" to "authenticated";

grant insert on table "public"."revenue_streams" to "authenticated";

grant select on table "public"."revenue_streams" to "authenticated";

grant update on table "public"."revenue_streams" to "authenticated";

grant delete on table "public"."revenue_streams" to "service_role";

grant insert on table "public"."revenue_streams" to "service_role";

grant select on table "public"."revenue_streams" to "service_role";

grant update on table "public"."revenue_streams" to "service_role";

grant delete on table "public"."user_roles" to "anon";

grant insert on table "public"."user_roles" to "anon";

grant select on table "public"."user_roles" to "anon";

grant update on table "public"."user_roles" to "anon";

grant delete on table "public"."user_roles" to "authenticated";

grant insert on table "public"."user_roles" to "authenticated";

grant select on table "public"."user_roles" to "authenticated";

grant update on table "public"."user_roles" to "authenticated";

grant delete on table "public"."user_roles" to "service_role";

grant insert on table "public"."user_roles" to "service_role";

grant select on table "public"."user_roles" to "service_role";

grant update on table "public"."user_roles" to "service_role";


