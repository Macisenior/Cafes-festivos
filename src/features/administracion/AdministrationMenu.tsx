import type { AdministrationArea } from './administration-navigation'

interface AdministrationMenuProps {
  onOpen(area: Exclude<AdministrationArea, 'menu'>): void
}

/** Menú de Administración: las áreas pendientes permanecen informativas hasta su implementación. */
export function AdministrationMenu({ onOpen }: AdministrationMenuProps) {
  return (
    <section className="administration-menu" aria-labelledby="administration-menu-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Administración</p>
          <h2 id="administration-menu-title">Áreas administrativas</h2>
        </div>
      </div>
      <ul>
        <li><button type="button" onClick={() => onOpen('people')}><strong>👤 Personas</strong><span>Alta, edición y estado de personas.</span></button></li>
        <li><button type="button" onClick={() => onOpen('groups')}><strong>📁 Grupos</strong><span>Listado y alta de grupos V4.</span></button></li>
        <li><button type="button" onClick={() => onOpen('expenses')}><strong>🧾 Gastos</strong><span>Gestión administrativa de gastos.</span></button></li>
        <li><button type="button" onClick={() => onOpen('history')}><strong>📋 Históricos</strong><span>Consulta de movimientos del grupo activo.</span></button></li>
        <li><button type="button" onClick={() => onOpen('reports')}><strong>📊 Informes</strong><span>Informes administrativos del grupo activo.</span></button></li>
        <li><button type="button" onClick={() => onOpen('system')}><strong>⚙️ Sistema</strong><span>Copias, Restaurar y futuro mantenimiento.</span></button></li>
      </ul>
    </section>
  )
}
