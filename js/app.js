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
  if (sitiosContainer) {
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

  // ===== PERSONAS =====
  if (checkboxPersonas && personaEfectivo) {
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

  // ===== CÁLCULOS =====
  const gastoPersona = {};
  personas.forEach(p => gastoPersona[p.id] = 0);

  gastos.forEach(g => {
    g.participantes.forEach(id => {
      gastoPersona[id] += g.monto / g.participantes.length;
    });
  });

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
  if (heroBalance) {
    heroBalance.textContent = total.toFixed(2) + " €";
   
  }

  // ===== HERO INFO =====
  if (heroInfo) {
    heroInfo.innerHTML = `
      <span>📁 ${grupoActivo}</span>
      <span>🕒 ${tiempoDesde(
        ultimaActualizacion ? new Date(ultimaActualizacion) : null
      )}</span>
    `;
  }

  // ===== QUIÉN DEBE + WHATSAPP =====
  quienDebe.innerHTML = personas.map(p => {
    let bal = p.aportado - gastoPersona[p.id];
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

    // ✅ WHATSAPP ACTIVO
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
// ===== RESUMEN PERSONAS =====
const resumenPersonas = document.getElementById("resumenPersonas");

if (resumenPersonas) {
  const gastoPersona = {};
  personas.forEach(p => gastoPersona[p.id] = 0);

  gastos.forEach(g => {
    g.participantes.forEach(id => {
      gastoPersona[id] += g.monto / g.participantes.length;
    });
  });

  resumenPersonas.innerHTML = personas.map(p => `
    <strong>${p.nombre}</strong><br>
    Aportado: ${p.aportado.toFixed(2)} €<br>
    Gastado: ${gastoPersona[p.id].toFixed(2)} €<br><br>
  `).join("");
}

// ===== LISTA GASTOS =====
const listaGastos = document.getElementById("listaGastos");
const hoy = new Date();
const mes = hoy.getMonth();
const año = hoy.getFullYear();

const gastosVisibles = filtrarPorMes(gastos, mes, año);
if (listaGastos) {
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

// ===== GRÁFICO PERSONAS =====
if (typeof Chart !== "undefined" && document.getElementById("graficoPersonas")) {
  if (chartPersonas) chartPersonas.destroy();

  const gastoPersona = {};
  personas.forEach(p => gastoPersona[p.id] = 0);

  gastos.forEach(g => {
    g.participantes.forEach(id => {
      gastoPersona[id] += g.monto / g.participantes.length;
    });
  });

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

  console.log("RENDER OK", { personas, gastos });
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

  console.log("Estado edicionActiva:", edicionActiva);

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

  const gastosMes = filtrarPorMes(gastos, mes, año);
  const totalMes = gastosMes.reduce((sum, g) => sum + (g.monto || 0), 0);

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  let y = 10;

  // 🧾 TÍTULO
  pdf.setFontSize(18);
  pdf.text(`Gastos ${mes + 1}/${año}`, 10, y);
  y += 8;

  pdf.setFontSize(12);
  pdf.text(`Total: ${totalMes.toFixed(2)} €`, 10, y);
  y += 12;

  // 📋 LISTA
  gastosMes.forEach(g => {

    pdf.setFontSize(12);
    pdf.setFont(undefined, "bold");
    pdf.text(g.sitio || g.descripcion, 10, y);

    pdf.text(`${g.monto.toFixed(2)} €`, 185, y, { align: "right" });

    y += 5;

    pdf.setFontSize(10);
    pdf.setFont(undefined, "normal");

    const nombres = g.participantes
      .map(id => {
        const p = personas.find(x => x.id === id);
        return p ? p.nombre : "";
      })
      .join(", ");

    pdf.text(`${g.fecha} · ${nombres}`, 10, y);

    y += 12;

    pdf.setDrawColor(220);
    pdf.line(10, y - 3, 200, y - 3);

    // salto de página
    if (y > 280) {
      pdf.addPage();
      y = 10;
    }

  });

  pdf.save(`gastos_${mes+1}_${año}.pdf`);
};

// 🔹 EXPORTAR MES ACTUAL
window.exportarMesActual = () => {
  const hoy = new Date();
  exportarMesPDF(hoy.getMonth(), hoy.getFullYear());
};
window.exportarMesManual = () => {

  const mes = parseInt(prompt("Mes (1-12):")) - 1;
  const año = parseInt(prompt("Año (ej: 2026):"));

  if (isNaN(mes) || isNaN(año) || mes < 0 || mes > 11) {
    alert("Datos incorrectos");
    return;
  }

  exportarMesPDF(mes, año);
};
// 🔐 Auth anónima


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
const sitioSeleccionado = btnActivo ? btnActivo.dataset.sitio : null;

if (!sitioSeleccionado) {
  alert("Selecciona un sitio");
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
  const gastoPersona={};
  personas.forEach(p=>gastoPersona[p.id]=0);
  gastos.forEach(g=>g.participantes.forEach(id=>gastoPersona[id]+=g.monto/g.participantes.length));
  
resumenPersonas.innerHTML = personas.map(p => {
  // gastos por sitio de esta persona
  const porSitio = {};

  gastos.forEach(g => {
    if (g.participantes.includes(p.id)) {
      const parte = g.monto / g.participantes.length;
      porSitio[g.sitio] = (porSitio[g.sitio] || 0) + parte;
    }
  });

  const textoSitios = Object.keys(porSitio).length
    ? Object.entries(porSitio)
        .map(([s,m]) => `${s} (${m.toFixed(2)} €)`)
        .join(", ")
    : "—";

  return `
    <strong>${p.nombre}</strong><br>
    Aportado: ${p.aportado.toFixed(2)} €<br>
    Gastado: ${gastoPersona[p.id].toFixed(2)} €<br>
    <em>Gastos en:</em> ${textoSitios}<br>
	${edicionActiva ? `
  <br>
  📞 Teléfono:
  <input
    value="${p.telefono || ""}"
    placeholder="346XXXXXXXX"
    onchange="actualizarTelefono(${p.id}, this.value)"
    style="padding:4px; border-radius:6px; border:1px solid #ccc; margin-top:4px;"
  >
  <br>
` : ""}
	<br>
  `;
}).join("");





  const total=personas.reduce((s,p)=>s+p.aportado,0)-gastos.reduce((s,g)=>s+g.monto,0);
 let estadoActual;

if (total < 0) {
  estadoActual = "negativo";
} else if (total <= 20) {
  estadoActual = "bajo";
} else {
  estadoActual = "positivo";
}
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


console.log("TOTAL REAL:", total);
const infoGrupoHTML = `
  <div style="font-size:13px; opacity:0.8; margin-bottom:10px;">
    📂 <strong>${grupoActivo}</strong><br>
    📅 ${textoFechaActualizacion(ultimaActualizacion)}
  </div>
`;
document.getElementById("heroBalance").textContent =
  total.toFixed(2) + " €";
  // 🔥 Actualizar HERO
document.getElementById("heroBalance").textContent =
  total.toFixed(2) + " €";

// Color dinámico
// ===== HERO DINÁMICO (CORREGIDO) =====
const heroBox = document.querySelector(".hero-balance");

const heroMensaje = document.getElementById("heroMensaje");
const heroBalance = document.getElementById("heroBalance");

// 👉 INFO (siempre se pinta igual, fuera del if)
if (heroInfo) {
  heroInfo.innerHTML = `
    <span>📁 Grupo: <strong>${grupoActivo}</strong></span>
    <span>🕒 ${tiempoDesde(
      ultimaActualizacion ? new Date(ultimaActualizacion) : null
    )}</span>
  `;
}

// 👉 COLOR + MENSAJE
if (heroBox && heroMensaje) {

  heroBox.classList.remove("hero-positivo", "hero-negativo", "hero-cero");

  if (total < 0) {

    heroBox.classList.add("hero-negativo");

    heroMensaje.textContent =
      "⚠️ Aquí alguien tiene que invitar a algo...";

  } else if (total === 0) {

    heroBox.classList.add("hero-cero");

    heroMensaje.textContent =
      "🍻 Grupo perfectamente equilibrado.";

  } else {

    heroBox.classList.add("hero-positivo");

    heroMensaje.innerHTML =
      '<span class="estado-badge">😎 Fondo positivo</span>' +
      '<span class="subtexto">Todo bajo control.</span>';
  }
}

// 👉 BALANCE (SIN DUPLICAR VARIABLES)
if (heroBalance) {
  heroBalance.textContent = total.toFixed(2) + " €";
 heroBalance.style.color =
  total < 0 ? "#b71c1c" :
  total === 0 ? "#555" :
  "#1b5e20";
  heroBalance.style.fontWeight = "bold";
  heroBalance.style.textDecoration = "none";
  heroBalance.style.textAlign = "center";
  heroBalance.style.fontSize = "36px";
}

// ===== GRÁFICO PERSONAS (SEGURO) =====
if (typeof Chart !== "undefined" && graficoPersonas) {

  if (chartPersonas) chartPersonas.destroy();

  chartPersonas = new Chart(graficoPersonas, {
    type: "bar",
    data: {
      labels: personas.map(p => p.nombre),
      datasets: [
        {
          label: "Aportado",
          data: personas.map(p => p.aportado),
          backgroundColor: "#4CAF50"
        },
        {
          label: "Gastado",
          data: personas.map(p => gastoPersona[p.id]),
          backgroundColor: "#e53935"
        }
      ]
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

const sitios = {};

gastos.forEach(g => {
  if (!sitios[g.sitio]) {
    sitios[g.sitio] = 0;
  }
  sitios[g.sitio] += g.monto;
});

if(chartSitios) chartSitios.destroy();

chartSitios = new Chart(graficoSitios,{
  type:"doughnut",
  data:{
    labels:Object.keys(sitios),
    datasets:[{
      data:Object.values(sitios),
      backgroundColor:["#4CAF50","#2196F3","#FF9800"]
    }]
  },
 options:{
  plugins:{
    legend:{position:"bottom"},
    tooltip:{
      callbacks:{
        label:function(context){

         const valor = Number(context.raw.toFixed(2));
          const data = context.dataset.data;

          const total = data.reduce((a,b)=>a+b,0);
          const porcentaje = ((valor/total)*100).toFixed(0);

          return ` ${valor} € (${porcentaje}%)`;
        }
      }
    }
  }
}
});

window.generarPDF = () => {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  let y = 15;

  // === TEXTO INICIAL ===
  pdf.setFontSize(20);
  pdf.text("Gastos del grupo", 10, y);
  y += 8;

  pdf.setFontSize(11);
  pdf.text("Fecha: " + new Date().toLocaleDateString(), 10, y);
  y += 10;

  pdf.setFontSize(14);
 const total = gastos.reduce((sum, g) => sum + g.monto, 0);

const totalTexto = total.toFixed(2) + " EUR";

pdf.text(totalTexto, 10, y);
  y += 12;

  // === TABLA PERSONAS ===
  pdf.setFontSize(14);
  pdf.text("Resumen por persona", 10, y);
  y += 8;

  pdf.setFontSize(11);
  pdf.text("Nombre", 10, y);
  pdf.text("Aportó", 70, y);
  pdf.text("Gastó", 105, y);
  pdf.text("Balance", 145, y);
  y += 6;

  pdf.line(10, y, 200, y);
  y += 4;

  personas.forEach(p => {
    const gasto = gastos.reduce(
      (s, g) =>
        g.participantes.includes(p.id)
          ? s + g.monto / g.participantes.length
          : s,
      0
    );
    const bal = p.aportado - gasto;

    pdf.text(p.nombre, 10, y);
    pdf.text(p.aportado.toFixed(2) + " €", 70, y, { align: "right" });
    pdf.text(gasto.toFixed(2) + " €", 105, y, { align: "right" });
    pdf.text(bal.toFixed(2) + " €", 145, y, { align: "right" });

    y += 6;
 

 
});

  // === QUIÉN DEBE ===
  y += 6;
  pdf.setFontSize(14);
  pdf.text("Quién debe y cuánto", 10, y);
  y += 8;

  pdf.setFontSize(11);
  personas.forEach(p => {
    const gasto = gastos.reduce(
      (s, g) =>
        g.participantes.includes(p.id)
          ? s + g.monto / g.participantes.length
          : s,
      0
    );
    const bal = p.aportado - gasto;

    if (bal < 0) {
      pdf.text(`- ${p.nombre} debe ${(-bal).toFixed(2)} €`, 10, y);
      y += 6;
    } else if (bal > 0) {
      pdf.text(`- ${p.nombre} recibe ${bal.toFixed(2)} €`, 10, y);
      y += 6;
    }
  });

  // === NUEVA PÁGINA PARA GRÁFICOS ===
  pdf.addPage();
  y = 15;

  pdf.setFontSize(16);
  pdf.text("Gráficos", 10, y);
  y += 10;

  // === GRÁFICO PERSONAS ===
  const canvasPersonas = document.getElementById("graficoPersonas");
  const imgPersonas = canvasPersonas.toDataURL("image/png", 1.0);
  pdf.text("Aportado vs Gastado", 10, y);
  y += 4;
  pdf.addImage(imgPersonas, "PNG", 10, y, 180, 80);
  y += 90;

  // === GRÁFICO SITIOS ===
  const canvasSitios = document.getElementById("graficoSitios");
  const imgSitios = canvasSitios.toDataURL("image/png", 1.0);
  pdf.text("Gasto por sitio", 10, y);
  y += 4;
  pdf.addImage(imgSitios, "PNG", 40, y, 120, 120);

  pdf.save("gastos_grupo.pdf");
};
function formatDate(dateStr) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
window.generarPDFResumen = () => {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
let seccionActual = "";
let colorSeccion = [0, 0, 0];
const pageHeight = pdf.internal.pageSize.height;
const marginTop = 20;
const marginBottom = 20;

let y = marginTop;
let pageNumber = 1;
  const totalAportado = personas.reduce((s, p) => s + p.aportado, 0);
  const totalGastado = gastos.reduce((s, g) => s + g.monto, 0);
  const saldoGrupo = totalAportado - totalGastado;
  function dibujarEncabezado() {
  pdf.setFontSize(16);
  pdf.setTextColor(0, 0, 0);
  pdf.text("Resumen de gastos del grupo", 105, 12, { align: "center" });

  pdf.setFontSize(9);
  pdf.text(
    "Generado el " + new Date().toLocaleDateString(),
    105,
    17,
    { align: "center" }
  );

  pdf.line(10, 20, 200, 20);
}

function nuevaPagina() {
  pdf.addPage();
  pageNumber++;

  dibujarEncabezado();

  if (seccionActual) {
    y = 32;  // 👈 posición real tras encabezado

    pdf.setFontSize(15);
    pdf.setTextColor(...colorSeccion);
    pdf.text(seccionActual, 10, y);

    y += 6;

    pdf.setDrawColor(...colorSeccion);
    pdf.line(10, y, 200, y);

    y += 8; // espacio antes del contenido
  }
}

function checkPageBreak(espacio = 8) {
  if (y + espacio > pageHeight - marginBottom) {
    nuevaPagina();
    return true;   // 👈 importante
  }
  return false;
}

/* ===== RESUMEN GENERAL ===== */

  

  /* ===== RESUMEN GENERAL ===== */
  pdf.setTextColor(30, 136, 229); // azul
  pdf.setFontSize(14);
  pdf.text("Resumen general", 10, y);
  y += 6;

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(11);
  pdf.text(`Total aportado: ${totalAportado.toFixed(2)} €`, 14, y); y += 5;
  pdf.text(`Total gastado: ${totalGastado.toFixed(2)} €`, 14, y); y += 5;
  pdf.text(`Saldo del grupo: ${saldoGrupo.toFixed(2)} €`, 14, y);
  y += 8;

  /* ===== PERSONAS ===== */
  pdf.setTextColor(67, 160, 71); // verde
  pdf.setFontSize(14);
  pdf.text("Personas", 10, y);
  y += 6;

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10);
  pdf.text("Nombre", 10, y);
  pdf.text("Aportó", 60, y);
  pdf.text("Gastó", 100, y);
  pdf.text("Saldo", 145, y);
  y += 4;
  pdf.line(10, y, 200, y);
  y += 4;

  personas.forEach(p => {
    const gastado = gastos.reduce(
      (s, g) =>
        g.participantes.includes(p.id)
          ? s + g.monto / g.participantes.length
          : s,
      0
    );
    var saldo = p.aportado - gastado;
	
    pdf.text(p.nombre, 10, y);
    pdf.text(p.aportado.toFixed(2) + " €", 60, y);
    pdf.text(gastado.toFixed(2) + " €", 100, y);

    if (saldo >= 0) {
      pdf.setTextColor(67, 160, 71);
    } else if (saldo <= -0.01) {
      pdf.setTextColor(229, 57, 53);
    }
	else {
		saldo = 0;
		pdf.setTextColor(0, 0, 0);
    }
    pdf.text(saldo.toFixed(2) + " €", 145, y);
    pdf.setTextColor(0, 0, 0);

    y += 6;
  });

/* ===== APORTACIONES EN EFECTIVO ===== */

seccionActual = "Aportaciones en efectivo";
colorSeccion = [30, 136, 229];

pdf.setTextColor(30, 136, 229);
pdf.setFontSize(14);
pdf.text("Aportaciones en efectivo", 10, y);
y += 6;

pdf.setTextColor(0, 0, 0);
pdf.setFontSize(10);

// Cabecera
pdf.text("Persona", 10, y);
pdf.text("Cantidad", 80, y);
pdf.text("Fecha", 130, y);
y += 4;
pdf.line(10, y, 200, y);
y += 4;

// Aquí asumimos que tienes un array `cash` o similar
aportaciones.forEach(a => {

 if (y + 8 > pageHeight - marginBottom) {
    nuevaPagina();

    // Solo redibujar cabecera de columnas
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    pdf.text("Persona", 10, y);
    pdf.text("Cantidad", 80, y);
    pdf.text("Fecha", 130, y);
    y += 4;
    pdf.line(10, y, 200, y);
    y += 4;
}

  pdf.text(a.nombre, 10, y);
  pdf.text(a.amount.toFixed(2) + " €", 80, y);
  pdf.text(formatDate(a.date), 130, y);
  y += 6;
});

y += 6;
// ===== GASTO POR DÍA Y SITIO (TABLA COLOREADA) =====

seccionActual = "Gasto por día y sitio";
colorSeccion = [33, 150, 243];

const coloresSitio = {
  Lydo: [76, 175, 80],
  Colono: [33, 150, 243],
  Flap: [255, 152, 0]
};

// Título
pdf.setFontSize(16);
pdf.setTextColor(33, 150, 243);
pdf.text("Gasto por día y sitio", 10, y);
pdf.setTextColor(0, 0, 0);
y += 10;

// 1️⃣ Agrupar gastos por fecha y sitio
const gastosPorDia = {};
gastos.forEach(g => {
  if (!gastosPorDia[g.fecha]) gastosPorDia[g.fecha] = {};
  if (!gastosPorDia[g.fecha][g.sitio]) gastosPorDia[g.fecha][g.sitio] = 0;
  gastosPorDia[g.fecha][g.sitio] += g.monto;
});

// 2️⃣ Convertir a array plano
const listaPorDia = [];
Object.entries(gastosPorDia).forEach(([fecha, sitios]) => {
  Object.entries(sitios).forEach(([sitio, total]) => {
    listaPorDia.push({ fecha, sitio, total });
  });
});

// 3️⃣ Calcular el día más caro
const diaMasCaro = listaPorDia.reduce(
  (max, g) => g.total > max.total ? g : max,
  listaPorDia[0]
);

// 4️⃣ Cabecera de tabla
function pintarCabeceraTabla() {
  pdf.setFillColor(230, 240, 255);
  pdf.rect(10, y - 6, 190, 8, "F");

  pdf.setFontSize(11);
  pdf.setFont(undefined, "bold");
  pdf.text("Fecha", 10, y);
  pdf.text("Sitio", 70, y);
  pdf.text("Total", 150, y);
  pdf.setFont(undefined, "normal");

  y += 6;
  pdf.line(10, y, 200, y);
  y += 4;
}

pintarCabeceraTabla();

// 5️⃣ Filas (con día más caro resaltado)
let fila = 0;

listaPorDia.forEach(g => {
  const esDiaMasCaro = g.fecha === diaMasCaro.fecha;

 checkPageBreak(10);

 
  if (fila % 2 === 0) {
    pdf.setFillColor(245, 245, 245);
    pdf.rect(10, y - 4, 190, 6, "F");
  }

  if (esDiaMasCaro) {
    pdf.setFillColor(255, 220, 220);
    pdf.rect(10, y - 4, 190, 6, "F");
    pdf.setTextColor(200, 0, 0);
  } else {
    pdf.setTextColor(0, 0, 0);
  }

  pdf.text(g.fecha, 10, y);

  const color = coloresSitio[g.sitio] || [0, 0, 0];
  pdf.setTextColor(...color);
  pdf.text(g.sitio, 70, y);

  pdf.setTextColor(0, 0, 0);
  pdf.text(`${g.total.toFixed(2)} €`, 150, y);

  if (esDiaMasCaro) {
    pdf.text("Dia mas caro", 175, y);
  }

  y += 5;
  fila++;
});

// ===== FIN BLOQUE GASTO POR DÍA Y SITIO =====


  /* ===== SITIOS ===== */
  pdf.setTextColor(255, 143, 0); // naranja
  pdf.setFontSize(14);
  // Separación visual antes de Totales por sitio
y += 8; // espacio en blanco

pdf.setDrawColor(220, 220, 220); // línea suave
pdf.line(10, y, 200, y);

y += 8; // espacio después de la línea
checkPageBreak(12);
  pdf.text("Total por sitio", 10, y);
  y += 6;

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(11);

  const porSitio = {};
  gastos.forEach(g => {
    porSitio[g.sitio] = (porSitio[g.sitio] || 0) + g.monto;
  });
const sitios = Object.keys(porSitio);
const colInicio = 14;
const colAncho = 60;

// --- Cabecera: nombres de sitios ---
pdf.setFont(undefined, "bold");

sitios.forEach((sitio, i) => {
  const x = colInicio + i * colAncho;
  pdf.text(sitio, x, y);
});

pdf.setFont(undefined, "normal");
y += 7;

// --- Fila: totales ---
sitios.forEach((sitio, i) => {
  const x = colInicio + i * colAncho;
  pdf.text(`${porSitio[sitio].toFixed(2)} €`, x, y);
});

y += 10;

  

  pdf.save("resumen_gastos_1_pagina.pdf");
};

window.exportarAportacionesAnualPro = () => {

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  let y = 15;

  const hoy = new Date();
  const año = hoy.getFullYear();
  const hoyTxt = hoy.toLocaleDateString("es-ES");

  const inicioAño = new Date(año, 0, 1);

  // 🟦 HEADER
  pdf.setFillColor(30, 60, 120);
  pdf.rect(0, 0, 210, 30, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("CAFÉ SEMANAL", 10, 12);

  pdf.setFontSize(11);
  pdf.text("Aportaciones del año", 10, 20);
  pdf.text(`Fecha: ${hoyTxt}`, 150, 20);

  pdf.setTextColor(0, 0, 0);

  y = 40;

  let totalGlobal = 0;

  personas.forEach(p => {

    const aportes = aportaciones
      .filter(a => {
        if (a.personaId !== p.id) return false;
        if (!a.date) return false;

        const f = new Date(a.date);
        return f >= inicioAño && f <= hoy;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (aportes.length === 0) return;

    // 👤 NOMBRE
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(p.nombre.toUpperCase(), 10, y);
    y += 6;

    const totalPersona = p.aportado || 0;

    aportes.forEach(a => {

      const fecha = new Date(a.date).toLocaleDateString("es-ES");

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);

      pdf.text(fecha, 12, y);
      pdf.text(`+${a.amount.toFixed(2)} €`, 170, y, { align: "right" });

     
      y += 5;

      if (y > 270) {
        pdf.addPage();
        y = 20;
      }

    });

    // ➖ línea
    y += 2;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(10, y, 200, y);
    y += 5;

    // 💰 TOTAL PERSONA
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);

    pdf.text("Total", 12, y);

    pdf.setTextColor(0, 102, 0);
    pdf.text(`${totalPersona.toFixed(2)} €`, 170, y, { align: "right" });

    pdf.setTextColor(0, 0, 0);

    totalGlobal += totalPersona;

    y += 10;

  });

  // 🔻 TOTAL GLOBAL
  y += 5;

  pdf.setFillColor(240, 240, 240);
  pdf.rect(10, y - 6, 190, 12, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);

  pdf.text("TOTAL GENERAL", 12, y);

  pdf.setTextColor(0, 120, 0);
  pdf.text(`${totalGlobal.toFixed(2)} €`, 170, y, { align: "right" });

  pdf.setTextColor(0, 0, 0);

  // 🧾 FOOTER
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text("Generado automáticamente", 10, 290);

  pdf.save(`aportaciones_${año}_pro.pdf`);
};
window.exportarGastosTotalesPro = () => {

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  let y = 15;
  const hoy = new Date().toLocaleDateString("es-ES");

  // 🟦 HEADER
  pdf.setFillColor(30, 60, 120);
  pdf.rect(0, 0, 210, 30, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("CAFÉ SEMANAL", 10, 12);

  pdf.setFontSize(11);
  pdf.text(`Gastos por persona`, 10, 20);
  pdf.text(`Fecha: ${hoy}`, 150, 20);

  pdf.setTextColor(0, 0, 0);

  y = 40;

  let totalGeneral = 0;

  personas.forEach(p => {

    let totalGastado = 0;

    gastos.forEach(g => {
      if (!g.participantes || !g.monto) return;

      if (g.participantes.includes(p.id)) {
        const parte = g.monto / g.participantes.length;
        totalGastado += parte;
      }
    });

    if (totalGastado === 0) return;

    // 👤 nombre
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(p.nombre.toUpperCase(), 10, y);

    // 💰 importe
    pdf.setFont("helvetica", "normal");
    pdf.text(`${totalGastado.toFixed(2)} €`, 170, y, { align: "right" });

    y += 8;

    // línea suave
    pdf.setDrawColor(220, 220, 220);
    pdf.line(10, y, 200, y);

    y += 6;

    totalGeneral += totalGastado;

    if (y > 270) {
      pdf.addPage();
      y = 20;
    }

  });

  // 🔻 TOTAL DESTACADO
  y += 10;

  pdf.setFillColor(240, 240, 240);
  pdf.rect(10, y - 6, 190, 12, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);

  pdf.text("TOTAL GENERAL", 12, y);

  pdf.setTextColor(0, 120, 0);
  pdf.text(`${totalGeneral.toFixed(2)} €`, 170, y, { align: "right" });

  pdf.setTextColor(0, 0, 0);

  // 🧾 FOOTER
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text("Generado automáticamente", 10, 290);

  pdf.save("gastos_totales_pro.pdf");
};
window.exportarResumenFinal = () => {

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  let y = 15;
  const hoy = new Date().toLocaleDateString("es-ES");

  // 🟦 HEADER
  pdf.setFillColor(30, 60, 120);
  pdf.rect(0, 0, 210, 30, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("CAFÉ SEMANAL", 10, 12);

  pdf.setFontSize(11);
  pdf.text("Resumen general", 10, 20);
  pdf.text(`Fecha: ${hoy}`, 150, 20);

  pdf.setTextColor(0, 0, 0);

  y = 40;

  let totalAportadoGlobal = 0;
  let totalGastadoGlobal = 0;

  personas.forEach(p => {

    // 👉 APORTADO (real)
    const aportado = p.aportado || 0;

    // 👉 GASTADO (real)
    let gastado = 0;

    gastos.forEach(g => {
      if (!g.participantes || !g.monto) return;

      if (g.participantes.includes(p.id)) {
        const parte = g.monto / g.participantes.length;
        gastado += parte;
      }
    });

    const saldo = aportado - gastado;

    // 👤 NOMBRE
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(p.nombre.toUpperCase(), 10, y);
    y += 6;

    // 📊 DATOS
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);

    pdf.text(`Aportado: ${aportado.toFixed(2)} €`, 12, y);
    y += 5;

    pdf.text(`Gastado: ${gastado.toFixed(2)} €`, 12, y);
    y += 5;

    // 💰 SALDO (color)
    if (saldo >= 0) {
      pdf.setTextColor(0, 120, 0); // verde
    } else {
      pdf.setTextColor(200, 0, 0); // rojo
    }

    pdf.text(`Saldo: ${saldo.toFixed(2)} €`, 12, y);

    pdf.setTextColor(0, 0, 0);

    y += 8;

    // línea separación
    pdf.setDrawColor(220, 220, 220);
    pdf.line(10, y, 200, y);
    y += 6;

    totalAportadoGlobal += aportado;
    totalGastadoGlobal += gastado;

    if (y > 270) {
      pdf.addPage();
      y = 20;
    }

  });

  const saldoGlobal = totalAportadoGlobal - totalGastadoGlobal;

  // 🔻 TOTAL FINAL
  y += 10;

  pdf.setFillColor(240, 240, 240);
  pdf.rect(10, y - 6, 190, 18, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);

  pdf.text("TOTAL GENERAL", 12, y);

  y += 6;

  pdf.setFontSize(11);
  pdf.text(`Aportado: ${totalAportadoGlobal.toFixed(2)} €`, 12, y);
  pdf.text(`Gastado: ${totalGastadoGlobal.toFixed(2)} €`, 80, y);

  // saldo global color
  if (saldoGlobal >= 0) {
    pdf.setTextColor(0, 120, 0);
  } else {
    pdf.setTextColor(200, 0, 0);
  }

  pdf.text(`Saldo: ${saldoGlobal.toFixed(2)} €`, 150, y);

  pdf.setTextColor(0, 0, 0);

  // 🧾 FOOTER
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text("Generado automáticamente", 10, 290);

  pdf.save("resumen_final.pdf");
};
function enviarWhatsAppPersona(p) {

  const nombre = p.nombre;
  const aportado = p.aportado || 0;

  const gastado = calcularGastadoPersona(p.id);
  const saldo = aportado - gastado;

  let mensaje = `☕ *Cafe semanal*\n\n`;
  mensaje += `👤 ${nombre}\n`;
  mensaje += `💰 Aportado: ${aportado.toFixed(2)} €\n`;
  mensaje += `💸 Gastado: ${gastado.toFixed(2)} €\n`;
  mensaje += `📊 Saldo: ${saldo.toFixed(2)} €`;

  const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

  window.open(url, "_blank");
}