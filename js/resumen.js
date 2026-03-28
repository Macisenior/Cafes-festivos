export function renderResumen(personas, gastos, aportaciones) {

  function formatearFecha(fechaISO) {
    if (!fechaISO) return "-";
    const [año, mes, dia] = fechaISO.split("-");
    return `${dia}/${mes}/${año}`;
  }

  function convertirFecha(fechaStr) {
    if (!fechaStr) return new Date(0);

    if (fechaStr.includes("-")) {
      return new Date(fechaStr);
    }

    const [dia, mes, año] = fechaStr.split("/");
    return new Date(`${año}-${mes}-${dia}`);
  }

  function calcularResumenReal(personas, gastos, aportaciones) {

    const resultado = {};

    personas.forEach(p => {
      resultado[p.id] = {
        nombre: p.nombre,
        aportado: 0,
        gastado: 0,
        saldo: 0
      };
    });

    aportaciones.forEach(a => {
      if (!resultado[a.personaId]) return;
      resultado[a.personaId].aportado += (a.amount || 0);
    });

    gastos.forEach(g => {

      if (!g.participantes || !g.monto) return;

      const parte = g.monto / g.participantes.length;

      g.participantes.forEach(id => {
        if (!resultado[id]) return;
        resultado[id].gastado += parte;
      });

    });

    Object.values(resultado).forEach(p => {
      p.saldo = p.aportado - p.gastado;
    });

    return resultado;
  }

  const resumenReal = calcularResumenReal(personas, gastos, aportaciones);

  const cont = document.getElementById("resumenContenido");
  if (!cont) return;

  const resumen = {};

personas.forEach(p => {

  if (p.aportado && p.aportado > 0) {

    aportaciones.push({
      personaId: p.id,
      nombre: p.nombre,
      amount: p.aportado,
      date: p.fechaAlta || "2026-01-01" // o una fecha inicial
    });

  }

});
 
cont.innerHTML = personas.map(p => {

  // 🔹 movimientos reales (quitamos el fake 01/01/2026)
  const movimientos = aportaciones
    .filter(a => a.personaId === p.id && a.date !== "2026-01-01")
    .sort((a, b) => {
      const fa = a.date ? new Date(a.date) : new Date(0);
      const fb = b.date ? new Date(b.date) : new Date(0);
      return fa - fb;
    });

  // 🔹 total REAL (incluye todo, también el inicial)
 
    const total = p.aportado || 0;
  // 🔹 filas
  const filas = movimientos.map(m => `
    <div style="display:flex; justify-content:space-between; font-size:13px;">
      <span>${formatearFecha(m.date || "")}</span>
      <span>+${(m.amount || 0).toFixed(2)} €</span>
    </div>
  `).join("");

  return `
   <div class="card-resumen">

      <h3>${p.nombre}</h3>

      ${filas}

      <div style="
        margin-top:8px;
        font-weight:bold;
        border-top:1px solid #ddd;
        padding-top:5px;
      ">
<div class="total">
  Total: ${total.toFixed(2)} €
</div>
       
      </div>

    </div>
  `;

}).join("");
}
