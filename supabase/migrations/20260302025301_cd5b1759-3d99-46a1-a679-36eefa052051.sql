
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'driver', 'user');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile + user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Emergencies table
CREATE TABLE public.emergencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_phone TEXT,
  patient_node TEXT NOT NULL,
  case_type TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 5,
  response_time_min INTEGER NOT NULL DEFAULT 10,
  response_time_max INTEGER NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'accepted', 'in-progress', 'resolved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.emergencies ENABLE ROW LEVEL SECURITY;

-- Ambulances table
CREATE TABLE public.ambulances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  current_node TEXT NOT NULL DEFAULT 'N0',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'en-route', 'busy', 'offline')),
  cases_handled INTEGER NOT NULL DEFAULT 0,
  cases_rejected INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ambulances ENABLE ROW LEVEL SECURITY;

-- Emergency assignments
CREATE TABLE public.emergency_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_id UUID REFERENCES public.emergencies(id) ON DELETE CASCADE NOT NULL,
  ambulance_id UUID REFERENCES public.ambulances(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL DEFAULT 'pending' CHECK (action IN ('pending', 'accepted', 'rejected', 'passed')),
  route_data JSONB,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);
ALTER TABLE public.emergency_assignments ENABLE ROW LEVEL SECURITY;

-- Enable realtime for emergencies and assignments
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergencies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ambulances;

-- RLS Policies

-- Profiles: everyone can read, own can update
CREATE POLICY "Anyone can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles: admin can manage, users can read own
CREATE POLICY "Users can read own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Emergencies
CREATE POLICY "Admin sees all emergencies" ON public.emergencies FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users see own emergencies" ON public.emergencies FOR SELECT TO authenticated USING (reported_by = auth.uid());
CREATE POLICY "Drivers see assigned emergencies" ON public.emergencies FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'driver') AND id IN (
    SELECT ea.emergency_id FROM public.emergency_assignments ea
    JOIN public.ambulances a ON ea.ambulance_id = a.id
    WHERE a.driver_id = auth.uid()
  ));
CREATE POLICY "Users can create emergencies" ON public.emergencies FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'user'));
CREATE POLICY "Admin can update emergencies" ON public.emergencies FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- Ambulances
CREATE POLICY "Admin sees all ambulances" ON public.ambulances FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers see own ambulance" ON public.ambulances FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "Admin can manage ambulances" ON public.ambulances FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can update own ambulance" ON public.ambulances FOR UPDATE TO authenticated USING (driver_id = auth.uid());

-- Emergency assignments
CREATE POLICY "Admin sees all assignments" ON public.emergency_assignments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers see own assignments" ON public.emergency_assignments FOR SELECT TO authenticated 
  USING (ambulance_id IN (SELECT id FROM public.ambulances WHERE driver_id = auth.uid()));
CREATE POLICY "Users see own emergency assignments" ON public.emergency_assignments FOR SELECT TO authenticated 
  USING (emergency_id IN (SELECT id FROM public.emergencies WHERE reported_by = auth.uid()));
CREATE POLICY "Admin can create assignments" ON public.emergency_assignments FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can update own assignments" ON public.emergency_assignments FOR UPDATE TO authenticated 
  USING (ambulance_id IN (SELECT id FROM public.ambulances WHERE driver_id = auth.uid()));

-- Timestamp trigger for emergencies
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_emergencies_updated_at
  BEFORE UPDATE ON public.emergencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Insert default ambulances
INSERT INTO public.ambulances (name, current_node, status) VALUES
  ('AMB-101', 'N0', 'available'),
  ('AMB-102', 'N15', 'available'),
  ('AMB-103', 'N10', 'available'),
  ('AMB-104', 'N25', 'available');
