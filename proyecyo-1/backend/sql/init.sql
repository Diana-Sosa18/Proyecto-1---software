CREATE DATABASE IF NOT EXISTS nexus_residencial;
USE nexus_residencial;

DROP TABLE IF EXISTS COMUNICADO_USUARIO;
DROP TABLE IF EXISTS TIPO_USUARIO_PERMISO;
DROP TABLE IF EXISTS RESERVA;
DROP TABLE IF EXISTS REGISTRO_ACCESO;
DROP TABLE IF EXISTS ACCESO;
DROP TABLE IF EXISTS VISITANTE;
DROP TABLE IF EXISTS PAGO;
DROP TABLE IF EXISTS CUOTA;
DROP TABLE IF EXISTS CASA_SERVICIO;
DROP TABLE IF EXISTS SERVICIO;
DROP TABLE IF EXISTS INQUILINO_CASA;
DROP TABLE IF EXISTS CASA;
DROP TABLE IF EXISTS INQUILINO;
DROP TABLE IF EXISTS RESIDENTE;
DROP TABLE IF EXISTS TICKET;
DROP TABLE IF EXISTS COMUNICADO;
DROP TABLE IF EXISTS PERMISO;
DROP TABLE IF EXISTS USUARIO;
DROP TABLE IF EXISTS TIPO_USUARIO;
DROP TABLE IF EXISTS AMENIDAD;
DROP TABLE IF EXISTS CONFIGURACION;

