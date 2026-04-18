export function renderPersonas(personas) {

  const checkboxPersonas = document.getElementById("checkboxPersonas");
  const personaEfectivo = document.getElementById("personaEfectivo");

  if (!checkboxPersonas || !personaEfectivo) return;

  checkboxPersonas.innerHTML = "";
  personaEfectivo.innerHTML = "";

  personas.forEach(p => {
    checkboxPersonas.innerHTML += `
      <label class="persona-chip">
        <input type="checkbox" value="${p.id}">
        <span>${p.nombre}</span>
      </label>
    `;

    personaEfectivo.innerHTML += `
      <option value="${p.id}">${p.nombre}</option>
    `;
  });
}