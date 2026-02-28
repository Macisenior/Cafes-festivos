import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,  
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { 
  auth, 
  db, 
  signInAnonymously, 
  onAuthStateChanged 
 
} from "./firebase.js";

console.log("APP JS CARGADO");
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
let soloLectura = new URLSearchParams(location.search).has("readonly");
document.addEventListener("DOMContentLoaded", async () => {

  const btnCrearGrupo = document.getElementById("btnCrearGrupo");
  console.log("Intentando login anónimo...");
  signInAnonymously(auth).catch(console.error);

  // ✅ Esperar a auth
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const loading = document.getElementById("loading");
      if (loading) loading.style.display = "block";

      console.log("Auth OK", user.uid);

      await new Promise(resolve => setTimeout(resolve, 1500));
      await cargarListaGrupos();
      await cargar();
      render();

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

async function cargarListaGrupos() {
  const snap = await getDocs(collection(db, "grupos"));
  const selector = document.getElementById("selectorGrupo");

  if (!selector) return;

  selector.innerHTML = "";

  snap.forEach(docSnap => {
    const option = document.createElement("option");
    const data = docSnap.data();    
    option.value = docSnap.id;
    option.textContent = `${data.emoji || "📁"} ${data.nombreVisible || docSnap.id}`;

    selector.appendChild(option);
  });

  // 👇 ESTO VA DENTRO DE LA FUNCIÓN, pero FUERA del forEach
  if (selector.options.length === 0) {
    const option = document.createElement("option");
    option.value = "general";
    option.textContent = "☕ Grupo Cafés";
    selector.appendChild(option);
  }

  selector.value = grupoActivo;
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
  color: "#0f766e", // verde elegante
  personas: [],
  gastos: [],
  aportaciones: [],
  pin: null
});
  grupoActivo = nombre;
  localStorage.setItem("grupoActivo", nombre);

  await cargarListaGrupos();
  await cargar();
  render();
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
  await cargar();
  render();
};

// 🔄 Cambio de grupo desde selector
document.addEventListener("change", async (e) => {
  if (e.target.id === "selectorGrupo") {
  if (!edicionActiva) {
      alert("Debes desbloquear la edición con el PIN");
      e.target.value = grupoActivo; // vuelve al grupo anterior
      return;
    }
    grupoActivo = e.target.value;
    localStorage.setItem("grupoActivo", grupoActivo);
	
    edicionActiva = false;

    personas = [];
    gastos = [];
    aportaciones = [];
    pinGuardado = null;
await cargar();   // 👈 CARGAR DATOS DEL NUEVO GRUPO
render();         // 👈 ACTUALIZAR UI
   
  }
});

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
async function cargar(){
  const snap = await getDoc(getDocRef());

  if(snap.exists()){
    const d = snap.data();

    aportaciones = d.aportaciones || [];
    personas = d.personas || [];
    gastos = d.gastos || [];
    pinGuardado = d.pin || null;

    ultimaActualizacion =
      d.ultimaActualizacion?.toDate?.() ||
      d.ultimaActualizacion ||
      null;

    console.log("Datos cargados:", personas, gastos);

  } else {
    console.log("Documento NO existe");
  }

  edicionActiva = false; // 🔐 FORZAR bloqueo al cargar

  const btnCrearGrupo = document.getElementById("btnCrearGrupo");
  if (btnCrearGrupo) btnCrearGrupo.style.display = "none";

  const dangerZone = document.getElementById("dangerZone");
  if (dangerZone) dangerZone.classList.add("hidden");
}

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

  if (!pinGuardado) {
    const nuevo = prompt("Crea un PIN para editar");
    if (!nuevo) return;

    pinGuardado = nuevo;
    edicionActiva = true;

    await guardar();
    activarEdicion();
    render();   // 🔥 AÑADIR ESTA LÍNEA
    return;
  }

  const intento = prompt("Introduce el PIN");

  if (String(intento) === String(pinGuardado)) {
    edicionActiva = true;
    activarEdicion();
    render();
  }
};
function activarEdicion(){
  if (soloLectura) return;

  edicionActiva = true;   // 🔥 ESTO FALTABA

  pinCard.classList.add("hidden");
  modoEdicion.classList.remove("hidden");

  document.querySelectorAll(".editable")
    .forEach(e => e.classList.remove("hidden"));

  const btnCrearGrupo = document.getElementById("btnCrearGrupo");
  if (btnCrearGrupo) btnCrearGrupo.style.display = "block";

  const dangerZone = document.getElementById("dangerZone");
  if (grupoActivo !== "general") {
    dangerZone.classList.remove("hidden");
  }
}
document.getElementById


