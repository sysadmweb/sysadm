CREATE TABLE public.manual_purchases (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  unit_value NUMERIC(10, 2) NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL,
  total_value NUMERIC(10, 2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_manual_purchases_updated_at
BEFORE UPDATE ON public.manual_purchases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
