// --- CONFIGURACIÓN BASE DE DATOS DE FIREBASE ---
// Línea 2 corregida (Asegurate de usar TU link de Firebase sin barra '/' al final):
// --- CORRECCIÓN EN LA LÍNEA 2 DE TU script.js ---
const FIREBASE_DB = "https://mi-web000-default-rtdb.firebaseio.com";

// Variables Globales de Estado Interno
let abonadoActualId = "";
let datosClienteActivo = null;
let mesSeleccionadoCobro = "";
let localidadSeleccionadaId = "";

document.addEventListener("DOMContentLoaded", () => {
  listadoClientes();
  procesarAlertasCortes();
});

// --- ENRUTADOR DINÁMICO DE PESTAÑAS (SIDEBAR) ---
function cambiarSeccion(idSeccion) {
  const secciones = document.querySelectorAll('.seccion');
  secciones.forEach(s => s.classList.remove('active'));
  
  const itemsMenu = document.querySelectorAll('.sidebar-menu li');
  itemsMenu.forEach(i => i.classList.remove('active'));

  const seccionDestino = document.getElementById(idSeccion);
  if(seccionDestino) {
    seccionDestino.classList.add('active');
  }

  const mapeoMenus = {
    'sec-inicio': 'menu-inicio',
    'sec-clientes': 'menu-clientes',
    'sec-cobertura': 'menu-cobertura',
    'sec-pagos': 'menu-pagos',
    'sec-cortes': 'menu-cortes'
  };
  const menuId = mapeoMenus[idSeccion];
  if(menuId) document.getElementById(menuId).classList.add('active');

  // Ejecución asincrónica selectiva por sección
  
  if (idSeccion === 'sec-clientes') { listadoClientes(); }
  if (idSeccion === 'sec-cobertura') { listarLocalidades(); }
  if (idSeccion === 'sec-pagos') { cargarClientesDesplegableGlobal(); } // <-- NUEVA ACCIÓN
  // Buscá esta línea adentro de cambiarSeccion(idSeccion)
  if (idSeccion === 'sec-cortes') { 
    cargarLocalidadesFiltroCortes(); // <-- NUEVA ACCIÓN DE APOYO
    procesarAlertasCortes(); 
  }

}

