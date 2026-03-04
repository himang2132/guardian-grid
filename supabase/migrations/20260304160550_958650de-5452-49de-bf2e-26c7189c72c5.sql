
-- Fix: All policies must be PERMISSIVE for OR-based multi-role access

-- AMBULANCES
DROP POLICY IF EXISTS "Admin can manage ambulances" ON public.ambulances;
DROP POLICY IF EXISTS "Drivers see own ambulance" ON public.ambulances;
DROP POLICY IF EXISTS "Drivers can update own ambulance" ON public.ambulances;

CREATE POLICY "Admin can manage ambulances" ON public.ambulances AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Drivers see own ambulance" ON public.ambulances AS PERMISSIVE FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "Drivers can update own ambulance" ON public.ambulances AS PERMISSIVE FOR UPDATE TO authenticated USING (driver_id = auth.uid());

-- EMERGENCIES
DROP POLICY IF EXISTS "Admin sees all emergencies" ON public.emergencies;
DROP POLICY IF EXISTS "Admin can update emergencies" ON public.emergencies;
DROP POLICY IF EXISTS "Users can create emergencies" ON public.emergencies;
DROP POLICY IF EXISTS "Users see own emergencies" ON public.emergencies;
DROP POLICY IF EXISTS "Drivers see assigned emergencies" ON public.emergencies;
DROP POLICY IF EXISTS "Drivers can update emergencies" ON public.emergencies;

CREATE POLICY "Admin sees all emergencies" ON public.emergencies AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update emergencies" ON public.emergencies AS PERMISSIVE FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create emergencies" ON public.emergencies AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users see own emergencies" ON public.emergencies AS PERMISSIVE FOR SELECT TO authenticated USING (reported_by = auth.uid());
CREATE POLICY "Drivers see assigned emergencies" ON public.emergencies AS PERMISSIVE FOR SELECT TO authenticated USING (
  id IN (SELECT ea.emergency_id FROM emergency_assignments ea JOIN ambulances a ON ea.ambulance_id = a.id WHERE a.driver_id = auth.uid())
);
CREATE POLICY "Drivers can update emergencies" ON public.emergencies AS PERMISSIVE FOR UPDATE TO authenticated USING (
  id IN (SELECT ea.emergency_id FROM emergency_assignments ea JOIN ambulances a ON ea.ambulance_id = a.id WHERE a.driver_id = auth.uid())
);

-- EMERGENCY_ASSIGNMENTS
DROP POLICY IF EXISTS "Admin can create assignments" ON public.emergency_assignments;
DROP POLICY IF EXISTS "Admin sees all assignments" ON public.emergency_assignments;
DROP POLICY IF EXISTS "Drivers see own assignments" ON public.emergency_assignments;
DROP POLICY IF EXISTS "Drivers can update own assignments" ON public.emergency_assignments;
DROP POLICY IF EXISTS "Users see own emergency assignments" ON public.emergency_assignments;

CREATE POLICY "Admin can manage assignments" ON public.emergency_assignments AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Drivers see own assignments" ON public.emergency_assignments AS PERMISSIVE FOR SELECT TO authenticated USING (
  ambulance_id IN (SELECT id FROM ambulances WHERE driver_id = auth.uid())
);
CREATE POLICY "Drivers can update own assignments" ON public.emergency_assignments AS PERMISSIVE FOR UPDATE TO authenticated USING (
  ambulance_id IN (SELECT id FROM ambulances WHERE driver_id = auth.uid())
);
CREATE POLICY "Users see own emergency assignments" ON public.emergency_assignments AS PERMISSIVE FOR SELECT TO authenticated USING (
  emergency_id IN (SELECT id FROM emergencies WHERE reported_by = auth.uid())
);

-- USER_ROLES
DROP POLICY IF EXISTS "Admin can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;

CREATE POLICY "Admin can manage roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can read own role" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (user_id = auth.uid());
