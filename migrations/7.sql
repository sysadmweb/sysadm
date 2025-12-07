-- Add return_date column
ALTER TABLE product_movements ADD COLUMN IF NOT EXISTS return_date timestamp with time zone;

-- Function to register movement and decrease stock
CREATE OR REPLACE FUNCTION register_movement(
    p_employee_id bigint,
    p_product_id bigint,
    p_movement_date timestamp with time zone,
    p_quantity numeric,
    p_observation text,
    p_photo_url text,
    p_user_id bigint
) RETURNS json AS $$
DECLARE
    v_current_stock numeric;
    v_movement_id bigint;
BEGIN
    -- Check current stock
    SELECT quantity INTO v_current_stock FROM products WHERE id = p_product_id;
    
    IF v_current_stock < p_quantity THEN
        RAISE EXCEPTION 'Estoque insuficiente. Disponível: %, Solicitado: %', v_current_stock, p_quantity;
    END IF;

    -- Insert movement
    INSERT INTO product_movements (
        employee_id, product_id, movement_date, quantity, observation, photo_url, user_id, is_active
    ) VALUES (
        p_employee_id, p_product_id, p_movement_date, p_quantity, p_observation, p_photo_url, p_user_id, true
    ) RETURNING id INTO v_movement_id;

    -- Decrease stock
    UPDATE products SET quantity = quantity - p_quantity WHERE id = p_product_id;

    RETURN json_build_object('id', v_movement_id);
END;
$$ LANGUAGE plpgsql;

-- Function to return movement and increase stock
CREATE OR REPLACE FUNCTION return_movement(
    p_movement_id bigint,
    p_return_date timestamp with time zone
) RETURNS void AS $$
DECLARE
    v_product_id bigint;
    v_quantity numeric;
    v_already_returned timestamp with time zone;
BEGIN
    -- Get movement details
    SELECT product_id, quantity, return_date INTO v_product_id, v_quantity, v_already_returned
    FROM product_movements WHERE id = p_movement_id;

    IF v_already_returned IS NOT NULL THEN
        RAISE EXCEPTION 'Item já devolvido em %', v_already_returned;
    END IF;

    -- Update movement
    UPDATE product_movements SET return_date = p_return_date WHERE id = p_movement_id;

    -- Increase stock
    UPDATE products SET quantity = quantity + v_quantity WHERE id = v_product_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update movement (handle quantity changes)
CREATE OR REPLACE FUNCTION update_movement(
    p_movement_id bigint,
    p_employee_id bigint,
    p_product_id bigint,
    p_movement_date timestamp with time zone,
    p_quantity numeric,
    p_observation text,
    p_photo_url text,
    p_user_id bigint
) RETURNS void AS $$
DECLARE
    v_old_quantity numeric;
    v_old_product_id bigint;
    v_current_stock numeric;
BEGIN
    -- Get old details
    SELECT quantity, product_id INTO v_old_quantity, v_old_product_id
    FROM product_movements WHERE id = p_movement_id;

    -- If product changed
    IF v_old_product_id != p_product_id THEN
        -- Restore stock of old product
        UPDATE products SET quantity = quantity + v_old_quantity WHERE id = v_old_product_id;
        
        -- Check stock of new product
        SELECT quantity INTO v_current_stock FROM products WHERE id = p_product_id;
        IF v_current_stock < p_quantity THEN
             RAISE EXCEPTION 'Estoque insuficiente para o novo produto. Disponível: %, Solicitado: %', v_current_stock, p_quantity;
        END IF;
        
        -- Decrease stock of new product
        UPDATE products SET quantity = quantity - p_quantity WHERE id = p_product_id;
    ELSE
        -- Same product, adjust difference
        DECLARE
            v_diff numeric := p_quantity - v_old_quantity;
        BEGIN
            IF v_diff > 0 THEN
                SELECT quantity INTO v_current_stock FROM products WHERE id = p_product_id;
                IF v_current_stock < v_diff THEN
                    RAISE EXCEPTION 'Estoque insuficiente para o aumento. Disponível: %, Necessário extra: %', v_current_stock, v_diff;
                END IF;
            END IF;
            
            UPDATE products SET quantity = quantity - v_diff WHERE id = p_product_id;
        END;
    END IF;

    -- Update movement record
    UPDATE product_movements SET
        employee_id = p_employee_id,
        product_id = p_product_id,
        movement_date = p_movement_date,
        quantity = p_quantity,
        observation = p_observation,
        photo_url = COALESCE(p_photo_url, photo_url), -- Keep old if null passed (or handle in frontend)
        user_id = p_user_id
    WHERE id = p_movement_id;
END;
$$ LANGUAGE plpgsql;
