// ==========================================
// MÓDULO DE MANTENIMIENTO
// Ciclo de Orden de Mantenimiento (diagrama de estados del TP): Pendiente -> En proceso -> Finalizada | Suspendida (pausa) -> En proceso | Cancelada
// Pantallas: Órdenes de Mantenimiento (historial) / Registrar Orden / Maquinaria (listado) / Registrar Maquinaria / Detalle de Orden
// ==========================================
const SUBVISTAS_MANTENIMIENTO = ['historial', 'registrar', 'maquinaria', 'registrar-maquinaria', 'orden-mantenimiento', 'historial-maquina'];
let itemsMantenimientoActual = [];

let ordenMantDireccionFecha = null; // null | 'asc' | 'desc'
let filtroMantTipoSeleccionado = '';
let filtroMantEstadoSeleccionado = '';

let ordenMaquinariaDireccion = null; // null | 'asc' | 'desc'
let filtroMaqUnidadSeleccionada = '';
let filtroMaqEstadoSeleccionado = '';

function mostrarSubvistaMantenimiento(subvista) {
    SUBVISTAS_MANTENIMIENTO.forEach(v => document.getElementById(`vista-${v}`).classList.add('hidden'));
    const vistaDestino = document.getElementById(`vista-${subvista}`);
    if (vistaDestino) vistaDestino.classList.remove('hidden');
}

// Navegación por hash: sincroniza el submenú del sidebar (#historial / #registrar / #maquinaria / #registrar-maquinaria).
// "Ver orden" no tiene hash propio (se abre desde el historial), igual patrón que Producción.
function irASubvistaDesdeHashMantenimiento() {
    const hash = (window.location.hash || '').replace('#', '') || 'historial';
    if (hash === 'registrar') {
        resetFormularioMantenimiento();
        mostrarSubvistaMantenimiento('registrar');
    } else if (hash === 'maquinaria') {
        renderizarTablaMaquinaria();
        mostrarSubvistaMantenimiento('maquinaria');
    } else if (hash === 'registrar-maquinaria') {
        resetFormularioMaquinaria();
        mostrarSubvistaMantenimiento('registrar-maquinaria');
    } else {
        renderizarHistorialMantenimiento();
        renderizarStatsMantenimiento();
        mostrarSubvistaMantenimiento('historial');
    }
}

function irARegistrarMantenimiento() {
    if (window.location.hash !== '#registrar') window.location.hash = 'registrar'; else irASubvistaDesdeHashMantenimiento();
}

function volverAlHistorialMantenimiento() {
    if (window.location.hash !== '#historial') window.location.hash = 'historial'; else irASubvistaDesdeHashMantenimiento();
}

function irAMaquinaria() {
    if (window.location.hash !== '#maquinaria') window.location.hash = 'maquinaria'; else irASubvistaDesdeHashMantenimiento();
}

function irARegistrarMaquinaria() {
    if (window.location.hash !== '#registrar-maquinaria') window.location.hash = 'registrar-maquinaria'; else irASubvistaDesdeHashMantenimiento();
}

function volverAMaquinaria() {
    irAMaquinaria();
}

function resetFormularioMantenimiento() {
    itemsMantenimientoActual = [];
    poblarSelectMaquinariaDetalle();
    document.getElementById('mant-tipo').value = 'Preventivo';
    document.getElementById('mant-fecha-emision').value = new Date().toISOString().slice(0, 10);
    document.getElementById('mant-observaciones').value = '';
    document.getElementById('mant-det-fecha-inicio').value = '';
    document.getElementById('mant-det-hora-inicio').value = '';
    document.getElementById('mant-det-fecha-fin').value = '';
    document.getElementById('mant-det-hora-fin').value = '';
    document.getElementById('mant-det-tareas').value = '';
    renderizarTablaDetalleMantenimiento();
}

function resetFormularioMaquinaria() {
    document.getElementById('maq-nombre').value = '';
    document.getElementById('maq-marca').value = '';
    document.getElementById('maq-modelo').value = '';
    document.getElementById('maq-descripcion').value = '';
    document.getElementById('maq-fecha-adquisicion').value = '';
    document.getElementById('maq-estado').value = 'Operativa';
}

