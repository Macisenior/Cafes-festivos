export function renderGastos(gastos, personas, filtrarPorMes) {

  const listaGastos = document.getElementById("listaGastos");
  if (!listaGastos) return;

  const hoy = new Date();
  const mes = hoy.getMonth();
  const año = hoy.getFullYear();

  const gastosVisibles = filtrarPorMes(gastos, mes, año);

  listaGastos.innerHTML = gastosVisibles
    .slice()
    .reverse()
    .map(g => `
      <div class="gasto-item">

        <div class="gasto-top">
          <span class="gasto-desc">${g.sitio}</span>
          <span class="gasto-monto">${g.monto.toFixed(2)} €</span>
        </div>

        <div class="gasto-meta">
          📅 ${g.fecha} · 
          👥 ${g.participantes.map(id => {
            const p = personas.find(x => x.id === id);
            return p ? p.nombre : "";
          }).join(", ")}
        </div>

        <button class="btn-eliminar-mini" onclick="eliminarGasto('${g.id}')">
          ✕
        </button>

      </div>
    `).join("");
}