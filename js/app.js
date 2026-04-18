import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection, 
   deleteDoc,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { 
  auth, 
  db, 
  signInAnonymously, 
  onAuthStateChanged,
  onSnapshot
} from "./firebase.js";
import { renderResumen } from "./resumen.js";
import { calcularGastoPorPersona } from "./services/calculos.js";
import { renderSitios } from "./renderSitios.js";
import { renderPersonas } from "./renderPersonas.js";
import { renderGastos } from "./renderGastos.js";
import { renderBalance } from "./renderBalance.js";
import { renderHero } from "./renderHero.js";
import { generarPDF } from "./services/pdf.js";
import { exportarMesPDF } from "./services/pdf.js";
import { exportarMesActual, exportarMesManual } from "./services/pdf.js";
import { generarPDFResumen } from "./services/pdf.js";
import { exportarAportacionesAnualPro } from "./services/pdf.js";
import { exportarGastosTotalesPro } from "./services/pdf.js";
import { exportarResumenFinal } from "./services/pdf.js";
import { 
  renderPersonasRapido, 
  renderPagadorRapido,
  enviarGastoRapido,
  seleccionarTodosRapido,
  renderSitiosRapido 
} from "./rapido.js";
window.enviarGastoRapido = enviarGastoRapido;
window.seleccionarTodosRapido = seleccionarTodosRapido;
console.log("APP JS CARGADO");
function render() {

  const totalRestante = document.getElementById("heroMensaje");
  const heroBalance = document.getElementById("heroBalance");
  const sitiosContainer = document.getElementById("sitiosContainer");
  const checkboxPersonas = document.getElementById("checkboxPersonas");
  const personaEfectivo = document.getElementById("personaEfectivo");
  const heroInfo = document.getElementById("heroInfo");

  // ===== HERO FRASE =====
  if (totalRestante) {
    totalRestante.classList.add("frase-animada");

    setTimeout(() => {
      totalRestante.innerHTML = fraseActual;

      if (estadoActual === "negativo") {
        totalRestante.style.background = "rgba(229,57,53,0.08)";
      } else if (estadoActual === "bajo") {
        totalRestante.style.background = "rgba(255,193,7,0.12)";
      } else {
        totalRestante.style.background = "rgba(76,175,80,0.08)";
      }

      totalRestante.classList.remove("frase-animada");
    }, 200);
  }

  // ===== SITIOS =====
 renderSitios(listaSitios);
renderSitiosRapido(listaSitios);
  // ===== PERSONAS =====
 renderPersonas(personas);
renderPersonasRapido(personas);
renderPagadorRapido(personas);
window.personas = personas;
  // ===== CÁLCULOS =====
 const gastoPersona = calcularGastoPorPersona(personas, gastos);

  const total =
    personas.reduce((s, p) => s + p.aportado, 0) -
    gastos.reduce((s, g) => s + g.monto, 0);

  // ===== ESTADO =====
  let estadoActual;
  if (total < 0) estadoActual = "negativo";
  else if (total <= 20) estadoActual = "bajo";
  else estadoActual = "positivo";

  if (estadoActual !== estadoAnterior) {
    if (estadoActual === "negativo") {
      fraseActual = frasesNegativas[Math.floor(Math.random() * frasesNegativas.length)];
    } else if (estadoActual === "bajo") {
      fraseActual = frasesBajo[Math.floor(Math.random() * frasesBajo.length)];
    } else {
      fraseActual = frasesPositivas[Math.floor(Math.random() * frasesPositivas.length)];
    }
    estadoAnterior = estadoActual;
  }

  // ===== HERO BALANCE =====
 renderHero(total, grupoActivo, ultimaActualizacion);
 

  // ===== QUIÉN DEBE + WHATSAPP =====
 renderBalance(personas, gastos);
// ===== RESUMEN PERSONAS =====
const resumenPersonas = document.getElementById("resumenPersonas");

if (resumenPersonas) {
 const gastoPersona = calcularGastoPorPersona(personas, gastos);

  resumenPersonas.innerHTML = personas.map(p => `
    <strong>${p.nombre}</strong><br>
    Aportado: ${p.aportado.toFixed(2)} €<br>
    Gastado: ${gastoPersona[p.id].toFixed(2)} €<br><br>
  `).join("");
}

// ===== LISTA GASTOS =====
renderGastos(gastos, personas, filtrarPorMes);

// ===== GRÁFICO PERSONAS =====
if (typeof Chart !== "undefined" && document.getElementById("graficoPersonas")) {
  if (chartPersonas) chartPersonas.destroy();

 const gastoPersona = calcularGastoPorPersona(personas, gastos);

  chartPersonas = new Chart(graficoPersonas, {
    type: "bar",
    data: {
      labels: personas.map(p => p.nombre),
      datasets: [
        { label: "Aportado", data: personas.map(p => p.aportado) },
        { label: "Gastado", data: personas.map(p => gastoPersona[p.id]) }
      ]
    }
  });
}

// ===== GRÁFICO SITIOS =====
if (typeof Chart !== "undefined" && document.getElementById("graficoSitios")) {
  if (chartSitios) chartSitios.destroy();

  const sitios = {};
  gastos.forEach(g => {
    sitios[g.sitio] = (sitios[g.sitio] || 0) + g.monto;
  });

  chartSitios = new Chart(graficoSitios, {
    type: "doughnut",
    data: {
      labels: Object.keys(sitios),
      datasets: [{ data: Object.values(sitios) }]
    }
  });
}
// 📅 Fecha del listado
const fechaListado = document.getElementById("fechaListado");

if (fechaListado) {
  if (ultimaActualizacion) {
    fechaListado.textContent =
      "📅 " + new Date(ultimaActualizacion).toLocaleDateString();
  } else {
    fechaListado.textContent = "📅 —";
  }
}

  
}
  // 🎭 FRASES DINÁMICAS

