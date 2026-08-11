# Estructura funcional de V4

Esta estructura procede del inventario funcional V3 → V4. Los módulos son
intencionadamente contratos o componentes vacíos: no contienen Firebase,
persistencia, cálculos de reparto ni operaciones financieras.

## Dominio

- `src/domain/money.ts`: contrato de importes en céntimos.
- `src/domain/dates.ts`: contrato de fechas reales y periodos de consulta.
- `src/domain/entities.ts`: contratos de persona, grupo, sitio, aportación,
  gasto y aviso de Gasto Rápido.
- `src/domain/reparto.ts`: contratos de los tres modos de reparto, sus datos
  de origen y la asignación final guardada junto al gasto.
- `src/domain/balances.ts`: contratos de saldos derivados y comprobaciones de
  integridad, sin cálculos.
- `src/domain/financial-engine.ts`: motor financiero puro que calcula repartos,
  balances y comprobaciones a partir de esos contratos.
- `src/domain/financial-adapter.ts`: adapta las entidades de un grupo a vistas
  de balances mediante el motor, sin persistencia ni cálculos duplicados.
- `src/infrastructure/firebase/firebase-client.ts`: conexión Firebase para
  lectura, configurada mediante variables `VITE_FIREBASE_*`.
- `src/infrastructure/firestore/`: conversión del documento real V3 y servicio
  Firestore de solo lectura. Las diferencias están en `docs/FIRESTORE_V3_TO_V4.md`.
- `src/infrastructure/firestore/firestore-v4-migration-service.ts`: migración
  V4 validada a la colección aislada `grupos_v4`, sin tocar `grupos` de V3.

## Funcionalidades

- `features/informacion`: saludo, saldo de grupo, estado de cuentas, resumen y
  detalle personal, y actividad reciente.
- `features/operativa`: acceso por PIN y captura de altas o edición de
  personas, aportaciones y cambio de grupo.
- `features/gastos`: creación, edición, eliminación y detalle; incluye los
  puntos de interfaz para reparto, sitio y tipos de reparto documentados.
- `features/administracion`: personas, grupos, históricos, resumen global,
  exportación PDF/Excel y copia/restauración.

Cada archivo de componente documenta su responsabilidad y devuelve `null`
hasta que se diseñen e implementen sus pantallas. No se han añadido rutas,
flujos ni comportamientos no presentes en el documento funcional.