// ==========================================
// MAQUINARIA
// ==========================================
function poblarSelectMaquinariaDetalle() {
    const selectDetMaq = document.getElementById('mant-det-maquinaria');
    if (!selectDetMaq) return;
    selectDetMaq.innerHTML = '';
    listaMaquinaria.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id_maquinaria; opt.innerText = m.nombre;
        selectDetMaq.appendChild(opt);
    });
}

function renderizarTablaMaquinaria() {
    const tbody = document.getElementById('tabla-maquinaria');
    if (!tbody) return;
    const terminoNombre = normalizarTexto(document.getElementById('buscar-maq-nombre')?.value || '').trim();
    const terminoMarca = normalizarTexto(document.getElementById('buscar-maq-marca')?.value || '').trim();

    let filtradas = listaMaquinaria.filter(m =>
        (!terminoNombre || normalizarTexto(m.nombre).includes(terminoNombre)) &&
        (!terminoMarca || normalizarTexto(m.marca).includes(terminoMarca)) &&
        (!filtroMaqUnidadSeleccionada || m.id_unidad_tiempo === filtroMaqUnidadSeleccionada) &&
        (!filtroMaqEstadoSeleccionado || m.estado === filtroMaqEstadoSeleccionado)
    );

    if (ordenMaquinariaDireccion) {
        filtradas = [...filtradas].sort((a, b) => {
            const cmp = (a.nombre || '').localeCompare(b.nombre || '', 'es');
            return ordenMaquinariaDireccion === 'asc' ? cmp : -cmp;
        });
    }

    actualizarIconoOrdenMaquinaria();
    actualizarIconoFiltroMant('btn-filtro-maq-unidad', 'opcion-filtro-maq-unidad', filtroMaqUnidadSeleccionada);
    actualizarIconoFiltroMant('btn-filtro-maq-estado', 'opcion-filtro-maq-estado', filtroMaqEstadoSeleccionado);

    tbody.innerHTML = '';
    if (!filtradas.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400">No se encontró maquinaria con ese criterio.</td></tr>`;
        return;
    }
    const estadosMaquinaria = ['Operativa', 'En reparación', 'Fuera de servicio'];
    filtradas.forEach(m => {
        const idx = listaMaquinaria.indexOf(m);
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="px-6 py-3 font-semibold text-slate-800">${m.nombre}</td>
            <td class="px-6 py-3 text-slate-600">${m.marca || '-'}</td>
            <td class="px-6 py-3 text-slate-600">${m.modelo || '-'}</td>
            <td class="px-6 py-3 text-slate-500">${m.descripcion || '-'}</td>
            <td class="px-6 py-3 whitespace-nowrap">${m.fecha_adquisicion || '-'}</td>
            <td class="px-6 py-3 whitespace-nowrap">${m.id_unidad_tiempo}</td>
            <td class="px-6 py-3 text-center">
                <select onchange="cambiarEstadoMaquinaria(${idx}, this.value)" title="Cambiar estado" class="text-xs border border-slate-300 rounded-md px-1.5 py-1 outline-none focus:ring-2 focus:ring-red-500">
                    ${estadosMaquinaria.map(e => `<option value="${e}" ${e === m.estado ? 'selected' : ''}>${e}</option>`).join('')}
                </select>
            </td>
            <td class="px-6 py-3">
                <button type="button" onclick="verHistorialMaquina(${idx})" title="Ver historial de mantenimientos" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

// Cambio rápido de estado desde el listado (acción de la columna Acciones).
function cambiarEstadoMaquinaria(idx, nuevoEstado) {
    const maquina = listaMaquinaria[idx];
    if (!maquina) return;
    maquina.estado = nuevoEstado;
    guardarDatos();
    renderizarTablaMaquinaria();
}

// Historial de órdenes de mantenimiento de una máquina puntual (solo lectura).
function verHistorialMaquina(idx) {
    const maquina = listaMaquinaria[idx];
    if (!maquina) return;
    document.getElementById('historial-maquina-titulo').innerText = `Historial de Mantenimientos — ${maquina.nombre}`;
    const ordenes = listaOrdenesMantenimiento.filter(o => o.detalle.some(d => d.id_maquinaria === maquina.id_maquinaria));
    const tbody = document.getElementById('tabla-historial-maquina');
    if (!ordenes.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">Esta máquina todavía no tiene órdenes de mantenimiento registradas.</td></tr>`;
    } else {
        tbody.innerHTML = ordenes.map(o => `
            <tr class="hover:bg-slate-50">
                <td class="px-6 py-3 font-mono font-semibold text-slate-800 whitespace-nowrap">MANT-${String(o.id_orden_mantenimiento).padStart(3, '0')}</td>
                <td class="px-6 py-3"><span class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${o.id_tipo_mantenimiento === 'Preventivo' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}">${o.id_tipo_mantenimiento}</span></td>
                <td class="px-6 py-3 text-slate-500 whitespace-nowrap">${o.fecha_emision}</td>
                <td class="px-6 py-3 text-center"><span class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${COLOR_ESTADO_ORDEN_MANTENIMIENTO[o.estado]}">${o.estado}</span></td>
            </tr>`).join('');
    }
    mostrarSubvistaMantenimiento('historial-maquina');
    lucide.createIcons();
}

function volverDesdeHistorialMaquina() {
    irAMaquinaria();
}

function alternarOrdenMaquinaria() {
    ordenMaquinariaDireccion = ordenMaquinariaDireccion === null ? 'asc' : ordenMaquinariaDireccion === 'asc' ? 'desc' : null;
    renderizarTablaMaquinaria();
}

function actualizarIconoOrdenMaquinaria() {
    const boton = document.getElementById('btn-orden-maq-nombre');
    if (!boton) return;
    const icono = ordenMaquinariaDireccion === 'asc' ? 'arrow-up' : ordenMaquinariaDireccion === 'desc' ? 'arrow-down' : 'arrow-up-down';
    boton.className = `normal-case transition ${ordenMaquinariaDireccion ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    boton.innerHTML = `<i data-lucide="${icono}" class="w-3.5 h-3.5"></i>`;
    lucide.createIcons();
}

function actualizarIconoFiltroMant(idBoton, claseOpciones, valorSeleccionado) {
    const boton = document.getElementById(idBoton);
    if (!boton) return;
    boton.className = `normal-case transition ${valorSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll(`.${claseOpciones}`).forEach(op => {
        const activa = op.dataset.valor === valorSeleccionado;
        op.classList.toggle('bg-red-50', activa);
        op.classList.toggle('text-red-700', activa);
        op.classList.toggle('font-medium', activa);
    });
}

function elegirFiltroMaqUnidad(valor) { filtroMaqUnidadSeleccionada = valor; document.getElementById('pop-maq-unidad').classList.add('hidden'); renderizarTablaMaquinaria(); }
function elegirFiltroMaqEstado(valor) { filtroMaqEstadoSeleccionado = valor; document.getElementById('pop-maq-estado').classList.add('hidden'); renderizarTablaMaquinaria(); }

function guardarMaquinaria() {
    const nombre = document.getElementById('maq-nombre').value.trim();
    const marca = document.getElementById('maq-marca').value.trim();
    const modelo = document.getElementById('maq-modelo').value.trim();
    const descripcion = document.getElementById('maq-descripcion').value.trim();
    const fechaAdquisicion = document.getElementById('maq-fecha-adquisicion').value;
    const estado = document.getElementById('maq-estado').value;
    if (!nombre) return alert('Ingrese el nombre de la máquina.');
    if (!marca) return alert('Ingrese la Marca de la máquina.');
    if (!modelo) return alert('Ingrese el Modelo de la máquina.');
    if (!fechaAdquisicion) return alert('Seleccione la Fecha de adquisición.');

    // La unidad de tiempo ya no se pide en el alta; se registra en Horas por defecto (criterio más usado en mantenimiento industrial).
    listaMaquinaria.push(new Maquinaria(numMaquinariaContador++, nombre, descripcion || 'Sin descripción', fechaAdquisicion, 'Horas', estado, marca, modelo));
    guardarDatos();
    alert(`¡Máquina "${nombre}" registrada con éxito!`);
    irAMaquinaria();
}

// ==========================================
// REGISTRAR ORDEN DE MANTENIMIENTO
// ==========================================
function agregarDetalleMantenimiento() {
    const idMaquinaria = parseInt(document.getElementById('mant-det-maquinaria').value);
    const maquina = listaMaquinaria.find(m => m.id_maquinaria === idMaquinaria);
    const fechaInicio = document.getElementById('mant-det-fecha-inicio').value;
    const horaInicio = document.getElementById('mant-det-hora-inicio').value;
    const fechaFin = document.getElementById('mant-det-fecha-fin').value;
    const horaFin = document.getElementById('mant-det-hora-fin').value;
    const tareas = document.getElementById('mant-det-tareas').value.trim();

    if (!maquina) return alert('Seleccione una maquinaria.');
    if (!fechaInicio || !tareas) return alert('Ingrese al menos la fecha de inicio y las tareas realizadas.');

    itemsMantenimientoActual.push({ id_maquinaria: idMaquinaria, nombre_maquinaria: maquina.nombre, fecha_inicio: fechaInicio, hora_inicio: horaInicio, fecha_fin: fechaFin, hora_fin: horaFin, tareas_realizadas: tareas });
    document.getElementById('mant-det-tareas').value = '';
    renderizarTablaDetalleMantenimiento();
}

function eliminarDetalleMantenimiento(idx) {
    itemsMantenimientoActual.splice(idx, 1);
    renderizarTablaDetalleMantenimiento();
}

function renderizarTablaDetalleMantenimiento() {
    const tbody = document.getElementById('tabla-detalle-mantenimiento');
    tbody.innerHTML = '';
    itemsMantenimientoActual.forEach((d, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 font-medium text-slate-800">${d.nombre_maquinaria}</td>
            <td class="p-3 text-slate-600">${d.fecha_inicio} ${d.hora_inicio || ''}</td>
            <td class="p-3 text-slate-600">${d.fecha_fin || '-'} ${d.hora_fin || ''}</td>
            <td class="p-3 text-slate-600">${d.tareas_realizadas}</td>
            <td class="p-3 text-center"><button type="button" onclick="eliminarDetalleMantenimiento(${idx})" class="text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-4 h-4 inline"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function registrarOrdenMantenimiento() {
    if (!['Administrador', 'Encargado de Producción'].includes(usuarioInternoActual?.rol)) {
        return alert('Solo el Administrador o el Encargado de Producción pueden registrar órdenes de mantenimiento.');
    }
    const tipo = document.getElementById('mant-tipo').value;
    const empleado = document.getElementById('mant-empleado').value;
    const fechaEmision = document.getElementById('mant-fecha-emision').value || new Date().toISOString().slice(0, 10);
    const observaciones = document.getElementById('mant-observaciones').value.trim();

    if (!empleado) return alert('Seleccione el empleado responsable.');
    if (itemsMantenimientoActual.length === 0) return alert('Agregue al menos una máquina al detalle de la orden.');

    const orden = {
        id_orden_mantenimiento: numOrdenMantContador++,
        id_tipo_mantenimiento: tipo,
        id_empleado: empleado,
        fecha_emision: fechaEmision,
        estado: 'Pendiente',
        observaciones,
        detalle: itemsMantenimientoActual
    };
    listaOrdenesMantenimiento.unshift(orden);

    itemsMantenimientoActual = [];
    guardarDatos();
    alert(`¡Orden de mantenimiento MANT-${String(orden.id_orden_mantenimiento).padStart(3, '0')} registrada con éxito!`);
    volverAlHistorialMantenimiento();
}

// ==========================================
// HISTORIAL DE ÓRDENES DE MANTENIMIENTO (tabla con búsqueda/filtro/orden, igual patrón que Pedidos)
// ==========================================
function renderizarHistorialMantenimiento() {
    const tbody = document.getElementById('tabla-ordenes-mantenimiento');
    if (!tbody) return;
    const terminoCodigo = normalizarTexto(document.getElementById('buscar-mant-codigo')?.value || '').trim();

    let ordenes = listaOrdenesMantenimiento.filter(o => {
        if (filtroMantTipoSeleccionado && o.id_tipo_mantenimiento !== filtroMantTipoSeleccionado) return false;
        if (filtroMantEstadoSeleccionado && o.estado !== filtroMantEstadoSeleccionado) return false;
        if (!terminoCodigo) return true;
        const haystack = normalizarTexto([`MANT-${String(o.id_orden_mantenimiento).padStart(3, '0')}`, ...o.detalle.map(d => d.nombre_maquinaria)].join(' '));
        return haystack.includes(terminoCodigo);
    });

    if (ordenMantDireccionFecha) {
        ordenes = [...ordenes].sort((a, b) => {
            const cmp = (a.fecha_emision || '').localeCompare(b.fecha_emision || '');
            return ordenMantDireccionFecha === 'asc' ? cmp : -cmp;
        });
    }

    actualizarIconoOrdenMant();
    actualizarIconoFiltroMant('btn-filtro-mant-tipo', 'opcion-filtro-mant-tipo', filtroMantTipoSeleccionado);
    actualizarIconoFiltroMant('btn-filtro-mant-estado', 'opcion-filtro-mant-estado', filtroMantEstadoSeleccionado);

    tbody.innerHTML = '';
    if (!ordenes.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">No se encontraron órdenes de mantenimiento con esos filtros.</td></tr>`;
        return;
    }
    ordenes.forEach(o => {
        const maquinas = o.detalle.map(d => d.nombre_maquinaria).join(', ');
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="px-6 py-3 font-semibold text-slate-800 font-mono whitespace-nowrap">MANT-${String(o.id_orden_mantenimiento).padStart(3, '0')}</td>
            <td class="px-6 py-3"><span class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${o.id_tipo_mantenimiento === 'Preventivo' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}">${o.id_tipo_mantenimiento}</span></td>
            <td class="px-6 py-3 text-slate-600 whitespace-nowrap">${o.id_empleado}</td>
            <td class="px-6 py-3 text-slate-600">${maquinas}</td>
            <td class="px-6 py-3 text-slate-500 whitespace-nowrap">${o.fecha_emision}</td>
            <td class="px-6 py-3 text-center"><span class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${COLOR_ESTADO_ORDEN_MANTENIMIENTO[o.estado]}">${o.estado}</span></td>
            <td class="px-6 py-3 text-center"><button type="button" onclick="verOrdenMantenimiento(${o.id_orden_mantenimiento})" title="Ver detalle" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function alternarOrdenMantenimiento() {
    ordenMantDireccionFecha = ordenMantDireccionFecha === null ? 'asc' : ordenMantDireccionFecha === 'asc' ? 'desc' : null;
    renderizarHistorialMantenimiento();
}

function actualizarIconoOrdenMant() {
    const boton = document.getElementById('btn-orden-mant-fecha');
    if (!boton) return;
    const icono = ordenMantDireccionFecha === 'asc' ? 'arrow-up' : ordenMantDireccionFecha === 'desc' ? 'arrow-down' : 'arrow-up-down';
    boton.className = `normal-case transition ${ordenMantDireccionFecha ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    boton.innerHTML = `<i data-lucide="${icono}" class="w-3.5 h-3.5"></i>`;
    lucide.createIcons();
}

function elegirFiltroMantTipo(valor) { filtroMantTipoSeleccionado = valor; document.getElementById('pop-mant-tipo').classList.add('hidden'); renderizarHistorialMantenimiento(); }
function elegirFiltroMantEstado(valor) { filtroMantEstadoSeleccionado = valor; document.getElementById('pop-mant-estado').classList.add('hidden'); renderizarHistorialMantenimiento(); }

function renderizarStatsMantenimiento() {
    const totalOrdenes = listaOrdenesMantenimiento.length;
    const pendientes = listaOrdenesMantenimiento.filter(o => o.estado === 'Pendiente').length;
    const enProceso = listaOrdenesMantenimiento.filter(o => o.estado === 'En proceso').length;
    const finalizadas = listaOrdenesMantenimiento.filter(o => o.estado === 'Finalizada').length;
    const suspendidas = listaOrdenesMantenimiento.filter(o => o.estado === 'Suspendida').length;
    const maqReparacion = listaMaquinaria.filter(m => m.estado === 'En reparación').length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('kpi-mant-total-ordenes', totalOrdenes);
    set('kpi-mant-pendientes', pendientes);
    set('kpi-mant-en-proceso', enProceso);
    set('kpi-mant-finalizadas', finalizadas);
    set('kpi-mant-suspendidas', suspendidas);
    set('kpi-mant-maq-reparacion', maqReparacion);
}

// ==========================================
// VISTA DETALLE / IMPRESIÓN + FLUJO DE ESTADOS
// Mismo estilo visual (tipografía/espaciado) que la Orden de Pedido de Ventas, pero sin datos fiscales:
// es un documento interno, no un comprobante.
// ==========================================
function mostrarVistaMantenimiento(vista) {
    mostrarSubvistaMantenimiento(vista === 'orden' ? 'orden-mantenimiento' : 'historial');
}

function construirHTMLOrdenMantenimiento(o) {
    const filas = o.detalle.map(d => `
        <tr class="border-b border-slate-100">
            <td class="py-2 font-medium text-slate-800">${d.nombre_maquinaria}</td>
            <td class="py-2 text-slate-500">${d.fecha_inicio} ${d.hora_inicio || ''} → ${d.fecha_fin || '-'} ${d.hora_fin || ''}</td>
            <td class="py-2">${d.tareas_realizadas}</td>
        </tr>`).join('');

    return `
        <div class="flex justify-between items-start border-b border-slate-200 pb-4">
            <div>
                <h1 class="text-2xl font-bold text-red-600">FÁBRICA DE PASTAS</h1>
                <p class="text-xs text-slate-500">Orden de Mantenimiento</p>
                <div class="flex items-center gap-2 mt-2">
                    <p class="text-sm font-bold text-slate-800">MANT-${String(o.id_orden_mantenimiento).padStart(3, '0')}</p>
                    <span class="px-2.5 py-1 ${o.id_tipo_mantenimiento === 'Preventivo' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'} text-xs font-semibold rounded-full whitespace-nowrap">${o.id_tipo_mantenimiento}</span>
                    <span class="px-2.5 py-1 ${COLOR_ESTADO_ORDEN_MANTENIMIENTO[o.estado]} text-xs font-semibold rounded-full whitespace-nowrap">${o.estado}</span>
                </div>
            </div>
            <div class="text-right text-xs text-slate-500 space-y-0.5">
                <p><b class="text-slate-700">Fecha de Emisión:</b> ${o.fecha_emision}</p>
                <p><b class="text-slate-700">Responsable:</b> ${o.id_empleado}</p>
            </div>
        </div>
        ${o.observaciones ? `
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <b>Observaciones:</b> ${o.observaciones}
        </div>` : ''}
        <div>
            <h3 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Máquinas Intervenidas</h3>
            <table class="w-full text-xs text-left">
                <thead class="border-b border-slate-300 uppercase text-slate-500">
                    <tr><th class="py-2">Maquinaria</th><th class="py-2">Período</th><th class="py-2">Tareas Realizadas</th></tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
}

// Botones de transición de estado, según el diagrama de estados de Orden_Mantenimiento del TP.
function construirAccionesOrdenMantenimiento(o) {
    const base = 'px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5';
    if (o.estado === 'Pendiente') {
        return `<div class="flex justify-end gap-2">
            <button type="button" onclick="cancelarOrdenMantenimiento(${o.id_orden_mantenimiento})" class="${base} bg-slate-100 hover:bg-slate-200 text-slate-700"><i data-lucide="x-circle" class="w-4 h-4"></i>Cancelar</button>
            <button type="button" onclick="iniciarOrdenMantenimiento(${o.id_orden_mantenimiento})" class="${base} bg-blue-600 hover:bg-blue-700 text-white"><i data-lucide="play" class="w-4 h-4"></i>Iniciar Mantenimiento</button>
        </div>`;
    }
    if (o.estado === 'En proceso') {
        return `<div class="flex justify-end gap-2">
            <button type="button" onclick="cancelarOrdenMantenimiento(${o.id_orden_mantenimiento})" class="${base} bg-slate-100 hover:bg-slate-200 text-slate-700"><i data-lucide="x-circle" class="w-4 h-4"></i>Cancelar</button>
            <button type="button" onclick="suspenderOrdenMantenimiento(${o.id_orden_mantenimiento})" class="${base} bg-orange-500 hover:bg-orange-600 text-white"><i data-lucide="pause-circle" class="w-4 h-4"></i>Suspender</button>
            <button type="button" onclick="finalizarOrdenMantenimiento(${o.id_orden_mantenimiento})" class="${base} bg-emerald-600 hover:bg-emerald-700 text-white"><i data-lucide="check-check" class="w-4 h-4"></i>Finalizar</button>
        </div>`;
    }
    if (o.estado === 'Suspendida') {
        return `<div class="flex justify-end gap-2">
            <button type="button" onclick="cancelarOrdenMantenimiento(${o.id_orden_mantenimiento})" class="${base} bg-slate-100 hover:bg-slate-200 text-slate-700"><i data-lucide="x-circle" class="w-4 h-4"></i>Cancelar</button>
            <button type="button" onclick="reanudarOrdenMantenimiento(${o.id_orden_mantenimiento})" class="${base} bg-blue-600 hover:bg-blue-700 text-white"><i data-lucide="play" class="w-4 h-4"></i>Reanudar</button>
        </div>`;
    }
    return '';
}

function verOrdenMantenimiento(id) {
    const o = listaOrdenesMantenimiento.find(x => x.id_orden_mantenimiento === id);
    if (!o) return;
    document.getElementById('area-orden-mantenimiento').innerHTML = construirHTMLOrdenMantenimiento(o);
    document.getElementById('area-acciones-orden-mantenimiento').innerHTML = construirAccionesOrdenMantenimiento(o);
    mostrarVistaMantenimiento('orden');
    lucide.createIcons();
}

function volverDesdeOrdenMantenimiento() {
    volverAlHistorialMantenimiento();
}

function iniciarOrdenMantenimiento(id) {
    const o = listaOrdenesMantenimiento.find(x => x.id_orden_mantenimiento === id);
    if (!o || o.estado !== 'Pendiente') return;
    o.estado = 'En proceso';
    guardarDatos();
    verOrdenMantenimiento(id);
}

function suspenderOrdenMantenimiento(id) {
    const o = listaOrdenesMantenimiento.find(x => x.id_orden_mantenimiento === id);
    if (!o || o.estado !== 'En proceso') return;
    o.estado = 'Suspendida';
    guardarDatos();
    verOrdenMantenimiento(id);
}

function reanudarOrdenMantenimiento(id) {
    const o = listaOrdenesMantenimiento.find(x => x.id_orden_mantenimiento === id);
    if (!o || o.estado !== 'Suspendida') return;
    o.estado = 'En proceso';
    guardarDatos();
    verOrdenMantenimiento(id);
}

function finalizarOrdenMantenimiento(id) {
    const o = listaOrdenesMantenimiento.find(x => x.id_orden_mantenimiento === id);
    if (!o || o.estado !== 'En proceso') return;
    o.estado = 'Finalizada';
    guardarDatos();
    verOrdenMantenimiento(id);
}

function cancelarOrdenMantenimiento(id) {
    const o = listaOrdenesMantenimiento.find(x => x.id_orden_mantenimiento === id);
    if (!o || o.estado === 'Finalizada' || o.estado === 'Cancelada') return;
    if (!confirm(`¿Cancelar la orden MANT-${String(id).padStart(3, '0')}? Esta acción no se puede deshacer.`)) return;
    o.estado = 'Cancelada';
    guardarDatos();
    verOrdenMantenimiento(id);
}

function initPaginaMantenimiento() {
    renderizarEmpleadosUI();
    poblarSelectMaquinariaDetalle();
    irASubvistaDesdeHashMantenimiento();
    window.addEventListener('hashchange', irASubvistaDesdeHashMantenimiento);
}
