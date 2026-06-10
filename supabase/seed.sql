-- ============================================================
-- SEED DATA - Ejecutar DESPUÉS de schema.sql
-- ============================================================
-- Planes Claro (Cotización Febrero 2026)
INSERT INTO planes_claro (
        nombre,
        tipo,
        precio_mensual,
        datos_gb,
        descripcion
    )
VALUES (
        'Flota Libre',
        'Libre',
        260,
        NULL,
        'Solo llamadas y SMS corporativo'
    ),
    (
        'Internet Flota Apps 10GB',
        'Apps',
        1695,
        10,
        '10GB datos + Bono 5GB'
    ),
    (
        'Internet Flota Apps 15GB',
        'Apps',
        1995,
        15,
        '15GB datos + Bono 5GB'
    ),
    (
        'Internet Flota Apps 25GB',
        'Apps',
        2195,
        25,
        '25GB datos premium'
    ),
    (
        'Internet Flota Apps 50GB',
        'Apps',
        4295,
        50,
        '50GB datos alto consumo'
    ),
    (
        'Internet Flota Bloqueo 2GB',
        'Bloqueo',
        645,
        2,
        '2GB + Bono 1GB, restricciones de apps'
    ),
    (
        'Internet Flota Bloqueo 5GB',
        'Bloqueo',
        795,
        5,
        '5GB + Bono 2GB, restricciones de apps'
    ),
    (
        'Internet Flota Bloqueo 10GB',
        'Bloqueo',
        1295,
        10,
        '10GB + Bono 5GB, restricciones de apps'
    ),
    (
        'Internet Flota Bloqueo 15GB',
        'Bloqueo',
        1395,
        15,
        '15GB + Bono 5GB, restricciones de apps'
    );
-- Catálogo Dispositivos (datos reales de PDFs Claro Enero 2026)
-- Solo los DESTACADOS (visibles a usuarios) + resto disponibles para admin
INSERT INTO catalogo_dispositivos (
        modelo,
        categoria,
        precio_rd,
        pantalla,
        ram,
        almacenamiento,
        camara,
        bateria,
        disponible,
        destacado
    )
VALUES -- BÁSICOS
    (
        'Motorola G06 128GB',
        'Basico',
        6495,
        '6.5"',
        '4GB',
        '128GB',
        '16MP',
        '5000mAh',
        true,
        true
    ),
    (
        'Samsung A07 LTE 128GB',
        'Basico',
        8395,
        '6.7" HD+',
        '4GB',
        '128GB',
        '50MP',
        '5000mAh',
        true,
        false
    ),
    (
        'Honor X5c 128GB',
        'Basico',
        6000,
        '6.74" 90Hz',
        '4GB',
        '128GB',
        '50MP',
        '5230mAh',
        true,
        false
    ),
    -- MID-RANGE
    (
        'Samsung A25 5G 256GB',
        'Mid-range',
        20295,
        '6.5" AMOLED',
        '8GB',
        '256GB',
        '50MP',
        '5000mAh',
        true,
        true
    ),
    (
        'Motorola G56 5G 256GB',
        'Mid-range',
        17995,
        '6.5"',
        '8GB',
        '256GB',
        '50MP',
        '5000mAh',
        true,
        true
    ),
    (
        'Honor 400 Lite 5G',
        'Mid-range',
        16095,
        '6.7"',
        '8GB',
        '256GB',
        '108MP',
        '4500mAh',
        true,
        true
    ),
    (
        'Samsung A56 5G 256GB',
        'Mid-range',
        32395,
        '6.7" AMOLED',
        '8GB',
        '256GB',
        '50MP',
        '5000mAh',
        true,
        false
    ),
    -- PREMIUM
    (
        'iPhone 17 256GB',
        'Premium',
        72395,
        '6.1" OLED',
        '8GB',
        '256GB',
        '48MP',
        '3800mAh',
        true,
        true
    ),
    (
        'Samsung S25 Ultra 512GB',
        'Premium',
        93095,
        '6.9" Dynamic AMOLED',
        '12GB',
        '512GB',
        '200MP',
        '5000mAh',
        true,
        false
    ),
    (
        'iPhone 17 Pro Max 256GB',
        'Premium',
        108495,
        '6.9" Super Retina',
        '8GB',
        '256GB',
        '48MP',
        '4500mAh',
        true,
        false
    ),
    (
        'Motorola Edge 50 Pro',
        'Premium',
        50000,
        '6.67" 1.5K pOLED',
        '12GB',
        '512GB',
        '50MP',
        '4500mAh',
        true,
        false
    );
-- Nota: Los dispositivos con destacado=true son los 5 que se muestran a usuarios
-- Admin puede cambiar cuáles están destacados desde el panel