const frasesPositivas = [
  "🕶️ Nivel de organización: ninja.",
  "🍺 Aquí no se pierde ni una ronda.",
  "🎉 Grupo en modo celebración.",
  "🧠 Control financiero absoluto.",
  "💸 Gastar sabemos. Cuadrar también.",
  "👑 Administración legendaria."
];

const frasesNegativas = [
  "⚠️ Momento de invitar algo...",
  "🍻 Se viene ronda obligatoria.",
  "😏 Aquí hay cuentas pendientes...",
  "💸 Alguien está mirando para otro lado...",
  "🔥 Esto se arregla con una cerveza."
];
const frasesBajo = [
  "⚠️ Ojo, vamos ajustados.",
  "🍺 Últimas rondas con cabeza.",
  "💸 El fondo empieza a bajar.",
  "🧐 Controlando gastos...",
  "📉 Estamos en zona delicada."
];
// ---- estado ----

let listaSitios = [
  { nombre: "Flap", color: "#4CAF50" },
  { nombre: "Colono", color: "#2196F3" },
  { nombre: "Lydo", color: "#FF9800" }
];
let btnCrearGrupo;
let dangerZone;
let pinCard;
let modoEdicion;
let personas = [];
let gastos = [];
let aportaciones = [];
let pinGuardado = null;
let edicionActiva = false;
let chartPersonas, chartSitios;
let importandoBackup = false;
let gastoEditando = null;
let ultimaActualizacion = null;
let estadoAnterior = null;
let fraseActual = "";
let unsubscribeGrupo = null;
let cargandoGrupo = false;
let soloLectura = new URLSearchParams(location.search).has("readonly");
document.addEventListener("DOMContentLoaded", async () => {

 
  console.log("Intentando login anónimo...");
  signInAnonymously(auth).catch(console.error);
onAuthStateChanged(auth, async (user) => {
  if (user) {

    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "block";

    console.log("Auth OK", user.uid);

    await new Promise(resolve => setTimeout(resolve, 1500));
    await cargarListaGrupos();

    cargar();   // 🔥 sin await
    // ❌ quitar render();

    if (loading) loading.style.display = "none";
  }
});

  if (btnCrearGrupo) btnCrearGrupo.style.display = "none";
 

  if (soloLectura) {
    const bloqueGrupo = document.getElementById("grupoCard");
    if (bloqueGrupo) bloqueGrupo.style.display = "none";
  }
}); 


