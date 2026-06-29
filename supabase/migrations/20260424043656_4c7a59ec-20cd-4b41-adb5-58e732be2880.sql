
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('lc_user', 'mc_user', 'efb_user');
CREATE TYPE public.function_code AS ENUM ('iGV','iGT','oGV','oGT','ELD','EwA','BD');

-- =========================================================
-- ENTITIES (Local Committees)
-- =========================================================
CREATE TABLE public.entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.entities (name, code) VALUES
  ('Colombo Central','CC'),
  ('Colombo North','CN'),
  ('Colombo South','CS'),
  ('Kandy','KDY'),
  ('Jaffna','JFN'),
  ('USJ','USJ'),
  ('NSBM','NSBM'),
  ('Ruhuna','RUH'),
  ('Rajarata','RAJ'),
  ('SLIIT','SLIIT'),
  ('NIBM','NIBM');

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  entity_id UUID REFERENCES public.entities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- USER ROLES (separate table — security best practice)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SECURITY DEFINER HELPER FUNCTIONS (avoid RLS recursion)
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_entity(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT entity_id FROM public.profiles WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.can_read_entity(_user_id UUID, _entity_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'mc_user')
    OR public.has_role(_user_id, 'efb_user')
    OR (
      public.has_role(_user_id, 'lc_user')
      AND public.get_user_entity(_user_id) = _entity_id
    )
$$;

-- =========================================================
-- TIMESTAMP TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- AUTO-CREATE PROFILE + FIRST USER BECOMES MC ADMIN
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- RLS: PROFILES
-- =========================================================
CREATE POLICY "Users view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "MC views all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'mc_user'));

CREATE POLICY "EFB views all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'efb_user'));

CREATE POLICY "Users update own profile basic"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "MC updates any profile"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'mc_user'));

-- =========================================================
-- RLS: USER_ROLES (only MC can manage; users can see own)
-- =========================================================
CREATE POLICY "Users view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "MC views all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'mc_user'));

CREATE POLICY "MC inserts roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'mc_user'));

CREATE POLICY "MC updates roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'mc_user'));

CREATE POLICY "MC deletes roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'mc_user'));

-- =========================================================
-- RLS: ENTITIES (everyone authenticated can read; MC can manage)
-- =========================================================
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read entities"
ON public.entities FOR SELECT TO authenticated
USING (true);

CREATE POLICY "MC manage entities"
ON public.entities FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'mc_user'))
WITH CHECK (public.has_role(auth.uid(), 'mc_user'));

-- =========================================================
-- FINANCE TABLES
-- =========================================================
CREATE TABLE public.monthly_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  term TEXT,
  bank_balance NUMERIC,
  inflow NUMERIC,
  outflow NUMERIC,
  assets NUMERIC,
  liabilities NUMERIC,
  receivables NUMERIC,
  liquidity NUMERIC,
  equity NUMERIC,
  total_revenue NUMERIC,
  total_cost NUMERIC,
  npm NUMERIC,
  gpm NUMERIC,
  finance_health_index NUMERIC,
  finance_od_score NUMERIC,
  global_ranking INT,
  ap_ranking INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_id, period_month)
);

CREATE TABLE public.revenue_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  function_code public.function_code NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cost_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  function_code public.function_code NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.budget_actual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  function_code public.function_code,
  category TEXT NOT NULL,
  budget NUMERIC NOT NULL DEFAULT 0,
  actual NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  quarter TEXT,
  score NUMERIC,
  max_score NUMERIC,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.monthly_review (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pass / fail / pending
  remarks TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all finance tables
ALTER TABLE public.monthly_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_breakdown ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_actual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_review ENABLE ROW LEVEL SECURITY;

-- Generic policy generator: SELECT for all 3 roles, write for MC, audit_scores writable by EFB too
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'monthly_metrics','revenue_streams','cost_breakdown',
    'budget_actual','audit_scores','monthly_review'
  ])
  LOOP
    EXECUTE format($f$
      CREATE POLICY "Read by entity access" ON public.%I
      FOR SELECT TO authenticated
      USING (public.can_read_entity(auth.uid(), entity_id));
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "MC insert" ON public.%I
      FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'mc_user'));
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "MC update" ON public.%I
      FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'mc_user'));
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "MC delete" ON public.%I
      FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(), 'mc_user'));
    $f$, t);
  END LOOP;
END $$;

-- EFB can also write to audit_scores and monthly_review
CREATE POLICY "EFB insert audit" ON public.audit_scores
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'efb_user'));

CREATE POLICY "EFB update audit" ON public.audit_scores
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'efb_user'));

CREATE POLICY "EFB insert review" ON public.monthly_review
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'efb_user'));

CREATE POLICY "EFB update review" ON public.monthly_review
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'efb_user'));

-- Indexes
CREATE INDEX idx_metrics_entity_period ON public.monthly_metrics(entity_id, period_month);
CREATE INDEX idx_revenue_entity_period ON public.revenue_streams(entity_id, period_month);
CREATE INDEX idx_cost_entity_period ON public.cost_breakdown(entity_id, period_month);
CREATE INDEX idx_budget_entity_period ON public.budget_actual(entity_id, period_month);
CREATE INDEX idx_audit_entity_period ON public.audit_scores(entity_id, period_month);
CREATE INDEX idx_review_entity_period ON public.monthly_review(entity_id, period_month);
