-- Aplicar antes de iniciar esta versión. No modifica notas históricas.
CREATE TABLE IF NOT EXISTS inspecciones_cinco_s (
  id_inspeccion INT NOT NULL AUTO_INCREMENT,
  id_departamento INT NOT NULL,
  anio INT NOT NULL,
  mes INT NOT NULL,
  numero INT NOT NULL,
  fecha DATE NOT NULL,
  sucursal VARCHAR(100) NOT NULL,
  encargado VARCHAR(150) NOT NULL,
  id_usuario_inspector INT NOT NULL,
  inspector VARCHAR(255) NOT NULL,
  version_formato INT NOT NULL DEFAULT 1,
  puntos JSON NOT NULL,
  total INT NOT NULL,
  observaciones TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id_inspeccion),
  UNIQUE KEY uq_cinco_s_periodo_numero (id_departamento, anio, mes, numero),
  CONSTRAINT fk_cinco_s_departamento FOREIGN KEY (id_departamento) REFERENCES departamentos(id_departamento),
  CONSTRAINT ck_cinco_s_numero CHECK (numero IN (1,2)),
  CONSTRAINT ck_cinco_s_total CHECK (total BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
