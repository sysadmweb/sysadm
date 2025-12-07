CREATE TABLE IF NOT EXISTS product_movements (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    employee_id bigint REFERENCES employees(id),
    product_id bigint REFERENCES products(id),
    movement_date timestamp with time zone NOT NULL,
    quantity numeric NOT NULL,
    photo_url text,
    observation text,
    user_id bigint REFERENCES users(id),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);
