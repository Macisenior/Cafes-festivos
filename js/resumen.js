let mostrarHistorico = false;
export function renderResumen(personas, gastos, aportaciones) {

  function formatearFecha(fechaISO) {
    if (!fechaISO || fechaISO === "INICIAL") return "Inicio";
    const [año, mes, dia] = fechaISO.split("-");
    return `${dia}/${mes}/${año}`;
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
const btnToggle = document.getElementById("btnToggleHistorico");

if (btnToggle) {
  btnToggle.onclick = () => {
    mostrarHistorico = !mostrarHistorico;
    renderResumen(personas, gastos, aportaciones);
  };
}
  cont.innerHTML = personas.map(p => {

    // 🔹 movimientos reales de esta persona
  

const hoy = new Date();
const mesActual = hoy.getMonth();
const añoActual = hoy.getFullYear();

let movimientos = aportaciones
  .filter(a => {

    if (a.personaId !== p.id) return false;
    if (!a.date) return false;

    const fecha = new Date(a.date);

    if (!mostrarHistorico) {
      return fecha.getMonth() === mesActual &&
             fecha.getFullYear() === añoActual;
    }

    return true;

  })
  .sort((a, b) => new Date(a.date) - new Date(b.date));

    // 🔹 calcular lo que falta (inicio)
    const totalHistorial = movimientos.reduce(
      (sum, m) => sum + (m.amount || 0),
      0
    );

    const totalReal = p.aportado || 0;

    const inicial = totalReal - totalHistorial;

    // 👉 añadir "inicio" solo si hace falta
    if (inicial > 0.01) {
      movimientos = [
        {
          date: "INICIAL",
          amount: inicial
        },
        ...movimientos
      ];
    }

    // 🔹 total final
    const total = totalReal;

    // 🔹 filas
    const filas = movimientos.map(m => {

      const fechaTexto = formatearFecha(m.date);

      return `
        <div style="display:flex; justify-content:space-between; font-size:13px;">
          <span>${fechaTexto}</span>
          <span>+${(m.amount || 0).toFixed(2)} €</span>
        </div>
      `;
    }).join("");

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

    <!-- 👇 BOTÓN FUERA DEL CONTENEDOR -->
    <button onclick="enviarWhatsAppPersona(${p.id})"
      style="
        margin-top:8px;
        padding:6px 10px;
        border:none;
        border-radius:6px;
        background:#25D366;
        color:white;
        cursor:pointer;
        font-size:12px;
      ">
      📲 WhatsApp
    </button>

  </div>
`;
    

  }).join("");
}