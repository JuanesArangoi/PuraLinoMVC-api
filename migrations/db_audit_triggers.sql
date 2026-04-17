-- ============================================================
-- AUDIT LOG A NIVEL DE BASE DE DATOS
-- Registra automáticamente INSERT, UPDATE, DELETE en todas las
-- tablas principales con fecha, hora, tabla, operación y datos.
-- ============================================================

-- 1. Crear tabla de auditoría de BD
CREATE TABLE IF NOT EXISTS db_changelog (
    id            BIGSERIAL PRIMARY KEY,
    table_name    VARCHAR(100)  NOT NULL,
    operation     VARCHAR(10)   NOT NULL,  -- INSERT, UPDATE, DELETE
    record_id     VARCHAR(40),
    old_data      JSONB,
    new_data      JSONB,
    changed_fields TEXT[],
    db_user       VARCHAR(100)  DEFAULT current_user,
    executed_at   TIMESTAMPTZ   DEFAULT now()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_changelog_table     ON db_changelog (table_name);
CREATE INDEX IF NOT EXISTS idx_changelog_operation ON db_changelog (operation);
CREATE INDEX IF NOT EXISTS idx_changelog_record    ON db_changelog (record_id);
CREATE INDEX IF NOT EXISTS idx_changelog_date      ON db_changelog (executed_at);

-- 2. Función trigger genérica
CREATE OR REPLACE FUNCTION fn_db_changelog()
RETURNS TRIGGER AS $$
DECLARE
    rec_id     VARCHAR(40);
    old_json   JSONB := NULL;
    new_json   JSONB := NULL;
    changed    TEXT[] := '{}';
    col        TEXT;
BEGIN
    -- Obtener el ID del registro
    IF TG_OP = 'DELETE' THEN
        rec_id   := OLD.id;
        old_json := to_jsonb(OLD);
    ELSIF TG_OP = 'INSERT' THEN
        rec_id   := NEW.id;
        new_json := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        rec_id   := NEW.id;
        old_json := to_jsonb(OLD);
        new_json := to_jsonb(NEW);
        -- Detectar campos que cambiaron
        FOR col IN SELECT key FROM jsonb_each(to_jsonb(NEW))
        LOOP
            IF (to_jsonb(OLD) ->> col) IS DISTINCT FROM (to_jsonb(NEW) ->> col) THEN
                changed := array_append(changed, col);
            END IF;
        END LOOP;
    END IF;

    INSERT INTO db_changelog (table_name, operation, record_id, old_data, new_data, changed_fields)
    VALUES (TG_TABLE_NAME, TG_OP, rec_id, old_json, new_json, changed);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear triggers para cada tabla
-- Macro: elimina trigger si existe y lo recrea

-- USERS
DROP TRIGGER IF EXISTS trg_changelog_users ON users;
CREATE TRIGGER trg_changelog_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- PRODUCTS
DROP TRIGGER IF EXISTS trg_changelog_products ON products;
CREATE TRIGGER trg_changelog_products
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- ORDERS
DROP TRIGGER IF EXISTS trg_changelog_orders ON orders;
CREATE TRIGGER trg_changelog_orders
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- PROMOTIONS
DROP TRIGGER IF EXISTS trg_changelog_promotions ON promotions;
CREATE TRIGGER trg_changelog_promotions
    AFTER INSERT OR UPDATE OR DELETE ON promotions
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- RETURNS
DROP TRIGGER IF EXISTS trg_changelog_returns ON returns;
CREATE TRIGGER trg_changelog_returns
    AFTER INSERT OR UPDATE OR DELETE ON returns
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- REVIEWS
DROP TRIGGER IF EXISTS trg_changelog_reviews ON reviews;
CREATE TRIGGER trg_changelog_reviews
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- WISHLISTS
DROP TRIGGER IF EXISTS trg_changelog_wishlists ON wishlists;
CREATE TRIGGER trg_changelog_wishlists
    AFTER INSERT OR UPDATE OR DELETE ON wishlists
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- COUPONS
DROP TRIGGER IF EXISTS trg_changelog_coupons ON coupons;
CREATE TRIGGER trg_changelog_coupons
    AFTER INSERT OR UPDATE OR DELETE ON coupons
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- GIFT CARDS
DROP TRIGGER IF EXISTS trg_changelog_gift_cards ON gift_cards;
CREATE TRIGGER trg_changelog_gift_cards
    AFTER INSERT OR UPDATE OR DELETE ON gift_cards
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- SUPPLIERS
DROP TRIGGER IF EXISTS trg_changelog_suppliers ON suppliers;
CREATE TRIGGER trg_changelog_suppliers
    AFTER INSERT OR UPDATE OR DELETE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- WAREHOUSES
DROP TRIGGER IF EXISTS trg_changelog_warehouses ON warehouses;
CREATE TRIGGER trg_changelog_warehouses
    AFTER INSERT OR UPDATE OR DELETE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- PURCHASE ORDERS
DROP TRIGGER IF EXISTS trg_changelog_purchase_orders ON purchase_orders;
CREATE TRIGGER trg_changelog_purchase_orders
    AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- STOCK MOVEMENTS
DROP TRIGGER IF EXISTS trg_changelog_stock_movements ON stock_movements;
CREATE TRIGGER trg_changelog_stock_movements
    AFTER INSERT OR UPDATE OR DELETE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- SETTINGS
DROP TRIGGER IF EXISTS trg_changelog_settings ON settings;
CREATE TRIGGER trg_changelog_settings
    AFTER INSERT OR UPDATE OR DELETE ON settings
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- BACKLOG ITEMS
DROP TRIGGER IF EXISTS trg_changelog_backlog_items ON backlog_items;
CREATE TRIGGER trg_changelog_backlog_items
    AFTER INSERT OR UPDATE OR DELETE ON backlog_items
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- AUDIT LOGS (meta-auditoría)
DROP TRIGGER IF EXISTS trg_changelog_audit_logs ON audit_logs;
CREATE TRIGGER trg_changelog_audit_logs
    AFTER INSERT OR UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_db_changelog();

-- ============================================================
-- CONSULTAS ÚTILES
-- ============================================================
-- Ver últimos 50 cambios:
--   SELECT id, table_name, operation, record_id, changed_fields, executed_at
--   FROM db_changelog ORDER BY executed_at DESC LIMIT 50;
--
-- Filtrar por tabla:
--   SELECT * FROM db_changelog WHERE table_name = 'products' ORDER BY executed_at DESC;
--
-- Filtrar por operación:
--   SELECT * FROM db_changelog WHERE operation = 'UPDATE' ORDER BY executed_at DESC;
--
-- Ver cambios de un registro específico:
--   SELECT * FROM db_changelog WHERE record_id = 'uuid-aqui' ORDER BY executed_at;
-- ============================================================
