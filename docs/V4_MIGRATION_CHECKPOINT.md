# Punto de control: migración V3 → V4 cerrada

Fecha de validación: 9 de agosto de 2026.

Los tres grupos V3 se han migrado a documentos independientes bajo
`grupos_v4/{groupId}`. La validación posterior se hizo leyendo cada grupo V4,
derivando sus balances mediante `financial-adapter.ts` y `financial-engine.ts`,
y comprobando las asignaciones finales de todos sus gastos.

| Grupo V4 | Personas | Aportaciones | Gastos | Aportado | Gastado | Saldo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `general` / Cafés Semanal | 11 | 341 | 211 | 3.927,97 € | 3.851,20 € | 76,77 € |
| `Viernes Oficial` | 3 | 45 | 25 | 460,00 € | 455,30 € | 4,70 € |
| `Torreznos` | 2 | 8 | 10 | 100,00 € | 99,20 € | 0,80 € |

Las validaciones manuales de interfaz confirmaron el selector de grupo, los
saldos de grupo y la identificación local aislada por grupo.

## Decisiones de compatibilidad histórica consolidadas

- V3 permanece intacta y no vuelve a recibir escrituras desde V4.
- `grupos_v4` es desde este punto la fuente de datos operativa de V4. Las
  aportaciones y gastos nuevos se escriben exclusivamente bajo el grupo V4
  activo.
- Cuando `personas[].aportado` no coincide con la suma de `aportaciones[]`, la
  conversión crea una aportación en memoria de apertura `source: 'v3-opening'`,
  sin fecha inventada y sin modificar V3.
- Los IDs de aportación V3 duplicados o ausentes se convierten a IDs V4
  estables para impedir sobrescrituras de documentos.
- Los importes V4 trabajan exclusivamente en céntimos. El motor conserva los
  movimientos históricos firmados ya migrados, pero las altas nuevas exigen
  importes positivos.
- Los gastos V3 sin modo se infieren como `consumiciones` solo si sus datos son
  completos y positivos; de lo contrario se infieren como `igual`. Un modo
  `igual` explícito ignora consumiciones residuales.
- No se reproduce el antiguo redondeo individual de V3: las asignaciones V4
  son canónicas y suman exactamente el importe del gasto. En Viernes Oficial
  las diferencias individuales históricas de redondeo se compensan a nivel de
  grupo.

## Regla de mantenimiento

No se debe modificar el conversor ni repetir estas migraciones salvo que una
incidencia reproducible demuestre un dato histórico no cubierto por estas
reglas. Cualquier incidencia debe diagnosticarse primero en solo lectura.