// 📂 Grupo activo
let grupoActivo = localStorage.getItem("grupoActivo") || "general";

// 📄 Referencia dinámica
function getDocRef() {
  return doc(db, "grupos", grupoActivo);
}
function colorGrupo(id) {
  if (id === "general") return "#2e7d32";          // verde café
  if (id === "Viernes Oficial") return "#f59e0b";  // dorado cerveza
  if (id === "Torreznos") return "#b91c1c";        // rojo torrezno
  return "#374151"; // color por defecto
}

async function cargarListaGrupos() {
  const snap = await getDocs(collection(db, "grupos"));
  const ordenDeseado = ["general", "Viernes Oficial", "Torreznos"];

const docsOrdenados = snap.docs.sort((a, b) => {
  return ordenDeseado.indexOf(a.id) - ordenDeseado.indexOf(b.id);
});
  const container = document.getElementById("selectorGrupoChips");

  if (!container) return;

  container.innerHTML = "";

    docsOrdenados.forEach(docSnap => {
    const data = docSnap.data();
    const id = docSnap.id;

    const chip = document.createElement("div");
    chip.className = "grupo-chip";
    chip.textContent = `${data.emoji || "📁"} ${data.nombreVisible || id}`;

    if (id === grupoActivo) {
      chip.classList.add("activo");
      chip.style.background = colorGrupo(id);
      chip.style.color = "white";
    }

    chip.onclick = () => cambiarGrupo(id);

    container.appendChild(chip);
  });
}
async function cambiarGrupo(id) {

  if (id === grupoActivo) return; // no hacer nada si ya está activo

  const loading = document.getElementById("loading");
  if (loading) loading.style.display = "block";

  // 🔄 Cambiar grupo
  grupoActivo = id;
  localStorage.setItem("grupoActivo", grupoActivo);

  // 🔒 Bloquear edición al cambiar
  bloquearEdicion();

  // 🔄 Recargar datos
  cargar();

  // 🔄 Volver a pintar chips activos
  await cargarListaGrupos();

  if (loading) loading.style.display = "none";
} 

// ➕ Crear nuevo grupo
window.crearGrupo = async () => {



  if (!edicionActiva) {
    alert("Debes desbloquear la edición con el PIN");
    return;
  }

  const nombre = prompt("Nombre del nuevo grupo:");
  if (!nombre) return;

  await setDoc(doc(db, "grupos", nombre), {
    nombreVisible: "☕ " + nombre,
    emoji: "☕",
    color: "#0f766e",
    personas: [],
    gastos: [],
    aportaciones: [],
    pin: null
  });

  grupoActivo = nombre;
  localStorage.setItem("grupoActivo", nombre);

  await cargarListaGrupos();

  cargar();   // 🔥 sin await
};


window.borrarGrupo = async () => {

  if (!edicionActiva) return;

  if (grupoActivo === "general") {
    alert("No se puede borrar el grupo general.");
    return;
  }

  const seguro = confirm(
    "⚠ Esta acción eliminará el grupo completo.\n\n¿Seguro que quieres continuar?"
  );

  if (!seguro) return;

  await deleteDoc(doc(db, "grupos", grupoActivo));

  grupoActivo = "general";
  localStorage.setItem("grupoActivo", "general");

  await cargarListaGrupos();

  cargar();   // 🔥 sin await
};
// 🔹 FUERA de exportarMesPDF
function filtrarPorMes(gastos, mes, año) {
  return gastos.filter(g => {

    if (!g.fecha) return false;

    const partes = g.fecha.split("/");
    if (partes.length !== 3) return false;

    const mesNum = parseInt(partes[1], 10) - 1;
    const añoNum = parseInt(partes[2], 10);

    return mesNum === mes && añoNum === año;
  });
}

