// ===== RENDER PERSONAS COMO BOTONES =====
export function renderPersonasRapido(personas) {

  const cont = document.getElementById("rapidoPersonasContainer");
  if (!cont) return;

  cont.innerHTML = personas.map(p => `
    <div 
      class="persona-btn" 
      data-id="${p.id}"
      style="
        padding:10px;
        margin-bottom:6px;
        border-radius:8px;
        background:#f5f5f5;
        text-align:center;
        cursor:pointer;
        font-weight:500;
      "
      onclick="togglePersonaRapido(${p.id}, this)"
    >
      ${p.nombre}
    </div>
  `).join("");
}
const TELEFONO_ADMIN = "34607256271";

// ===== TOGGLE SELECCIÓN =====
window.togglePersonaRapido = function(id, el) {

  if (el.classList.contains("activo")) {
    el.classList.remove("activo");
    el.style.background = "#f5f5f5";
    el.style.color = "#000";
  } else {
    el.classList.add("activo");
    el.style.background = "#4CAF50";
    el.style.color = "white";
  }
};


// ===== SELECCIONAR TODOS =====
export function seleccionarTodosRapido() {

  document.querySelectorAll(".persona-btn").forEach(el => {
    el.classList.add("activo");
    el.style.background = "#4CAF50";
    el.style.color = "white";
  });
};


// ===== RENDER PAGADOR =====
export function renderPagadorRapido(personas) {

  const sel = document.getElementById("rapidoPagador");
  if (!sel) return;

 sel.innerHTML = `
  <option value="">Selecciona quién paga</option>
` + personas.map(p => `
  <option value="${p.id}">${p.nombre}</option>
`).join("");
}
export function renderSitiosRapido(sitios) {

  const sel = document.getElementById("rapidoSitio");
  if (!sel) return;

  sel.innerHTML = `
    <option value="">Selecciona sitio</option>
  ` + sitios.map(s => `
    <option value="${s.nombre}">${s.nombre}</option>
  `).join("");
}
// ===== ENVIAR WHATSAPP =====
export function enviarGastoRapido(personas) {

  const sitio = document.getElementById("rapidoSitio").value.trim();
  const monto = document.getElementById("rapidoMonto").value.trim();
  const pagadorId = document.getElementById("rapidoPagador").value;

  const seleccionados = [
    ...document.querySelectorAll(".persona-btn.activo")
  ].map(el => el.dataset.id);

  const nombres = personas
    .filter(p => seleccionados.includes(String(p.id)))
    .map(p => p.nombre)
    .join(", ");

  const pagador = personas.find(p => String(p.id) === pagadorId)?.nombre || "";

  if (!sitio || !monto || seleccionados.length === 0) {
    alert("Faltan datos");
    return;
  }

  const mensaje =
`📝 Gasto rápido

📍 ${sitio}
💸 ${monto} €
💳 Pagado por: ${pagador}
👥 ${nombres}`;

 const telefono = "34607256271"; // 👈 tu número SIN + ni espacios

const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");

  // limpiar inputs
  document.getElementById("rapidoSitio").value = "";
  document.getElementById("rapidoMonto").value = "";
  // limpiar selección de personas
document.querySelectorAll(".persona-btn").forEach(el => {
  el.classList.remove("activo");
  el.style.background = "#f5f5f5";
  el.style.color = "#000";
});
document.getElementById("rapidoPagador").selectedIndex = 0;
};