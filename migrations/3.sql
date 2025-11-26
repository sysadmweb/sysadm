CREATE TABLE public.work_logs (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  entry_time_1 TIME,
  exit_time_1 TIME,
  entry_time_2 TIME,
  exit_time_2 TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_work_logs_updated_at
BEFORE UPDATE ON public.work_logs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX work_logs_employee_id_idx ON public.work_logs (employee_id);
CREATE INDEX work_logs_work_date_idx ON public.work_logs (work_date);
