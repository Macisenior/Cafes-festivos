# Lectura de Firestore V3 hacia V4

La primera fase es estrictamente de lectura. El servicio consulta el documento
`grupos/{groupId}` con `getDoc`; no importa ni utiliza APIs de escritura.

## Formato observado en V3

Cada grupo es un único documento con arrays embebidos:

- `personas`: `{ id, nombre, telefono?, aportado }`.
- `aportaciones`: `{ id, personaId, nombre?, amount, date }`.
- `gastos`: `{ id, sitio, descripcion, monto, participantes, fecha, modo?,
  consumiciones?, importesPersona? }`.

Los importes están en euros como `number`; las fechas aparecen en ISO y también
en `DD/MM/AAAA`. Los identificadores pueden ser numéricos.

## Conversión en memoria a V4

- IDs: se normalizan a `string` y se añade `groupId` a todas las entidades.
- IDs de aportación duplicados: V3 contiene algunos valores de `id` repetidos.
  V4 conserva el último con su ID original y asigna a las apariciones anteriores
  un ID estable `v3-contribution:{id}:{posición}`, evitando sobrescrituras.
- Importes: se convierten una vez a céntimos mediante redondeo explícito.
- Fechas: se normalizan a ISO `YYYY-MM-DD`.
- Personas: V3 no conserva el estado de baja; se leen como activas. Cuando
  `personas[].aportado` difiere de los movimientos, la conversión crea en
  memoria una aportación de apertura marcada `source: 'v3-opening'`.
- Aportaciones históricas: el grupo real contiene movimientos negativos de
  corrección. Durante la lectura se conservan como céntimos firmados para no
  alterar el historial; las futuras altas V4 podrán imponer sus propias reglas.
- Gastos: V3 no guarda asignaciones finales. La conversión construye la
  configuración de reparto y obtiene las asignaciones en memoria mediante el
  motor V4; no se escriben de vuelta a Firestore.
- Gastos sin `modo`: si tienen consumiciones positivas y completas para todos
  los participantes, se infieren como `consumiciones`; sin esos datos se
  infieren como `igual`. Un modo `igual` explícito siempre ignora
  consumiciones residuales de V3.
- Sitios: V3 los define en la interfaz, no en el documento. La lectura expone
  los tres sitios funcionales V4 (`Flap`, `Colono`, `Lydo`) como configuración
  inicial en memoria.

La aportación de apertura no modifica ni corrige datos existentes: se deriva
solo en memoria y conserva `date: null` cuando V3 no ofrece una fecha fiable.

## Diagnóstico de lectura real

El 9 de agosto de 2026 se realizó una lectura de solo lectura de
`grupos/general` mediante `getDoc`. El documento se convirtió a V4 y pasó por
el adaptador y el motor financiero sin escrituras en Firestore:

- Personas: 11.
- Aportaciones: 330.
- Gastos: 211.
- Saldo V4 derivado: -15.110 céntimos.
- Integridad: los 211 repartos, los 11 balances personales y el balance de
  grupo fueron consistentes.
