-- Renomear tabelas para nomes em Português (Brasil)
    DO $$
    BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'units') THEN
        EXECUTE 'ALTER TABLE public.units RENAME TO unidades';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'functions') THEN
        EXECUTE 'ALTER TABLE public.functions RENAME TO funcoes';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'accommodations') THEN
        EXECUTE 'ALTER TABLE public.accommodations RENAME TO alojamentos';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rooms') THEN
        EXECUTE 'ALTER TABLE public.rooms RENAME TO quartos';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employees') THEN
        EXECUTE 'ALTER TABLE public.employees RENAME TO funcionarios';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'statuses') THEN
        EXECUTE 'ALTER TABLE public.statuses RENAME TO status';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        EXECUTE 'ALTER TABLE public.users RENAME TO usuarios';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sessions') THEN
        EXECUTE 'ALTER TABLE public.sessions RENAME TO sessoes';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_log') THEN
        EXECUTE 'ALTER TABLE public.audit_log RENAME TO log_auditoria';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categories') THEN
        EXECUTE 'ALTER TABLE public.categories RENAME TO categorias';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'manual_purchases') THEN
        EXECUTE 'ALTER TABLE public.manual_purchases RENAME TO compras_manuais';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'work_logs') THEN
        EXECUTE 'ALTER TABLE public.work_logs RENAME TO registros_trabalho';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_movements') THEN
        EXECUTE 'ALTER TABLE public.product_movements RENAME TO movimentacoes_produto';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'products') THEN
        EXECUTE 'ALTER TABLE public.products RENAME TO produtos';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invoices') THEN
        EXECUTE 'ALTER TABLE public.invoices RENAME TO notas_fiscais';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invoice_items') THEN
        EXECUTE 'ALTER TABLE public.invoice_items RENAME TO itens_nota_fiscal';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_permissions') THEN
        EXECUTE 'ALTER TABLE public.user_permissions RENAME TO permissoes_usuario';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fuel_supplies') THEN
        EXECUTE 'ALTER TABLE public.fuel_supplies RENAME TO abastecimentos';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cleaners') THEN
        EXECUTE 'ALTER TABLE public.cleaners RENAME TO faxineiras';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mega_settings') THEN
        EXECUTE 'ALTER TABLE public.mega_settings RENAME TO configuracoes_mega';
    END IF;

    -- tabelas fora do schema public nesta base (se estiverem em public, também se aplicam)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inspections') THEN
        EXECUTE 'ALTER TABLE public.inspections RENAME TO inspecoes';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_units') THEN
        EXECUTE 'ALTER TABLE public.user_units RENAME TO usuarios_unidades';
    END IF;
    END $$;

    -- Atualizar visões/policies que referenciam nomes antigos (se necessário)
    -- As políticas RLS e índices permanecem associados após RENAME; renomeie manualmente se desejar padronizar nomes.
