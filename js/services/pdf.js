
export function generarPDF(personas, gastos) {
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
export function exportarMesPDF(mes, año, personas, gastos) {

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
export function exportarMesActual(personas, gastos) {
  const hoy = new Date();
 exportarMesPDF(hoy.getMonth(), hoy.getFullYear(), personas, gastos);
};
export function exportarMesManual(personas, gastos) {

  const mes = parseInt(prompt("Mes (1-12):")) - 1;
  const año = parseInt(prompt("Año (ej: 2026):"));

  if (isNaN(mes) || isNaN(año) || mes < 0 || mes > 11) {
    alert("Datos incorrectos");
    return;
  }

 exportarMesPDF(mes, año, personas, gastos);
};
// 🔐 Auth anónima
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
export function generarPDFResumen(personas, gastos, aportaciones) {
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
export function exportarAportacionesAnualPro(personas, aportaciones) {

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
export function exportarGastosTotalesPro(personas, gastos) {

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
export function exportarResumenFinal(personas, gastos) {

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