window.añadirEfectivo = async () => {
  const p = personas.find(p => p.id == personaEfectivo.value);
  const amount = +efectivoExtra.value;
  const date = cashDate.value;

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
  const part = [...checkboxPersonas.querySelectorAll("input:checked")]
    .map(c => +c.value);

  const fecha = fechaGasto.value
    ? new Date(fechaGasto.value).toLocaleDateString()
    : new Date().toLocaleDateString();

 if (gastoEditando) {

  gastos = gastos.map(g =>
    g.id === gastoEditando
      ? {
          ...g,
          sitio: sitio.value,
          descripcion: descripcionGasto.value,
          monto: +montoGasto.value,
          participantes: part
        }
      : g
  );

  gastoEditando = null;

  const btn = document.querySelector("#botonAgregarGasto");
  if (btn) btn.textContent = "Añadir gasto";

} else {

  gastos.push({
    id: Date.now(),
    sitio: sitio.value,
    descripcion: descripcionGasto.value,
    monto: +montoGasto.value,
    participantes: part,
    fecha
  });

} 
  descripcionGasto.value = "cafes";
  montoGasto.value = "";
  fechaGasto.value = "";

  await guardar();
  render();
};

window.actualizarTelefono = async (id, valor) => {
  const persona = personas.find(p => p.id === id);
  if (!persona) return;

  persona.telefono = valor.trim();

  await guardar();
  render();
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
function render(){
const heroInfo = document.getElementById("heroInfo");

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
  checkboxPersonas.innerHTML = personaEfectivo.innerHTML = "";
personas.forEach(p => {

  let botonEliminar = "";

  if (edicionActiva) {
    botonEliminar = `
      <button onclick="eliminarPersona(${p.id})"
        style="background:#e53935; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:8px; font-size:14px;">
        🗑
      </button>
    `;
  }

  checkboxPersonas.innerHTML += `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" value="${p.id}" style="width:18px; height:18px; cursor:pointer;">
        <span style="font-size:15px;">${p.nombre}</span>
      </div>
      ${botonEliminar}
    </div>
  `;

  personaEfectivo.innerHTML += `
    <option value="${p.id}">${p.nombre}</option>
  `;
});


// ===== Navegación entre pantallas =====

window.abrirGestionGastos = function() {
  const principal = document.getElementById("pantallaPrincipal");
  const gastos = document.getElementById("pantallaGastos");

  if (principal) principal.style.display = "none";
  if (gastos) gastos.style.display = "block";
};

window.volverPrincipal = function() {
  const principal = document.getElementById("pantallaPrincipal");
  const gastos = document.getElementById("pantallaGastos");

  if (gastos) gastos.style.display = "none";
  if (principal) principal.style.display = "block";
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

const listaGastos = document.getElementById("listaGastos");

if (listaGastos) {
  listaGastos.innerHTML = gastos.map(g => `
    <div style="margin-bottom:8px; padding:6px; border-bottom:1px solid #ddd;">
      <strong>${g.descripcion}</strong> - ${g.monto.toFixed(2)} €
      (${g.fecha})<br>
      👥 ${g.participantes.map(id => {
        const persona = personas.find(p => p.id === id);
        return persona ? persona.nombre : "";
      }).join(", ")}

      ${edicionActiva ? `
     <button onclick="eliminarGasto('${g.id}')"
  style="margin-top:6px; background:#e53935; color:white; border:none; padding:6px 12px; border-radius:8px; cursor:pointer;">
  ❌ Eliminar
</button>  
      ` : ""}
    </div>
  `).join("");
}

 quienDebe.innerHTML = personas.map(p => {

  var bal = p.aportado - gastoPersona[p.id];
  if (bal > -0.01 && bal < 0.01) bal = 0;

  let texto = "";

  if (bal < -0.01) {
    texto = `🔴 ${p.nombre} debe ${(-bal).toFixed(2)} €`;
  } else if (bal > 0.01) {
    texto = `🟢 ${p.nombre} dispone de ${bal.toFixed(2)} €`;
  } else {
    texto = `⚪ ${p.nombre} equilibrado`;
  }

  // 👉 CAPRICHO WHATSAPP
  if (bal < 0 && p.telefono) {

const mensaje = encodeURIComponent(
  `Ey ${p.nombre} 😄 Te quedan ${(-bal).toFixed(2)} € pendientes en el grupo. ¡Invita a algo antes de que te embarguemos el bocata! 🥪💸`
);

    const enlace = `https://wa.me/${p.telefono}?text=${mensaje}`;

    texto += `
      <a href="${enlace}" target="_blank"
         style="margin-left:8px; background:#25D366; color:white; padding:3px 6px; border-radius:6px; text-decoration:none;">
         📱 Avisar
      </a>
    `;
  }

  return texto;

}).join("<br>");

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
}, 150);
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
const heroBox = document.querySelector(".hero-balance");

if (total < 0) {
const heroInfo = document.getElementById("heroInfo");

if (heroInfo) {
  heroInfo.innerHTML = `
    <span>📁 Grupo: <strong>${grupoActivo}</strong></span>
    <span>🕒 Actualizado: <strong>${tiempoDesde(
      ultimaActualizacion ? new Date(ultimaActualizacion) : null
    )}</strong></span>
  `;
} 

  heroBox.style.background =
    "linear-gradient(135deg, #e53935, #b71c1c)";
  document.getElementById("heroMensaje").textContent =
    "⚠️ Aquí alguien tiene que invitar a algo...";
} else if (total === 0) {
  heroBox.style.background =
    "linear-gradient(135deg, #2196F3, #1565C0)";
  document.getElementById("heroMensaje").textContent =
    "🍻 Grupo perfectamente equilibrado.";
} else {
  heroBox.style.background =
   "linear-gradient(135deg, #a5d6a7, #66bb6a)";
 document.getElementById("heroMensaje").innerHTML =
  '<span class="estado-badge">😎 Fondo positivo</span>' +
  '<span class="subtexto">Todo bajo control.</span>';
}
  totalRestante.style.color=total<0?"#e53935":"#2e7d32";
  totalRestante.style.fontWeight = "bold";
  totalRestante.style.textDecoration = "underline";
  totalRestante.style.textAlign = "center";
  totalRestante.style.fontSize = "20px";
  if(chartPersonas) chartPersonas.destroy();
  chartPersonas=new Chart(graficoPersonas,{
    type:"bar",
    data:{
      labels:personas.map(p=>p.nombre),
      datasets:[
        {label:"Aportado",data:personas.map(p=>p.aportado),backgroundColor:"#4CAF50"},
        {label:"Gastado",data:personas.map(p=>gastoPersona[p.id]),backgroundColor:"#e53935"}
      ]
    },
    options:{plugins:{legend:{position:"bottom"}},scales:{y:{beginAtZero:true}}}
  });

  const sitios={Flap:0,Colono:0,Lydo:0};
  gastos.forEach(g=>sitios[g.sitio]+=g.monto);
  if(chartSitios) chartSitios.destroy();
  chartSitios=new Chart(graficoSitios,{
    type:"doughnut",
    data:{labels:Object.keys(sitios),datasets:[{data:Object.values(sitios),backgroundColor:["#4CAF50","#2196F3","#FF9800"]}]},
    options:{plugins:{legend:{position:"bottom"}}}
  });
}
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
 const totalTexto = totalRestante.innerText
  .replace("€", " EUR")
  .replace("💰", "");
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