// --- MÓDULO DE ABONADOS: RENDERIZACIÓN DE TABLA PRINCIPAL ---
async function listadoClientes() {
  try {
    const res = await fetch(`${FIREBASE_DB}/abonados.json`);
    const data = await res.json();
    const tbody = document.getElementById('body-clientes');
    if(!tbody) return;
    tbody.innerHTML = "";
    
    let total = 0, activos = 0, deudores = 0;

    if (data) {
      Object.keys(data).forEach(id => {
        const c = data[id];
        total++;
        
        // Control de estado basado en Octubre 2026
        const mesCritico = c.meses && c.meses["Octubre 2026"];
        const estaPagado = mesCritico === "Pagado" || (mesCritico && mesCritico.estado === "Pagado");
        
        let badgeEstado = "";
        if (estaPagado) {
          activos++;
          badgeEstado = `<span class="badge badge-activo">Activo</span>`;
        } else {
          deudores++;
          badgeEstado = `<span class="badge badge-deuda">Con Deuda</span>`;
        }
        
        const tr = document.createElement('tr');
        tr.style.cursor = "pointer";
        tr.className = "fila-cliente";
        
        tr.innerHTML = `
          <td style="font-weight:bold; color:var(--primary);" onclick="verDetalleAbonado('${id}')">👤 ${c.nombre}</td>
          <td onclick="verDetalleAbonado('${id}')" style="text-transform: capitalize;">${c.localidad}</td>
          <td onclick="verDetalleAbonado('${id}')" style="text-transform: capitalize;">${c.barrio}</td>
          <td onclick="verDetalleAbonado('${id}')" style="font-family: monospace;">${c.cel}</td>
          <td onclick="verDetalleAbonado('${id}')">${badgeEstado}</td>
          <td style="text-align: center; display: flex; gap: 10px; justify-content: center;">
            <button class="btn" style="background:none; cursor:pointer; padding:2px 6px;" title="Editar Cliente" onclick="event.stopPropagation(); abrirFichaEdicion('${id}')">✏️</button>
            <button class="btn" style="background:none; cursor:pointer; padding:2px 6px;" title="Eliminar Cliente" onclick="event.stopPropagation(); bajaAbonado('${id}')">❌</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
    
    if(document.getElementById('kpi-total')) {
      document.getElementById('kpi-total').textContent = total;
      document.getElementById('kpi-activos').textContent = activos;
      document.getElementById('kpi-deudores').textContent = deudores;
    }
  } catch (error) {
    console.error("Error en listadoClientes:", error);
  }
}


function filtrarClientes() {
  const termino = document.getElementById('buscar-cliente').value.toLowerCase();
  const filas = document.querySelectorAll('#body-clientes tr');
  filas.forEach(fila => {
    const celdaNombre = fila.querySelector('td');
    const nombre = celdaNombre ? celdaNombre.textContent.toLowerCase() : '';
    fila.style.display = nombre.includes(termino) ? "" : "none";
  });
}
// --- MÓDULO DE GESTIÓN INTERACTIVA MENSUAL POR CLIENTE ---
async function verDetalleAbonado(id) {
  abonadoActualId = id;
  const res = await fetch(`${FIREBASE_DB}/abonados/${id}.json`);
  const c = await res.json();
  if(!c) return;

  document.getElementById('f-id').textContent = id;
  document.getElementById('f-dni').textContent = c.dni;
  document.getElementById('f-loc').textContent = c.localidad;
  document.getElementById('f-barrio').textContent = c.barrio;
  document.getElementById('f-dir').textContent = c.direccion;
  document.getElementById('f-cel').textContent = c.cel;

  const anioSeleccionado = document.getElementById('ficha-anio-selector').value;
  renderizarMesesFicha(c, anioSeleccionado);

  const contenedorFicha = document.getElementById('ficha-abonado');
  contenedorFicha.style.display = 'block';
  contenedorFicha.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function actualizarAñoFicha() {
  if (!abonadoActualId || !datosClienteActivo) return;
  const anioSeleccionado = document.getElementById('ficha-anio-selector').value;
  renderizarMesesFicha(datosClienteActivo, anioSeleccionado);
}

function renderizarMesesFicha(cliente, anio) {
  datosClienteActivo = cliente;
  const grilla = document.getElementById('f-meses-grilla');
  grilla.innerHTML = ""; 
  
  const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  
  mesesNombres.forEach(m => {
    const llaveMesAnio = `${m} ${anio}`;
    const datosMes = cliente.meses && cliente.meses[llaveMesAnio];
    
    let estado = "Deudor";
    let detalleVisual = "(Deudor)";
    let clase = "mes-box mes-deuda";

    if (datosMes) {
      if (typeof datosMes === "object" && datosMes.estado === "Pagado") {
        estado = "Pagado";
        const [a, mesD, d] = datosMes.fechaPago.split("-");
        const montoVal = datosMes.monto || 0;
        detalleVisual = `🟢 ${d}/${mesD}<br><b>$${montoVal}</b>`;
        clase = "mes-box mes-pago";
      } else if (datosMes === "Pagado") {
        estado = "Pagado";
        detalleVisual = "🟢 Migrado<br><b>\$0</b>";
        clase = "mes-box mes-pago";
      }
    }

    grilla.innerHTML += `
      <div class="${clase}" style="cursor: pointer; transition: transform 0.1s; min-height: 58px; display: flex; flex-direction: column; justify-content: center;" 
           onclick="abrirFichaCobroMes('${llaveMesAnio}')"
           onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
        <strong>${llaveMesAnio}</strong>
        <span style="font-size: 11px; margin-top: 2px; font-weight: normal; line-height: 1.2;">${detalleVisual}</span>
      </div>
    `;
  });
}

function abrirFichaCobroMes(llaveMesAnio) {
  mesSeleccionadoCobro = llaveMesAnio;
  const c = datosClienteActivo;
  if (!c) return;

  document.getElementById('m-cobro-cliente').textContent = c.nombre;
  document.getElementById('m-cobro-mes').textContent = llaveMesAnio;
  
  const datosMes = c.meses && c.meses[llaveMesAnio];
  const btnAnular = document.getElementById('btn-anular-pago-mes');

  // --- CORRECCIÓN DE FIJACIÓN DE FECHA SEGURA ---
  if (datosMes && (datosMes === "Pagado" || datosMes.estado === "Pagado")) {
    btnAnular.style.display = "block";
    document.getElementById('input-fecha-pago').value = datosMes.fechaPago || "";
    document.getElementById('input-monto-pago').value = datosMes.monto || "";
  } else {
    btnAnular.style.display = "none";
    document.getElementById('input-monto-pago').value = "";
    
    // Calcula la fecha de hoy adaptada de manera segura al huso horario local (AAAA-MM-DD)
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    
    document.getElementById('input-fecha-pago').value = `${año}-${mes}-${dia}`;
  }
  
  document.getElementById('modal-cobro-mes').classList.add('open');
  document.getElementById('btn-confirmar-pago-mes').onclick = ejecutarPagoMesEspecifico;
}


async function ejecutarPagoMesEspecifico() {
  if (!abonadoActualId || !mesSeleccionadoCobro) return;
  const fechaElegida = document.getElementById('input-fecha-pago').value;
  const montoInput = document.getElementById('input-monto-pago').value;
  
  if (!fechaElegida) { alert("La fecha de cobro es obligatoria."); return; }
  const montoElegido = montoInput === "" ? 0 : Number(montoInput);

  const transaccion = { estado: "Pagado", fechaPago: fechaElegida, monto: montoElegido };

  await fetch(`${FIREBASE_DB}/abonados/${abonadoActualId}/meses/${mesSeleccionadoCobro}.json`, {
    method: 'PUT',
    body: JSON.stringify(transaccion)
  });
  cerrarModalCobroMes();
  verDetalleAbonado(abonadoActualId);
  listadoClientes();
}

async function ejecutarAnulacionMes() {
  if (confirm(`¿Desea anular por completo el cobro de ${mesSeleccionadoCobro}? Volverá a Deuda.`)) {
    await fetch(`${FIREBASE_DB}/abonados/${abonadoActualId}/meses/${mesSeleccionadoCobro}.json`, {
      method: 'PUT', body: JSON.stringify("Deuda")
    });
    cerrarModalCobroMes();
    verDetalleAbonado(abonadoActualId);
    listadoClientes();
  }
}

function cerrarModalCobroMes() { document.getElementById('modal-cobro-mes').classList.remove('open'); }
// --- MÓDULO DE NUEVAS INSCRIPCIONES (ALTAS MULTI-AÑO POR LOTE) ---
function abrirFichaInscripcion() {
  fetch(`${FIREBASE_DB}/geografia/localidades.json`).then(r => r.json()).then(data => {
    const sel = document.getElementById('ins-localidad');
    if(!sel) return;
    sel.innerHTML = "";
    if(data) {
      Object.keys(data).forEach(id => {
        sel.innerHTML += `<option value="${data[id].nombre}">${data[id].nombre}</option>`;
      });
      // Fuerza la carga de los barrios de la primera localidad de la lista inmediatamente
      actualizarBarriosDesplegableInscripcion();
    }
  });
  document.getElementById('modal-inscripcion').classList.add('open');
}

function cerrarFichaInscripcion() { document.getElementById('modal-inscripcion').classList.remove('open'); }

document.getElementById('form-nuevo-cliente').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dni = document.getElementById('ins-dni').value;
  const nombre = document.getElementById('ins-nombre').value;
  const cel = document.getElementById('ins-cel').value;
  const localidad = document.getElementById('ins-localidad').value;
  const barrio = document.getElementById('ins-barrio').value;
  const dir = document.getElementById('ins-dir').value;
  const pagoInicial = document.getElementById('ins-pago-inicial').value;

  const mesesEstructura = {};
  const años = ["2026", "2027", "2028"];
  const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  años.forEach(a => {
    mesesNombres.forEach(m => {
      const llave = `${m} ${a}`;
      if (pagoInicial === "Ninguno") {
        mesesEstructura[llave] = "Deuda";
      } else {
        const [mP, aP] = pagoInicial.split(" ");
        const evalV = años.indexOf(a) * 12 + mesesNombres.indexOf(m);
        const pagoV = años.indexOf(aP) * 12 + mesesNombres.indexOf(mP);
        
        // Estructura lineal homogénea para evitar fallas con \$0
        mesesEstructura[llave] = (evalV <= pagoV) ? { estado: "Pagado", fechaPago: new Date().toISOString().split('T')[0], monto: 0 } : "Deuda";
      }
    });
  });

  const nuevo = { dni, nombre, cel, localidad, barrio, direccion: dir, meses: mesesEstructura };
  await fetch(`${FIREBASE_DB}/abonados/${dni}.json`, { method: 'PUT', body: JSON.stringify(nuevo) });
  
  cerrarFichaInscripcion();
  document.getElementById('form-nuevo-cliente').reset();
  listadoClientes();
});

async function bajaAbonado(id) {
  if(confirm("¿Dar de baja definitiva al abonado seleccionado?")) {
    await fetch(`${FIREBASE_DB}/abonados/${id}.json`, { method: 'DELETE' });
    listadoClientes();
  }
}

// --- MÓDULO COBERTURA GEOGRÁFICA (LOCALIDADES Y BARRIOS SANEADO) ---
async function listarLocalidades() {
  try {
    const res = await fetch(`${FIREBASE_DB}/geografia/localidades.json`);
    const data = await res.json();
    const tbody = document.getElementById('body-localidades');
    if(!tbody) return;
    tbody.innerHTML = "";

    if (data) {
      Object.keys(data).forEach(id => {
        const loc = data[id];
        const tr = document.createElement('tr');
        tr.style.cursor = "pointer";
        if(id === localidadSeleccionadaId) tr.style.backgroundColor = "#e0f2fe";

        tr.innerHTML = `
          <td style="font-weight:bold; color:var(--primary); text-transform:capitalize;" onclick="seleccionarLocalidad('${id}', '${loc.nombre}')">🏙️ ${loc.nombre}</td>
          <td style="text-align:center;"><button class="btn" style="background:none;" onclick="event.stopPropagation(); eliminarLocalidad('${id}')">❌</button></td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = `<tr><td colspan="2" style="color:#64748b; text-align:center;">Sin localidades cargadas.</td></tr>`;
    }
  } catch (e) { console.error(e); }
}

async function guardarLocalidad() {
  const input = document.getElementById('input-nombre-localidad');
  const nombre = input.value.trim();
  if(!nombre) return;
  await fetch(`${FIREBASE_DB}/geografia/localidades.json`, { method: 'POST', body: JSON.stringify({ nombre }) });
  input.value = "";
  listarLocalidades();
}

function seleccionarLocalidad(id, nombre) {
  localidadSeleccionadaId = id;
  document.getElementById('titulo-seccion-barrios').innerHTML = `🏡 Barrios de: <span style="color:var(--primary); text-transform:capitalize;">${nombre}</span>`;
  document.getElementById('input-nombre-barrio').disabled = false;
  document.getElementById('btn-guardar-barrio').disabled = false;
  document.getElementById('btn-guardar-barrio').style.opacity = "1";
  listarLocalidades();
  listarBarrios(id);
}

async function listarBarrios(locId) {
  const res = await fetch(`${FIREBASE_DB}/geografia/barrios/${locId}.json`);
  const data = await res.json();
  const tbody = document.getElementById('body-barrios');
  if(!tbody) return;
  tbody.innerHTML = "";
  
  if(data) {
    Object.keys(data).forEach(id => {
      tbody.innerHTML += `<tr><td style="text-transform:capitalize;">🏡 ${data[id].nombre}</td><td style="text-align:center;"><button class="btn" style="background:none;" onclick="eliminarBarrio('${locId}','${id}')">❌</button></td></tr>`;
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="2" style="color:#64748b; text-align:center;">Sin barrios cargados en esta localidad.</td></tr>`;
  }
}

async function guardarBarrio() {
  const input = document.getElementById('input-nombre-barrio');
  const nombre = input.value.trim();
  if(!nombre || !localidadSeleccionadaId) return;
  await fetch(`${FIREBASE_DB}/geografia/barrios/${localidadSeleccionadaId}.json`, { method: 'POST', body: JSON.stringify({ nombre }) });
  input.value = "";
  listarBarrios(localidadSeleccionadaId);
}

async function eliminarLocalidad(id) {
  if(confirm("¿Eliminar localidad de forma permanente?")) {
    await fetch(`${FIREBASE_DB}/geografia/localidades/${id}.json`, { method: 'DELETE' });
    localidadSeleccionadaId = "";
    listarLocalidades();
  }
}

async function eliminarBarrio(locId, bId) {
  if(confirm("¿Quitar este barrio?")) {
    await fetch(`${FIREBASE_DB}/geografia/barrios/${locId}/${bId}.json`, { method: 'DELETE' });
    listarBarrios(locId);
  }
}

// --- MÓDULO ALERTAS: DETECCIÓN DE CORTES ---
/**
 * Analiza de forma automatizada el estado financiero de los abonados
 * e inyecta alertas de suspensión en tiempo real para el periodo activo
 */
/**
 * Analiza la morosidad del periodo seleccionado y la vuelca en la tabla
 */
/**
 * Alimenta dinámicamente el selector de localidades en la pestaña de deudores
 */
async function cargarLocalidadesFiltroCortes() {
  const selectLoc = document.getElementById('filtro-corte-localidad');
  if(!selectLoc) return;
  
  // Guardamos el valor seleccionado actualmente para no perderlo al recargar
  const valorActual = selectLoc.value;

  try {
    const res = await fetch(`${FIREBASE_DB}/geografia/localidades.json`);
    const data = await res.json();
    
    selectLoc.innerHTML = '<option value="TODAS">🌍 Todas las Localidades</option>';
    
    if(data) {
      Object.keys(data).forEach(id => {
        const nombreLoc = data[id].nombre;
        // Inyectamos las opciones formateadas con la primera letra en mayúscula
        selectLoc.innerHTML += `<option value="${nombreLoc.toLowerCase()}">🏙️ ${nombreLoc.toUpperCase()}</option>`;
      });
    }
    
    // Restablecemos el valor si es que sigue existiendo en la nueva lista
    selectLoc.value = valorActual || "TODAS";
  } catch (error) {
    console.error("Error al cargar localidades en cortes:", error);
  }
}

/**
 * Procesa la morosidad combinando filtros de Periodo Cronológico y Cobertura Geográfica
 */
async function procesarAlertasCortes() {
  const tbody = document.getElementById('body-cortes-impago');
  if(!tbody) return;
  tbody.innerHTML = "";
  
  const mesFiltro = document.getElementById('filtro-corte-mes').value;
  const anioFiltro = document.getElementById('filtro-corte-anio').value;
  const localidadFiltro = document.getElementById('filtro-corte-localidad').value;
  
  const periodoCritico = `${mesFiltro} ${anioFiltro}`;

  try {
    const res = await fetch(`${FIREBASE_DB}/abonados.json`);
    const data = await res.json();
    let contadorDeudores = 0;

    if(data) {
      Object.keys(data).forEach(id => {
        const c = data[id];
        
        // Evaluación 1: ¿Debe el mes seleccionado?
        const infoMes = c.meses && c.meses[periodoCritico];
        const estaPagado = infoMes === "Pagado" || (infoMes && infoMes.estado === "Pagado");
        
        // Evaluación 2: ¿Coincide con la localidad seleccionada en el filtro?
        const localidadCliente = c.localidad ? c.localidad.toLowerCase().trim() : "";
        const coincideLocalidad = (localidadFiltro === "TODAS" || localidadCliente === localidadFiltro.trim());

        if(!estaPagado && coincideLocalidad) {
          contadorDeudores++;
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="font-weight:bold; color:#b91c1c;">⚠ ${c.nombre}</td>
            <td style="font-family: monospace;">${c.cel}</td>
            <td style="font-weight: 500; color: #475569;">${periodoCritico} <small style="color:var(--primary); font-weight:bold; text-transform:uppercase;">(${c.localidad})</small></td>
            <td><span class="badge badge-deuda">🔴 Suspensión Programada</span></td>
          `;
          tbody.appendChild(tr);
        }
      });
    }

    if(contadorDeudores === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="color:var(--success); font-weight:bold; text-align:center; padding: 25px;">🎉 Al día. No se registran deudores en esta zona para el periodo ${periodoCritico}.</td></tr>`;
    }
  } catch (error) {
    console.error("Error al filtrar reporte de deudores:", error);
  }
}


/**
 * Genera y descarga un archivo CSV compatible con Excel con los datos de corte en pantalla
 */
function exportarCortesExcel() {
  const mesFiltro = document.getElementById('filtro-corte-mes').value;
  const anioFiltro = document.getElementById('filtro-corte-anio').value;
  const filas = document.querySelectorAll('#body-cortes-impago tr');
  
  // Definimos la cabecera del reporte
  let contenidoCSV = "Abonado en Mora;Contacto;Periodo Evaluado;Estado Operativo\n";
  let tieneDatos = false;

  filas.forEach(fila => {
    const celdas = fila.querySelectorAll('td');
    // Evitamos exportar la celda de aviso "Al día"
    if (celdas.length >= 4 && !celdas[0].textContent.includes("Al día")) {
      tieneDatos = true;
      const nombre = celdas[0].textContent.replace("⚠", "").trim();
      const contacto = celdas[1].textContent.trim();
      const periodo = celdas[2].textContent.trim();
      const estado = celdas[3].textContent.replace("🔴", "").trim();
      
      contenidoCSV += `${nombre};${contacto};${periodo};${estado}\n`;
    }
  });

  if (!tieneDatos) { alert("No hay abonados en mora para exportar en este periodo."); return; }

  // Creamos el archivo de descarga agregando el BOM para compatibilidad con caracteres latinos (acentos, Ñ)
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), contenidoCSV], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `Reporte_Cortes_${mesFiltro}_${anioFiltro}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Abre el gestor de impresión nativo aislando únicamente la tabla de deudores
 */
function imprimirReporteCortes() {
  const mesFiltro = document.getElementById('filtro-corte-mes').value;
  const anioFiltro = document.getElementById('filtro-corte-anio').value;
  const contenidoTabla = document.getElementById('zona-impresion-cortes').innerHTML;
  
  // Abrimos una ventana temporal aislada
  const ventanaImpresion = window.open('', '', 'height=700,width=900');
  
  ventanaImpresion.document.write(`
    <html>
      <head>
        <title>CIC Group - Ordenes de Corte</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
          h2 { color: #b91c1c; border-bottom: 2px solid #333; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f3f4f6; color: #111827; font-weight: bold; font-size: 13px; text-transform: uppercase; }
          td { font-size: 14px; }
          .badge-deuda { color: #991b1b; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>📋 REPORTE OPERATIVO DE SUSPENSIÓN - PERIODO: ${mesFiltro.toUpperCase()} ${anioFiltro}</h2>
        <p>Generado de forma automática por el sistema de fiscalización comercial de CIC Group.</p>
        ${contenidoTabla}
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
    </html>
  `);
  
  ventanaImpresion.document.close();
}



/**
 * Alimenta el select desplegable del formulario de cobros generales con los usuarios de Firebase
 */
// Variable global para mantener una copia del listado de clientes en memoria para el buscador rápido
let listaClientesCacheGlobal = [];

/**
 * Alimenta el select de cobros generales y guarda la copia en memoria
 */
async function cargarClientesDesplegableGlobal() {
  const select = document.getElementById('pago-select-cliente');
  const inputFecha = document.getElementById('pago-fecha-global');
  const inputBuscar = document.getElementById('pago-buscar-texto');
  if (!select) return;

  select.innerHTML = '<option value="">👉 Seleccione un abonado de la lista...</option>';
  if(inputBuscar) inputBuscar.value = ""; // Limpiamos el texto del buscador anterior

  // Configuración de la fecha de hoy
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  if(inputFecha) inputFecha.value = `${año}-${mes}-${dia}`;

  try {
    const res = await fetch(`${FIREBASE_DB}/abonados.json`);
    const data = await res.json();

    if (data) {
      // Guardamos en nuestro caché mapeando el ID, Nombre y DNI
      listaClientesCacheGlobal = Object.keys(data).map(id => ({
        id: id,
        nombre: data[id].nombre,
        dni: data[id].dni
      }));

      // Inyectamos todas las opciones inicialmente
      listaClientesCacheGlobal.forEach(c => {
        select.innerHTML += `<option value="${c.id}">👤 ${c.nombre} (DNI: ${c.dni})</option>`;
      });
    } else {
      select.innerHTML = '<option value="">⚠ No hay clientes registrados en el sistema</option>';
      listaClientesCacheGlobal = [];
    }
  } catch (error) {
    console.error("Error al alimentar desplegable de cobros:", error);
  }
}

/**
 * Filtra dinámicamente las opciones del select a medida que se escribe en el buscador
 */
function filtrarDesplegableClientes() {
  const textoBuscado = document.getElementById('pago-buscar-texto').value.toLowerCase();
  const select = document.getElementById('pago-select-cliente');
  if (!select) return;

  // Limpiamos el select manteniendo la opción base por defecto
  select.innerHTML = '<option value="">👉 Seleccione un abonado de la lista...</option>';

  // Filtramos la lista en caché
  const resultadosFiltrados = listaClientesCacheGlobal.filter(c => 
    c.nombre.toLowerCase().includes(textoBuscado) || c.dni.toString().includes(textoBuscado)
  );

  // Volvemos a inyectar únicamente los que coinciden con la búsqueda
  resultadosFiltrados.forEach(c => {
    select.innerHTML += `<option value="${c.id}">👤 ${c.nombre} (DNI: ${c.dni})</option>`;
  });

  // Si hay exactamente una coincidencia, la seleccionamos automáticamente para ahorrar tiempo
  if (resultadosFiltrados.length === 1) {
    select.value = resultadosFiltrados[0].id;
  }
}


/**
 * Impacta la rendición directa de caja en el nodo del abonado seleccionado
 */
async function ejecutarCobroGlobal(e) {
  e.preventDefault();

  const idCliente = document.getElementById('pago-select-cliente').value;
  const anio = document.getElementById('pago-select-anio').value;
  const mes = document.getElementById('pago-select-mes').value;
  const fecha = document.getElementById('pago-fecha-global').value;
  const monto = document.getElementById('pago-monto-global').value;

  if (!idCliente) { alert("Por favor, seleccione un abonado."); return; }
  if (!fecha) { alert("Por favor, ingrese una fecha de cobro válida."); return; }
  if (!monto || monto < 0) { alert("Por favor, ingrese un importe válido."); return; }

  const llaveMesAnio = `${mes} ${anio}`; // Mapeo exacto, ej: "Octubre 2026"
  
  const objetoTransaccion = {
    estado: "Pagado",
    fechaPago: fecha,
    monto: Number(monto)
  };

  try {
    // Guarda el cobro de caja directamente en el nodo correspondiente de Firebase Realtime
    await fetch(`${FIREBASE_DB}/abonados/${idCliente}/meses/${llaveMesAnio}.json`, {
      method: 'PUT',
      body: JSON.stringify(objetoTransaccion)
    });

    alert(`🎉 ¡Excelente! Cobro del mes ${llaveMesAnio} asentado con éxito.`);
    
    // Limpia y resetea el campo de dinero y refresca el desplegable
    document.getElementById('pago-monto-global').value = "";
    cargarClientesDesplegableGlobal();
  } catch (error) {
    console.error("Error al procesar la recaudación general:", error);
    alert("Ocurrió un error al intentar comunicar con Firebase.");
  }
}

/**
 * Abre el formulario de edición y precarga toda la información actual del abonado
 */
async function abrirFichaEdicion(id) {
  try {
    // 1. Cargamos las localidades dinámicas en el desplegable de edición primero
    const resLoc = await fetch(`${FIREBASE_DB}/geografia/localidades.json`);
    const dataLoc = await resLoc.json();
    const sel = document.getElementById('edit-localidad');
    if(sel) {
      sel.innerHTML = "";
      if(dataLoc) {
        Object.keys(dataLoc).forEach(locId => {
          sel.innerHTML += `<option value="${dataLoc[locId].nombre}">${dataLoc[locId].nombre}</option>`;
        });
      }
    }

    // 2. Traemos la información guardada del cliente seleccionado
    const resUser = await fetch(`${FIREBASE_DB}/abonados/${id}.json`);
    const c = await resUser.json();
    if(!c) return;

    // --- Reemplaza la sección interna correspondiente en tu abrirFichaEdicion(id) ---
    document.getElementById('edit-id-original').value = id;
    document.getElementById('edit-dni').value = c.dni || id;
    document.getElementById('edit-nombre').value = c.nombre;
    document.getElementById('edit-cel').value = c.cel;
    document.getElementById('edit-dir').value = c.direccion || "";
    if(sel) sel.value = c.localidad;

    // Llama de forma inteligente cargando los barrios y pre-seleccionando el que ya tiene el cliente
    await actualizarBarriosDesplegableEdicion(c.barrio);

    document.getElementById('modal-edicion').classList.add('open');

  } catch (error) {
    console.error("Error al abrir ventana de edición:", error);
  }
}

function cerrarFichaEdicion() {
  document.getElementById('modal-edicion').classList.remove('open');
}

/**
 * Procesa el envío del formulario realizando una actualización parcial (PATCH) 
 * para conservar intacto el historial completo de cobros mensuales del usuario.
 */
document.getElementById('form-editar-cliente').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const idOriginal = document.getElementById('edit-id-original').value;
  const nombre = document.getElementById('edit-nombre').value;
  const cel = document.getElementById('edit-cel').value;
  const localidad = document.getElementById('edit-localidad').value;
  const barrio = document.getElementById('edit-barrio').value;
  const direccion = document.getElementById('edit-dir').value;

  // Creamos el objeto únicamente con los datos actualizables
  const datosActualizados = {
    nombre,
    cel,
    localidad,
    barrio,
    direccion
  };

  try {
    // Usamos el método PATCH para sobrescribir solo las propiedades enviadas sin tocar el nodo /meses
    await fetch(`${FIREBASE_DB}/abonados/${idOriginal}.json`, {
      method: 'PATCH',
      body: JSON.stringify(datosActualizados)
    });

    cerrarFichaEdicion();
    listadoClientes(); // Refresca la tabla principal
    
    // Si la ficha expandida del cliente editado estaba abierta abajo, la actualizamos también
    if (abonadoActualId === idOriginal) {
      verDetalleAbonado(idOriginal);
    }
    
    alert("🎉 ¡Datos modificados con éxito!");
  } catch (error) {
    console.error("Error al guardar cambios de edición:", error);
    alert("Ocurrió un error al intentar actualizar Firebase.");
  }
});

/**
 * Busca los barrios asignados en Firebase para la localidad seleccionada en Inscripción
 */
async function actualizarBarriosDesplegableInscripcion(barrioSeleccionadoPorDefecto = "") {
  const locNombre = document.getElementById('ins-localidad').value;
  const selectBarrio = document.getElementById('ins-barrio');
  if (!selectBarrio || !locNombre) return;

  selectBarrio.innerHTML = '<option value="">Cargando barrios...</option>';

  try {
    // 1. Buscamos el ID interno de la localidad en base a su nombre
    const resLoc = await fetch(`${FIREBASE_DB}/geografia/localidades.json`);
    const dataLoc = await resLoc.json();
    let locIdId = "";

    if (dataLoc) {
      Object.keys(dataLoc).forEach(id => {
        if (dataLoc[id].nombre === locNombre) locIdId = id;
      });
    }

    // 2. Si encontramos el ID, traemos sus barrios mapeados
    if (locIdId) {
      const resBarrios = await fetch(`${FIREBASE_DB}/geografia/barrios/${locIdId}.json`);
      const dataBarrios = await resBarrios.json();
      
      selectBarrio.innerHTML = "";

      if (dataBarrios) {
        Object.keys(dataBarrios).forEach(bId => {
          const bNombre = dataBarrios[bId].nombre;
          const selected = bNombre === barrioSeleccionadoPorDefecto ? "selected" : "";
          selectBarrio.innerHTML += `<option value="${bNombre}" ${selected}>🏡 ${bNombre.toUpperCase()}</option>`;
        });
      } else {
        selectBarrio.innerHTML = '<option value="">⚠ Sin barrios cargados en esta zona</option>';
      }
    } else {
      selectBarrio.innerHTML = '<option value="">⚠ Seleccione una localidad válida</option>';
    }
  } catch (error) {
    console.error("Error al actualizar barrios de inscripción:", error);
  }
}

/**
 * Busca los barrios asignados en Firebase para la localidad seleccionada en Edición
 */
async function actualizarBarriosDesplegableEdicion(barrioSeleccionadoPorDefecto = "") {
  const locNombre = document.getElementById('edit-localidad').value;
  const selectBarrio = document.getElementById('edit-barrio');
  if (!selectBarrio || !locNombre) return;

  selectBarrio.innerHTML = '<option value="">Cargando barrios...</option>';

  try {
    const resLoc = await fetch(`${FIREBASE_DB}/geografia/localidades.json`);
    const dataLoc = await resLoc.json();
    let locIdId = "";

    if (dataLoc) {
      Object.keys(dataLoc).forEach(id => {
        if (dataLoc[id].nombre === locNombre) locIdId = id;
      });
    }

    if (locIdId) {
      const resBarrios = await fetch(`${FIREBASE_DB}/geografia/barrios/${locIdId}.json`);
      const dataBarrios = await resBarrios.json();
      
      selectBarrio.innerHTML = "";

      if (dataBarrios) {
        Object.keys(dataBarrios).forEach(bId => {
          const bNombre = dataBarrios[bId].nombre;
          const selected = bNombre === barrioSeleccionadoPorDefecto ? "selected" : "";
          selectBarrio.innerHTML += `<option value="${bNombre}" ${selected}>🏡 ${bNombre.toUpperCase()}</option>`;
        });
      } else {
        selectBarrio.innerHTML = '<option value="">⚠ Sin barrios cargados</option>';
      }
    }
  } catch (error) {
    console.error("Error al actualizar barrios de edición:", error);
  }
}
