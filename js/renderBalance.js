import { calcularGastoPorPersona } from "./calculos.js";

export function renderBalance(personas, gastos) {

  const quienDebe = document.getElementById("quienDebe");
  if (!quienDebe) return;

  const gastoPersona = calcularGastoPorPersona(personas, gastos);

  quienDebe.innerHTML = personas.map(p => {

    let bal = (p.aportado || 0) - (gastoPersona[p.id] || 0);

    if (bal > -0.01 && bal < 0.01) bal = 0;

    let color = "";
    let texto = "";

    if (bal < 0) {
      color = "#ef4444";
      texto = `${p.nombre} debe ${(-bal).toFixed(2)} €`;
    } else if (bal > 0) {
      color = "#22c55e";
      texto = `${p.nombre} dispone de ${bal.toFixed(2)} €`;
    } else {
      color = "#a78bfa";
      texto = `${p.nombre} equilibrado`;
    }

    if (bal < 0 && p.telefono) {
      const mensaje = encodeURIComponent(
        `Ey ${p.nombre} 😄 Te quedan ${(-bal).toFixed(2)} € pendientes en el grupo. ¡Invita a algo! 🍻`
      );

      const enlace = `https://wa.me/${p.telefono}?text=${mensaje}`;

      texto += `
        <a href="${enlace}" target="_blank"
           style="margin-left:8px; background:#25D366; color:white; padding:3px 6px; border-radius:6px;">
           📱 Avisar
        </a>
      `;
    }

    return `
      <div class="estado-linea">
        <span class="estado-dot" style="background:${color}"></span>
        <span>${texto}</span>
      </div>
    `;
  }).join("<br>");
}