// 🔹 EXPORTAR PDF
window.exportarMesPDF = (mes, año) => {
  exportarMesPDF(mes, año, personas, gastos);
};


window.exportarBackup = () => {
  const backup = {
    fecha: new Date().toISOString(),
    personas,
    gastos,
    aportaciones
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "backup_gastos_grupo.json";
  a.click();
  URL.revokeObjectURL(url);
};
window.abrirResumen = () => {

  document.querySelectorAll(".pantalla")
    .forEach(p => p.classList.remove("activa"));

  document.getElementById("pantallaResumen")
    .classList.add("activa");

  renderResumen(personas, gastos, aportaciones);
};

 
   window.importarBackup = async () => {
  const input = document.getElementById("archivoBackup");
  if (!input.files.length) {
    alert("Selecciona un archivo");
    return;
  }

  const file = input.files[0];
  const texto = await file.text();
  const data = JSON.parse(texto);

  if (!data.personas || !data.gastos) {
    alert("Archivo no válido");
    return;
  }

  if (!confirm("Esto reemplazará los datos actuales. ¿Continuar?")) return;

  importandoBackup = true;

  aportaciones = data.aportaciones || [];
  personas = data.personas;
  gastos = data.gastos;

  await guardar();

  importandoBackup = false;
  render();
};
 function textoFechaActualizacion(fechaISO) {
  if (!fechaISO) return "—";

  const fecha = new Date(fechaISO);
  const hoy = new Date();

  const diff = Math.floor(
    (hoy.setHours(0,0,0,0) - fecha.setHours(0,0,0,0)) / (1000 * 60 * 60 * 24)
  );

  if (diff === 0) return "Actualizado hoy";
  if (diff === 1) return "Actualizado ayer";
  return `Actualizado hace ${diff} días`;
}
function tiempoDesde(fecha) {
  if (!fecha) return "—";

  const ahora = new Date();
  const diff = Math.floor((ahora - fecha) / 1000);

  if (diff < 60) return "Hace unos segundos";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return "Ayer";

  return fecha.toLocaleDateString();
}
function crearBackupLocal() {
console.log("🛟 Backup local automático ejecutado"); //
  const backup = {
    _backup: {
      app: "Gastos de grupo",
      generado: new Date().toISOString(),
      personas: personas.length,
      gastos: gastos.length,
      aportaciones: aportaciones.length
    },
    personas,
    gastos,
    aportaciones
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const fecha = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace("T", "_")
    .slice(0, 19);

  const nombre = `backup-gastos-${fecha}.json`;

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();

  console.log("📦 Backup local creado:", nombre);
}
function cargar(){

  if (unsubscribeGrupo) {
    unsubscribeGrupo(); // 🔥 desuscribirse del grupo anterior
  }

  const docRef = getDocRef();

  unsubscribeGrupo = onSnapshot(docRef, (snap) => {

    if (snap.exists()) {
      const d = snap.data();

      aportaciones = d.aportaciones || [];
      personas = d.personas || [];
      gastos = d.gastos || [];
      pinGuardado = d.pin || null;

   if (d.ultimaActualizacion) {
  if (typeof d.ultimaActualizacion.toDate === "function") {
    ultimaActualizacion = d.ultimaActualizacion.toDate();
  } else if (d.ultimaActualizacion.seconds) {
    // 🔥 caso Firebase Timestamp serializado
    ultimaActualizacion = new Date(d.ultimaActualizacion.seconds * 1000);
  } else {
    ultimaActualizacion = new Date(d.ultimaActualizacion);
  }
} else {
  ultimaActualizacion = null;
}
     
    } 
render();
   
  });
}

   

 
 
  edicionActiva = false; // 🔐 FORZAR bloqueo al cargar

 
  if (btnCrearGrupo) btnCrearGrupo.style.display = "none";

  
  if (dangerZone) dangerZone.classList.add("hidden");
  


if (pinCard) pinCard.classList.remove("hidden");
if (modoEdicion) modoEdicion.classList.add("hidden");


async function guardar() {
  if (!edicionActiva || soloLectura) return;

  // 🛑 B) No guardar si TODO está vacío
  if (
    (!personas || personas.length === 0) &&
    (!gastos || gastos.length === 0) &&
    (!aportaciones || aportaciones.length === 0)
  ) {
    console.warn("⛔ Guardado cancelado: datos vacíos");
    return;
  }

  // 🛟 Backup SOLO si NO estamos importando
  if (!importandoBackup) {
    crearBackupLocal();
  }

  try {
  console.log("📦 ENVIANDO A FIRESTORE");  
  await setDoc(
  getDocRef(),
  {
    personas,
    gastos,
    aportaciones,
    pin: pinGuardado ?? null,
    ultimaActualizacion: new Date()
  },
  { merge: true }
);

    console.log("✅ Guardado seguro en Firestore");
  } catch (e) {
    console.error("❌ Error al guardar:", e);
  }
}
window.pedirPin = async () => {

  if (edicionActiva) {

  edicionActiva = false;

  document.querySelectorAll(".editable")
    .forEach(e => e.classList.add("hidden"));

  if (btnCrearGrupo)
    btnCrearGrupo.style.display = "none";

  if (dangerZone)
    dangerZone.classList.add("hidden");

  actualizarBotonEdicion();
  render();   // 🔥 ESTO ES LO QUE FALTABA
  return;
}
  if (!pinGuardado) {
    const nuevo = prompt("Crea un PIN para editar");
    if (!nuevo) return;

    pinGuardado = nuevo;
    edicionActiva = true;

    await guardar();
    activarEdicion();
    render();
    return;
  }

  const intento = prompt("Introduce el PIN");
  if (String(intento) === String(pinGuardado)) {
    edicionActiva = true;
    activarEdicion();
    render();
  }
};


function actualizarBotonEdicion() {
  const btn = document.querySelector("#pinCard button");
  if (!btn) return;

  if (edicionActiva) {
    btn.textContent = "🔒 Bloquear edición";
    btn.style.background = "#dc2626"; // rojo elegante
  } else {
    btn.textContent = "🔓 Desbloquear edición";
    btn.style.background = "#16a34a"; // verde elegante
  }
}
function activarEdicion() {
  if (soloLectura) return;

  edicionActiva = true;

  document.querySelectorAll(".editable")
    .forEach(e => e.classList.remove("hidden"));

  if (btnCrearGrupo)
    btnCrearGrupo.style.display = "block";

  if (dangerZone && grupoActivo !== "general")
    dangerZone.classList.remove("hidden");

  actualizarBotonEdicion();
}
function bloquearEdicion() {
  edicionActiva = false;

  document.querySelectorAll(".editable")
    .forEach(e => e.classList.add("hidden"));

  if (btnCrearGrupo)
    btnCrearGrupo.style.display = "none";

  if (dangerZone)
    dangerZone.classList.add("hidden");

  actualizarBotonEdicion();
}
 
 

function agregarPersona() {

  if (!edicionActiva) {
    alert("Debes desbloquear la edición con el PIN");
    return;
  }

  const nombre = document.getElementById("nombrePersona").value.trim();
  const aporte = +document.getElementById("aportePersona").value;
  const telefono = document.getElementById("telefonoPersona").value.trim();

  if (!nombre || !aporte) {
    alert("Faltan datos");
    return;
  }

  personas.push({
    id: Date.now(),
    nombre,
    aportado: aporte,
    telefono
  });

  document.getElementById("nombrePersona").value = "";
  document.getElementById("aportePersona").value = "";
  document.getElementById("telefonoPersona").value = "";

  guardar();
  render();
}

window.agregarPersona = agregarPersona;

window.añadirEfectivo = async () => {
  const p = personas.find(p => p.id == personaEfectivo.value);
  const amount = +efectivoExtra.value;
  const date = cashDate.value;
console.log("➕ Añadiendo efectivo");
  if (!p || !amount || !date) {
    alert("Faltan datos");
    return;
  }

  // sumar al total de la persona
  p.aportado += amount;

  // guardar histórico
  aportaciones.push({
    personaId: p.id,
    nombre: p.nombre,
    amount,
    date
  });

  efectivoExtra.value = "";
  cashDate.value = new Date().toISOString().split("T")[0];

  await guardar();
  render();
};
window.eliminarGasto = async function(id) {

  if (!confirm("¿Seguro que quieres eliminar este gasto?")) return;

  // 🔥 eliminar del array local
  gastos = gastos.filter(g => g.id != id);

  // 🔥 guardar documento actualizado
  await guardar();

  // 🔥 refrescar UI
  render();

  console.log("Gasto eliminado correctamente");

};
window.agregarGasto = async () => {

 // Participantes seleccionados

const part = [...document.querySelectorAll("#checkboxPersonas input:checked")]
  .map(c => +c.value);

if (part.length === 0) {
  alert("Selecciona al menos un participante");
  return;
}

// Sitio seleccionado
const btnActivo = document.querySelector(".sitio-chip.activo");
const sitioManual = document.getElementById("sitioManual").value.trim();

const sitioSeleccionado =
  sitioManual || (btnActivo ? btnActivo.dataset.sitio : null);

if (!sitioSeleccionado) {
 alert("Selecciona o escribe un sitio");
  return;
}

// Datos básicos
const descripcion = descripcionGasto.value.trim();
const monto = +montoGasto.value;
const fecha = fechaGasto.value
  ? new Date(fechaGasto.value).toLocaleDateString()
  : new Date().toLocaleDateString();

if (!monto || monto <= 0) {
  alert("Introduce un importe válido");
  return;
}


// ✅ Crear gasto (AQUÍ SOLO DATOS)
gastos.push({
  id: Date.now(),
  sitio: sitioSeleccionado,
  descripcion: descripcion || "cafes",
  monto,
  participantes: part,
  fecha, 
});

// Guardar
await guardar();
render();

// 🧹 LIMPIAR (FUERA del objeto)
montoGasto.value = "";
descripcionGasto.value = "cafes";

const hoy = new Date().toISOString().split("T")[0];
fechaGasto.value = hoy;

document.querySelectorAll("#checkboxPersonas input")
  .forEach(cb => cb.checked = false);
document.getElementById("sitioManual").value = "";

 const aportes = aportaciones
  .filter(a => {

    if (a.personaId !== p.id) return false;
    if (!a.date) return false;

    const f = new Date(a.date);
    return f.getMonth() === mes && f.getFullYear() === año;

  })
  .sort((a, b) => new Date(a.date) - new Date(b.date));


window.actualizarTelefono = async (id, valor) => {
  const persona = personas.find(p => p.id === id);
  if (!persona) return;

  persona.telefono = valor.trim();

  await guardar();
  render();
  // 🔄 Reset inteligente para uso diario
const montoInput = document.getElementById("montoGasto");
const fechaInput = document.getElementById("fechaGasto");
const descripcionInput = document.getElementById("descripcionGasto");

// limpiar importe
if (montoInput) montoInput.value = "";

// fecha vuelve a hoy
if (fechaInput) {
  const hoy = new Date().toISOString().split("T")[0];
  fechaInput.value = hoy;
}

// descripción vuelve a "cafes"
if (descripcionInput) {
  descripcionInput.value = "cafes";
}

// desmarcar participantes
document
  .querySelectorAll("#checkboxPersonas input[type='checkbox']")
  .forEach(cb => cb.checked = false);
};
window.compartirSoloLectura = () => {
  const url = location.origin + location.pathname + "?readonly";
  if (navigator.share) {
    navigator.share({ title: "Gastos del grupo", url });
  } else {
    navigator.clipboard.writeText(url);
    alert("Enlace copiado al portapapeles");
  }
};


  // Evento selección
document.querySelectorAll(".sitio-chip").forEach(btn => {
  btn.addEventListener("click", () => {

    document.querySelectorAll(".sitio-chip")
      .forEach(b => b.classList.remove("activo"));

    btn.classList.add("activo");

    sitioSeleccionado = btn.dataset.sitio;
  });
});  
} 
 console.log("RENDER");
const heroInfo = document.getElementById("heroInfo");
const grupoSelect = document.getElementById("selectorGrupo");
if (grupoSelect) {
  grupoSelect.disabled = !edicionActiva;
}
const fechaInput = document.getElementById("fechaGasto");
if (fechaInput && !fechaInput.value) {
  const hoy = new Date().toISOString().split("T")[0];
  fechaInput.value = hoy;
}
const descripcionInput = document.getElementById("descripcionGasto");
const btnTodos = document.getElementById("btnTodos");
const btnLimpiar = document.getElementById("btnLimpiar");

if (btnTodos && btnLimpiar) {

  btnTodos.onclick = () => {
    document.querySelectorAll("#checkboxPersonas input").forEach(c => {
      c.checked = true;
    });
  };

  btnLimpiar.onclick = () => {
    document.querySelectorAll("#checkboxPersonas input").forEach(c => {
      c.checked = false;
    });
  };

}
if (descripcionInput && !descripcionInput.value) {
  descripcionInput.value = "cafes";
}
if (heroInfo) {

  let textoRelativo = "Sin registros aún";
  let textoFechaFija = "—";
  let badge = "⚪";

  if (ultimaActualizacion) {

    const ahora = new Date();
    const diff = Math.floor((ahora - ultimaActualizacion) / 1000);

    textoFechaFija = ultimaActualizacion.toLocaleDateString();

    if (diff < 60) {
      textoRelativo = "Actualizado hace unos segundos";
      badge = "🟢";
    } else if (diff < 3600) {
      textoRelativo = `Actualizado hace ${Math.floor(diff / 60)} min`;
      badge = "🟢";
    } else if (diff < 86400) {
      textoRelativo = `Actualizado hace ${Math.floor(diff / 3600)} h`;
      badge = "🟡";
    } else {
      textoRelativo = `Actualizado el ${textoFechaFija}`;
      badge = "🔴";
    }
  }

 heroInfo.innerHTML = `
  <div class="hero-meta">
    <div class="hero-top">
      <span class="hero-group">${grupoActivo.toUpperCase()}</span>
      <span class="hero-fixed-date">📅 ${textoFechaFija}</span>
    </div>
    <div class="hero-update">${badge} ${textoRelativo}</div>
  </div>
`;
}


// ===== Navegación entre pantallas =====
function renderUsuarios() {

  const cont = document.getElementById("listaUsuarios");
  if (!cont) return;

  cont.innerHTML = personas.map(p => `
    <div style="margin-bottom:10px; padding:10px; border-bottom:1px solid #ddd;">
      <strong>${p.nombre}</strong><br>

      📞 Teléfono:
      <input 
        value="${p.telefono || ""}"
        onchange="actualizarTelefono(${p.id}, this.value)"
        style="padding:4px; border-radius:6px; border:1px solid #ccc; margin-top:4px;"
      >

      <br><br>

     // <button onclick="eliminarPersona(${p.id})"
      //  style="background:#e53935; color:white; border:none; padding:6px 12px; border-radius:8px;">
      //  🗑 Eliminar
      </button>
    </div>
  `).join("");
}
window.abrirGestionGastos = function() {
  const principal = document.getElementById("pantallaPrincipal");
  const gastos = document.getElementById("pantallaGastos");

  if (principal) principal.style.display = "none";
  if (gastos) gastos.style.display = "block";
  setTimeout(() => {
  const form = document.getElementById("montoGasto");
  if (form) form.focus();
}, 200);
};
window.abrirGestionUsuarios = function() {
  document.getElementById("pantallaPrincipal").style.display = "none";
  document.getElementById("pantallaUsuarios").style.display = "block";
  renderUsuarios();
};
window.volverPrincipal = function() {

  const principal = document.getElementById("pantallaPrincipal");
  const usuarios = document.getElementById("pantallaUsuarios");
  const gastos = document.getElementById("pantallaGastos");

  if (usuarios) usuarios.style.display = "none";
  if (gastos) gastos.style.display = "none";
  if (principal) principal.style.display = "block";

  // 🔥 Forzar estado visual correcto
  if (!edicionActiva) {
    document.querySelectorAll(".editable")
      .forEach(e => e.classList.add("hidden"));
  }

  render();
};
window.actualizarNombresGrupos = async function () {

  await setDoc(doc(db, "grupos", "general"), {
    nombreVisible: "Cafés Semanal",
    emoji: "☕"
  }, { merge: true });

  await setDoc(doc(db, "grupos", "viernes oficial"), {
    nombreVisible: "Cervezas del Viernes",
    emoji: "🍺"
  }, { merge: true });

  await setDoc(doc(db, "grupos", "torreznos"), {
    nombreVisible: "Torreznos",
    emoji: "🥓"
  }, { merge: true });

  console.log("✅ Grupos actualizados correctamente");
};
 
window.exportarResumenFinal = () =>
  exportarResumenFinal(personas, gastos);
window.abrirResumen = abrirResumen;
window.generarPDFResumen = () =>
  generarPDFResumen(personas, gastos, aportaciones);
window.exportarGastosTotalesPro = () =>
  exportarGastosTotalesPro(personas, gastos);
window.exportarAportacionesAnualPro = () =>
  exportarAportacionesAnualPro(personas, aportaciones);

window.enviarWhatsAppPersona = function(id) {

  
  const p = personas.find(x => x.id === id);
  if (!p) return;

  const nombre = p.nombre;
  const aportado = p.aportado || 0;

 let gastado = 0;

gastos.forEach(g => {

  if (!g.participantes || !g.monto) return;

  if ((g.participantes || [])
    .map(id => Number(id))
    .includes(Number(p.id))) {

    const parte = g.monto / g.participantes.length;
    gastado += parte;

  }

}); 
  const saldo = aportado - gastado;

  let mensaje = `☕ Cafe semanal\n\n`;
  mensaje += `👤 ${nombre}\n`;
  mensaje += `💰 Aportado: ${aportado.toFixed(2)} €\n`;
  mensaje += `💸 Gastado: ${gastado.toFixed(2)} €\n`;
  mensaje += `📊 Saldo: ${saldo.toFixed(2)} €`;
const telefono = p.telefono.replace(/\D/g, "");
 const url = `https://wa.me/${p.telefono}?text=${encodeURIComponent(mensaje)}`;

  window.open(url, "_blank");
};
window.volverApp = function() {

  // 👇 ocultar todas las pantallas
  document.querySelectorAll("[id^='pantalla']").forEach(p => {
    p.style.display = "none";
  });

  // 👇 mostrar principal
  document.getElementById("pantallaPrincipal").style.display = "block";

  // 👇 refrescar datos SIEMPRE
  render();

};
function formatDate(dateStr) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
window.exportarMesActual = () => exportarMesActual(personas, gastos);
window.exportarMesManual = () => exportarMesManual(personas, gastos);window.abrirRapido = function() {
  document.querySelectorAll(".pantalla")
    .forEach(p => p.style.display = "none");

  document.getElementById("pantallaRapida").style.display = "block";
};

window.volverApp = function() {
  document.querySelectorAll(".pantalla")
    .forEach(p => p.style.display = "none");

  document.getElementById("pantallaPrincipal").style.display = "block";
};