CREATE TABLE TIPO_USUARIO (
    id_tipo_usuario INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE PERMISO (
    id_permiso INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE TIPO_USUARIO_PERMISO (
    id_tipo_usuario INT,
    id_permiso INT,
    PRIMARY KEY (id_tipo_usuario, id_permiso),
    FOREIGN KEY (id_tipo_usuario) REFERENCES TIPO_USUARIO(id_tipo_usuario),
    FOREIGN KEY (id_permiso) REFERENCES PERMISO(id_permiso)
);

CREATE TABLE USUARIO (
    id_usuario INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    dpi VARCHAR(20) UNIQUE NOT NULL,
    correo VARCHAR(100) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    id_tipo_usuario INT NOT NULL,
    FOREIGN KEY (id_tipo_usuario) REFERENCES TIPO_USUARIO(id_tipo_usuario)
);

CREATE TABLE RESIDENTE (
    id_residente INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT UNIQUE NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
);

CREATE TABLE INQUILINO (
    id_inquilino INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT UNIQUE NOT NULL,
    autorizado BOOLEAN,
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
);

CREATE TABLE CASA (
    id_casa INT PRIMARY KEY AUTO_INCREMENT,
    numero VARCHAR(10) NOT NULL,
    torre VARCHAR(10),
    id_residente INT NOT NULL,
    FOREIGN KEY (id_residente) REFERENCES RESIDENTE(id_residente)
);

CREATE TABLE INQUILINO_CASA (
    id_inquilino INT,
    id_casa INT,
    PRIMARY KEY (id_inquilino, id_casa),
    FOREIGN KEY (id_inquilino) REFERENCES INQUILINO(id_inquilino),
    FOREIGN KEY (id_casa) REFERENCES CASA(id_casa)
);

CREATE TABLE SERVICIO (
    id_servicio INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE CASA_SERVICIO (
    id_casa INT,
    id_servicio INT,
    PRIMARY KEY (id_casa, id_servicio),
    FOREIGN KEY (id_casa) REFERENCES CASA(id_casa),
    FOREIGN KEY (id_servicio) REFERENCES SERVICIO(id_servicio)
);

CREATE TABLE CUOTA (
    id_cuota INT PRIMARY KEY AUTO_INCREMENT,
    id_servicio INT NOT NULL,
    id_casa INT NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    fecha_limite DATE NOT NULL,
    FOREIGN KEY (id_servicio) REFERENCES SERVICIO(id_servicio),
    FOREIGN KEY (id_casa) REFERENCES CASA(id_casa)
);

CREATE TABLE PAGO (
    id_pago INT PRIMARY KEY AUTO_INCREMENT,
    id_cuota INT NOT NULL,
    monto_pagado DECIMAL(10,2) NOT NULL,
    fecha_pago DATE,
    FOREIGN KEY (id_cuota) REFERENCES CUOTA(id_cuota)
);

CREATE TABLE VISITANTE (
    id_visitante INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    dpi VARCHAR(20),
    placa VARCHAR(20)
);

CREATE TABLE ACCESO (
    id_acceso INT PRIMARY KEY AUTO_INCREMENT,
    id_visitante INT NOT NULL,
    id_casa INT NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME,
    hora_fin TIME,
    tipo_visita VARCHAR(20),
    FOREIGN KEY (id_visitante) REFERENCES VISITANTE(id_visitante),
    FOREIGN KEY (id_casa) REFERENCES CASA(id_casa),
    CHECK (tipo_visita IN ('VISITA', 'DELIVERY', 'PROVEEDOR'))
);

CREATE TABLE REGISTRO_ACCESO (
    id_registro INT PRIMARY KEY AUTO_INCREMENT,
    id_acceso INT UNIQUE NOT NULL,
    hora_ingreso TIME,
    hora_salida TIME,
    FOREIGN KEY (id_acceso) REFERENCES ACCESO(id_acceso)
);

CREATE TABLE AMENIDAD (
    id_amenidad INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE RESERVA (
    id_usuario INT,
    id_amenidad INT,
    fecha DATE,
    hora_inicio TIME,
    hora_fin TIME,
    PRIMARY KEY (id_usuario, id_amenidad, fecha, hora_inicio),
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
    FOREIGN KEY (id_amenidad) REFERENCES AMENIDAD(id_amenidad)
);

CREATE TABLE COMUNICADO (
    id_comunicado INT PRIMARY KEY AUTO_INCREMENT,
    titulo VARCHAR(200),
    descripcion TEXT,
    fecha DATE,
    creado_por INT,
    FOREIGN KEY (creado_por) REFERENCES USUARIO(id_usuario)
);

CREATE TABLE COMUNICADO_USUARIO (
    id_comunicado INT,
    id_usuario INT,
    leido BOOLEAN,
    PRIMARY KEY (id_comunicado, id_usuario),
    FOREIGN KEY (id_comunicado) REFERENCES COMUNICADO(id_comunicado),
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
);

CREATE TABLE TICKET (
    id_ticket INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT NOT NULL,
    categoria VARCHAR(50),
    descripcion TEXT,
    prioridad VARCHAR(20),
    estado VARCHAR(20),
    fecha_creacion DATE,
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
);

CREATE TABLE CONFIGURACION (
    id_configuracion INT PRIMARY KEY AUTO_INCREMENT,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor VARCHAR(200)
);

INSERT INTO TIPO_USUARIO (nombre)
VALUES ('admin'), ('guardia'), ('residente'), ('inquilino');

INSERT INTO PERMISO (nombre)
VALUES
    ('dashboard.admin'),
    ('dashboard.guardia'),
    ('dashboard.residente'),
    ('dashboard.inquilino'),
    ('login.sistema');

INSERT INTO TIPO_USUARIO_PERMISO (id_tipo_usuario, id_permiso)
SELECT tu.id_tipo_usuario, p.id_permiso
FROM TIPO_USUARIO tu
JOIN PERMISO p
WHERE
    (tu.nombre = 'admin' AND p.nombre IN ('dashboard.admin', 'login.sistema')) OR
    (tu.nombre = 'guardia' AND p.nombre IN ('dashboard.guardia', 'login.sistema')) OR
    (tu.nombre = 'residente' AND p.nombre IN ('dashboard.residente', 'login.sistema')) OR
    (tu.nombre = 'inquilino' AND p.nombre IN ('dashboard.inquilino', 'login.sistema'));

INSERT INTO USUARIO (nombre, dpi, correo, telefono, password, activo, id_tipo_usuario)
VALUES
    ('Administrador General', '1000000000001', 'admin@test.com', '5555-0001', '1234', TRUE, (SELECT id_tipo_usuario FROM TIPO_USUARIO WHERE nombre = 'admin')),
    ('Guardia Principal', '1000000000002', 'guardia@test.com', '5555-0002', '1234', TRUE, (SELECT id_tipo_usuario FROM TIPO_USUARIO WHERE nombre = 'guardia')),
    ('Residente Demo', '1000000000003', 'residente@test.com', '5555-0003', '1234', TRUE, (SELECT id_tipo_usuario FROM TIPO_USUARIO WHERE nombre = 'residente')),
    ('Inquilino Demo', '1000000000004', 'inquilino@test.com', '5555-0004', '1234', TRUE, (SELECT id_tipo_usuario FROM TIPO_USUARIO WHERE nombre = 'inquilino'));

INSERT INTO RESIDENTE (id_usuario)
SELECT id_usuario
FROM USUARIO
WHERE correo = 'residente@test.com';

INSERT INTO INQUILINO (id_usuario, autorizado)
SELECT id_usuario, TRUE
FROM USUARIO
WHERE correo = 'inquilino@test.com';

INSERT INTO CASA (numero, torre, id_residente)
VALUES (
    '302',
    'B',
    (SELECT id_residente FROM RESIDENTE WHERE id_usuario = (SELECT id_usuario FROM USUARIO WHERE correo = 'residente@test.com'))
);

INSERT INTO INQUILINO_CASA (id_inquilino, id_casa)
VALUES (
    (SELECT id_inquilino FROM INQUILINO WHERE id_usuario = (SELECT id_usuario FROM USUARIO WHERE correo = 'inquilino@test.com')),
    (SELECT id_casa FROM CASA WHERE numero = '302' AND torre = 'B')
);
