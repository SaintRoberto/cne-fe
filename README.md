# CNE · Sistemas COE CNE 2026

Frontend base para el sistema COE con estructura de usuarios DPA.

## Ejecutar

```bash
npm install
npm run dev
```

Usuario demo: `coe.manta@cne.gob.ec`
Contrasena demo: `demo123`

En modo demostracion el login acepta cualquier correo y contrasena no vacios.

## Pantallas

- `Eventos Adversos`: reporte situacional tipo Sistemas COE.
- `Afectaciones`: listado operativo de afectaciones.
- `Infraestructuras`: CRUD local para crear, editar, filtrar y eliminar infraestructuras.

## Estructura

- `src/components/layout`: encabezado, sidebar y configuracion del menu.
- `src/components/auth`: proteccion de rutas.
- `src/context`: estado de autenticacion.
- `src/pages/auth`: login.
- `src/pages/eventos`: Eventos Adversos.
- `src/pages/afectaciones`: Afectaciones.
- `src/pages/infraestructuras`: CRUD de Infraestructuras.
- `src/styles`: estilos responsive del sistema.
