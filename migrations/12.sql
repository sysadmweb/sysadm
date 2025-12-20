-- Create table for storing MEGA settings
CREATE TABLE IF NOT EXISTS public.mega_settings (
    id SERIAL PRIMARY KEY,
    mega_email TEXT NOT NULL,
    mega_password TEXT NOT NULL, -- Will store encrypted or plain text depending on implementation layer
    root_folder_name TEXT NOT NULL DEFAULT 'Sisadm2_Abastecimentos',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for Fuel Supplies
CREATE TABLE IF NOT EXISTS public.fuel_supplies (
    id SERIAL PRIMARY KEY,
    supply_date DATE NOT NULL,
    km_photo_url TEXT,
    plate_photo_url TEXT,
    receipt_photo_url TEXT,
    unit_id INTEGER NOT NULL REFERENCES public.units(id),
    user_id INTEGER REFERENCES public.users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add permissions for the new module
INSERT INTO public.permissions (screen_key, can_view, can_create, can_edit, can_delete)
VALUES ('fuel_supply', true, true, true, true)
ON CONFLICT (screen_key) DO NOTHING;

-- Enable RLS for new tables
ALTER TABLE public.mega_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_supplies ENABLE ROW LEVEL SECURITY;

-- Policies for mega_settings (only admins should see/edit this ideally, but for now authenticated users)
CREATE POLICY "Authenticated users can view mega settings" ON public.mega_settings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert mega settings" ON public.mega_settings
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update mega settings" ON public.mega_settings
    FOR UPDATE TO authenticated USING (true);

-- Policies for fuel_supplies
CREATE POLICY "Authenticated users can view fuel supplies" ON public.fuel_supplies
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert fuel supplies" ON public.fuel_supplies
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update fuel supplies" ON public.fuel_supplies
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete fuel supplies" ON public.fuel_supplies
    FOR DELETE TO authenticated USING (true);
