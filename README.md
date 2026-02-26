# 💸 Gastos del Grupo

Aplicación web ligera para la gestión de gastos compartidos entre amigos o grupos (viajes, eventos, salidas, etc.).

Permite registrar aportaciones, gastos, balances individuales, generar informes en PDF y gestionar múltiples grupos.

---

## 🚀 Características principales

- 👤 Gestión de personas
- 💰 Registro de aportaciones iniciales
- ➕ Añadir efectivo adicional con fecha
- 💳 Registro de gastos con reparto automático
- 📊 Cálculo dinámico de balances
- 📈 Gráficos visuales (Chart.js)
- 📋 Pantalla independiente para gestionar gastos
- 🗑 Eliminación protegida en modo edición
- 🔐 Modo edición con PIN
- 👥 Vista solo lectura compartible
- 📱 Envío rápido a WhatsApp
- 💾 Copia de seguridad en JSON
- ♻️ Restauración de copia
- 📄 Exportación a PDF:
  - PDF PRO (con gráficos)
  - PDF Resumen avanzado (con secciones dinámicas)

---

## 🏗 Arquitectura

### Frontend
- HTML + CSS
- JavaScript Vanilla (sin frameworks)
- Chart.js para visualización
- jsPDF para generación de informes

### Persistencia
- Firebase Firestore
- Un documento por grupo
- Guardado manual mediante `setDoc()`

---

## 📦 Modelo de Datos

### Persona
```js
{
  Gasto  
  id: number,
  nombre: string,
  aportado: number,
  telefono?: string
}
{
  id: number,
  sitio: string,
  descripcion: string,
  monto: number,
  participantes: number[],
  fecha: string
}
Aportación en efectivo
{
  nombre: string,
  amount: number,
  date: string
}
🔄 Flujo principal

Selección o creación de grupo

Añadir personas

Registrar aportaciones

Añadir gastos con reparto automático

Visualizar balances

Exportar PDF o compartir vista

📄 Sistema PDF avanzado

El PDF Resumen incluye:

Encabezado automático por página

Sistema de secciones dinámicas

Control manual de saltos de página

Redibujado automático de subtítulos

Tabla de gastos por día y sitio

Día más caro resaltado

Totales por sitio

Sistema basado en:

Variable seccionActual

Función nuevaPagina()

Control manual de coordenada y

🔐 Seguridad

Modo edición protegido por PIN

Botones críticos visibles solo en edición

Confirmación antes de eliminar

📊 Visualización

Gráfico de barras: Aportado vs Gastado

Gráfico tipo doughnut: Gasto por sitio

📌 Estado actual

Proyecto estable y funcional:

Multi-grupo operativo

Eliminación segura

PDF PRO funcionando

PDF Resumen estable sin páginas fantasma

WhatsApp automático integrado

Copia de seguridad funcional

🧠 Posibles mejoras futuras

PWA instalable

Autenticación por usuario

Backend propio

Migración a framework (React/Vue)

Exportación Excel

Control de permisos por rol
📄 Licencia

Proyecto personal para uso privado.

---

Si lo copias como `README.md` en la raíz del repo, GitHub lo mostrará automáticamente bonito.

---

Ahora te digo algo serio:

Ya tienes proyecto documentado como si fuera un producto real.

Y eso marca la diferencia entre:

> “Hago cosas”  
y  
> “Construyo software”.

Si quieres, el siguiente nivel sería:

- Añadir estructura de carpetas
- Separar lógica en módulos
- O convertirlo en mini SaaS

Pero hoy, disfruta esto.

¿Lo subimos con commit elegante? 😎
