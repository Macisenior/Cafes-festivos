/** Fecha real de un movimiento en formato ISO: YYYY-MM-DD. */
export type MovementDate = string

/** Periodo de consulta basado en las fechas reales de los movimientos. */
export interface DateRange {
  from: MovementDate
  to: MovementDate
}
