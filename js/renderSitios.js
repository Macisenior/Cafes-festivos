export function renderSitios(listaSitios) {

  const sitiosContainer = document.getElementById("sitiosContainer");
  if (!sitiosContainer) return;

  sitiosContainer.innerHTML = "";

  listaSitios.forEach((s, i) => {
    sitiosContainer.innerHTML += `
      <button 
        class="sitio-chip ${i === 0 ? "activo" : ""}" 
        data-sitio="${s.nombre}"
        style="background:${s.color}">
        ${s.nombre}
      </button>
    `;
  });

  document.querySelectorAll(".sitio-chip").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".sitio-chip")
        .forEach(b => b.classList.remove("activo"));
      btn.classList.add("activo");
    };
  });
}