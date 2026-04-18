export function renderHero(total, grupoActivo, ultimaActualizacion) {

  const heroBalance = document.getElementById("heroBalance");
  const heroInfo = document.getElementById("heroInfo");

  // ===== BALANCE =====
  if (heroBalance) {
    heroBalance.textContent = total.toFixed(2) + " €";

    heroBalance.style.color =
      total < 0 ? "#b71c1c" :
      total === 0 ? "#555" :
      "#1b5e20";
  }

  // ===== INFO =====
  if (heroInfo) {
    let texto = "Sin datos";

    if (ultimaActualizacion) {
      const fecha = new Date(ultimaActualizacion);
      texto = fecha.toLocaleDateString();
    }

    heroInfo.innerHTML = `
      <span>📁 ${grupoActivo}</span>
      <span>📅 ${texto}</span>
    `;
  }
}