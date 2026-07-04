-- Script para crear la tabla de agendamientos en Neon (PostgreSQL)
-- Base de datos: barberia

-- Crear tabla de agendamientos
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    correo VARCHAR(100),
    servicio VARCHAR(50) NOT NULL,
    fecha_cita DATE NOT NULL,
    hora_cita VARCHAR(10) NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente',
    notas TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_appointments_fecha ON appointments(fecha_cita);
CREATE INDEX IF NOT EXISTS idx_appointments_estado ON appointments(estado);
CREATE INDEX IF NOT EXISTS idx_appointments_telefono ON appointments(telefono);

-- Crear función para actualizar actualizado_en automáticamente
CREATE OR REPLACE FUNCTION actualizar_fecha_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear trigger para actualizar actualizado_en automáticamente
CREATE TRIGGER actualizar_appointments_fecha 
    BEFORE UPDATE ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION actualizar_fecha_modificacion();

-- Insertar algunos datos de ejemplo (opcional)
INSERT INTO appointments (nombre_completo, telefono, correo, servicio, fecha_cita, hora_cita) VALUES
('Juan Pérez', '+52 442 123 4567', 'juan@email.com', 'Corte Clásico', '2026-02-20', '10:00 AM'),
('María González', '+52 442 987 6543', 'maria@email.com', 'Paquete Completo', '2026-02-21', '2:30 PM'),
('Carlos López', '+52 442 555 0123', null, 'Arreglo de Barba', '2026-02-22', '11:00 AM');

-- Consulta para verificar que todo está funcionando
SELECT * FROM appointments ORDER BY creado_en DESC;