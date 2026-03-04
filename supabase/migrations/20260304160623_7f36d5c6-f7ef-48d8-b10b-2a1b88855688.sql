
-- Fix infinite recursion: use security definer functions to break circular RLS dependency

-- Helper: check if user reported this emergency
CREATE OR REPLACE FUNCTION public.is_emergency_reporter(_user_id uuid, _emergency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.emergencies
    WHERE id = _emergency_id AND reported_by = _user_id
  )
$$;

-- Helper: check if driver is assigned to this emergency via ambulance
CREATE OR REPLACE FUNCTION public.is_driver_assigned_emergency(_user_id uuid, _emergency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.emergency_assignments ea
    JOIN public.ambulances a ON ea.ambulance_id = a.id
    WHERE ea.emergency_id = _emergency_id AND a.driver_id = _user_id
  )
$$;

-- Helper: check if driver owns this ambulance
CREATE OR REPLACE FUNCTION public.is_driver_ambulance(_user_id uuid, _ambulance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ambulances
    WHERE id = _ambulance_id AND driver_id = _user_id
  )
$$;

-- Now recreate policies using these functions

-- EMERGENCIES: drop and recreate
DROP POLICY IF EXISTS "Admin sees all emergencies" ON public.emergencies;
DROP POLICY IF EXISTS "Admin can update emergencies" ON public.emergencies;
DROP POLICY IF EXISTS "Users can create emergencies" ON public.emergencies;
DROP POLICY IF EXISTS "Users see own emergencies" ON public.emergencies;
DROP POLICY IF EXISTS "Drivers see assigned emergencies" ON public.emergencies;
DROP POLICY IF EXISTS "Drivers can update emergencies" ON public.emergencies;

CREATE POLICY "Admin sees all emergencies" ON public.emergencies AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update emergencies" ON public.emergencies AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create emergencies" ON public.emergencies AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users see own emergencies" ON public.emergencies AS PERMISSIVE FOR SELECT TO authenticated
  USING (reported_by = auth.uid());
CREATE POLICY "Drivers see assigned emergencies" ON public.emergencies AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_driver_assigned_emergency(auth.uid(), id));
CREATE POLICY "Drivers can update emergencies" ON public.emergencies AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_driver_assigned_emergency(auth.uid(), id));

-- EMERGENCY_ASSIGNMENTS: drop and recreate
DROP POLICY IF EXISTS "Admin can manage assignments" ON public.emergency_assignments;
DROP POLICY IF EXISTS "Drivers see own assignments" ON public.emergency_assignments;
DROP POLICY IF EXISTS "Drivers can update own assignments" ON public.emergency_assignments;
DROP POLICY IF EXISTS "Users see own emergency assignments" ON public.emergency_assignments;

CREATE POLICY "Admin can manage assignments" ON public.emergency_assignments AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Drivers see own assignments" ON public.emergency_assignments AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_driver_ambulance(auth.uid(), ambulance_id));
CREATE POLICY "Drivers can update own assignments" ON public.emergency_assignments AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_driver_ambulance(auth.uid(), ambulance_id));
CREATE POLICY "Users see own emergency assignments" ON public.emergency_assignments AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_emergency_reporter(auth.uid(), emergency_id));
