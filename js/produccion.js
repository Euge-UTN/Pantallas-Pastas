// ==========================================
// MÓDULO DE PRODUCCIÓN: Orden_Producción (multi-producto) + sus 3 detalles
// Ciclo: Planificada (valida stock, no descuenta) -> En Proceso (descuenta stock real) -> Finalizada (confirma lote/vencimiento/cantidad real) | Cancelada
// Pantallas: Historial (listado + KPIs) / Registrar Orden / Detalle de Orden (consulta + seguimiento + cierre, según "Consultar orden de producción" del TP)
// ==========================================
const SUBVISTAS_PRODUCCION = ['historial', 'nueva-orden', 'detalle-orden'];
let itemsProductosProduccionActual = [];
let itemsMaquinariaProduccionActual = [];
let ultimoRequerimientoMP = [];
let idPedidoOrigenSeleccionado = null; // null = Producción interna
let ordenDetalleActualId = null;

function mostrarSubvistaProduccion(subvista) {
    SUBVISTAS_PRODUCCION.forEach(v => document.getElementById(`vista-${v}`).classList.add('hidden'));
    const vistaDestino = document.getElementById(`vista-${subvista}`);
    if (vistaDestino) vistaDestino.classList.remove('hidden');
}

// Navegación por hash: sincroniza el sub-menú del sidebar (#historial / #nueva-orden) con la subvista mostrada.
// "Detalle de Orden" no tiene hash propio (igual que el detalle de una orden en Mantenimiento/Compras): se abre desde el listado.
function irASubvistaDesdeHashProduccion() {
    const hash = (window.location.hash || '').replace('#', '') || 'historial';
    if (hash === 'nueva-orden') {
        resetFormularioNuevaOrden();
        mostrarSubvistaProduccion('nueva-orden');
    } else {
        renderizarStockUI();
        renderizarHistorialProduccion();
        renderizarStatsProduccion();
        mostrarSubvistaProduccion('historial');
    }
}

function irANuevaOrdenProduccion() {
    if (window.location.hash !== '#nueva-orden') window.location.hash = 'nueva-orden'; else irASubvistaDesdeHashProduccion();
}

function volverAlHistorialProduccion() {
    if (window.location.hash !== '#historial') window.location.hash = 'historial'; else irASubvistaDesdeHashProduccion();
}

// ==========================================
// STOCK DE MATERIA PRIMA
// ==========================================
function renderizarStockUI() {
    const grid = document.getElementById('grid-stock-materia-prima');
    if (!grid) return;
    grid.innerHTML = '';
    Object.values(stockMateriaPrima).forEach(mp => {
        const bajo = mp.cantidad_actual <= 20;
        const div = document.createElement('div');
        div.className = 'bg-white border border-slate-200 rounded-xl p-4';
        div.innerHTML = `
            <p class="text-xs text-slate-400">${mp.nombre}</p>
            <p class="text-xl font-bold ${bajo ? 'text-red-600' : 'text-slate-900'}">${mp.cantidad_actual} <span class="text-xs font-normal text-slate-400">${mp.unidad_medida}</span></p>
            ${bajo ? '<span class="text-[10px] font-semibold text-red-500">Stock bajo</span>' : ''}
        `;
        grid.appendChild(div);
    });
}

// ==========================================
// COMBOS DE CABECERA
// ==========================================
function inicializarCombosProduccion() {
    const selectEmpleado = document.getElementById('prod-empleado');
    const selectMaquinaria = document.getElementById('prod-det-maquinaria');
    if (!selectEmpleado) return;

    selectEmpleado.innerHTML = '<option value="" disabled selected class="text-slate-400">Seleccione un empleado</option>';
    listaEmpleados.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.nombreCompleto; opt.innerText = `${e.nombreCompleto} (${e.cargo})`;
        selectEmpleado.appendChild(opt);
    });
    // Autocompleta con el usuario logueado si existe como Empleado en el catálogo; si no, queda en el placeholder para elegir manualmente.
    if (usuarioInternoActual && listaEmpleados.some(e => e.nombreCompleto === usuarioInternoActual.nombre)) {
        selectEmpleado.value = usuarioInternoActual.nombre;
    }

    selectMaquinaria.innerHTML = '';
    listaMaquinaria.forEach(m => {
        const opt = document.createElement('option');
        const noDisponible = m.estado !== 'Operativa';
        opt.value = m.id_maquinaria;
        opt.disabled = noDisponible;
        opt.innerText = noDisponible ? `${m.nombre} (${m.estado} — no disponible)` : m.nombre;
        selectMaquinaria.appendChild(opt);
    });
}

// ==========================================
// ORIGEN DE LA ORDEN (buscador de pedidos "Pendiente" + Producción interna)
// ==========================================
function pedidosOrigenDisponibles() {
    return listaPedidos.filter(p => p.estado === 'Pendiente');
}

function filtrarPedidosOrigen() {
    const input = document.getElementById('prod-pedido-autocompletar');
    const cont = document.getElementById('prod-pedido-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    const opciones = [{ esStock: true }, ...pedidosOrigenDisponibles().map(p => ({ esStock: false, pedido: p }))]
        .filter(o => o.esStock ? !termino : normalizarTexto(`PED-${o.pedido.id} ${o.pedido.cliente}`).includes(termino));

    if (!opciones.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin pedidos pendientes que coincidan con la búsqueda.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = opciones.map(o => o.esStock
        ? `<button type="button" onmousedown="event.preventDefault(); elegirPedidoOrigen(null)" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100 border-b border-slate-100">
               <span class="block font-medium">Producción interna</span>
               <span class="block text-[11px] text-slate-400">Producción no asociada a un pedido</span>
           </button>`
        : `<button type="button" onmousedown="event.preventDefault(); elegirPedidoOrigen(${o.pedido.id})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
               <span class="block truncate">PED-${o.pedido.id} — ${o.pedido.cliente}</span>
               <span class="block text-[11px] text-slate-400">${o.pedido.detalle.map(d => d.nombre).join(', ')}</span>
           </button>`
    ).join('');
    cont.classList.remove('hidden');
}

function elegirPedidoOrigen(idPedido) {
    idPedidoOrigenSeleccionado = idPedido;
    document.getElementById('prod-pedido-asociado').value = idPedido || '';
    document.getElementById('prod-pedido-autocompletar').value = idPedido
        ? `PED-${idPedido} — ${listaPedidos.find(p => p.id === idPedido).cliente}`
        : 'Producción interna';
    document.getElementById('prod-pedido-autocompletar-opciones').classList.add('hidden');
    document.getElementById('btn-precargar-pedido').classList.toggle('hidden', !idPedido);
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#prod-pedido-autocompletar') && !e.target.closest('#prod-pedido-autocompletar-opciones')) {
        document.getElementById('prod-pedido-autocompletar-opciones')?.classList.add('hidden');
    }
});

// Mapea cada ítem del pedido a su receta por nombre de producto (relación 1 a 1 receta<->producto).
function precargarProductosDesdePedido() {
    const idPedido = parseInt(document.getElementById('prod-pedido-asociado').value);
    const pedido = listaPedidos.find(p => p.id === idPedido);
    if (!pedido) return;

    const sinReceta = [];
    pedido.detalle.forEach(item => {
        const receta = listaRecetas.find(r => r.nombre_producto === item.nombre);
        if (!receta) { sinReceta.push(item.nombre); return; }
        const existente = itemsProductosProduccionActual.find(p => p.id_receta === receta.id_receta);
        if (existente) {
            existente.cantidad_planificada += item.cantidad;
        } else {
            itemsProductosProduccionActual.push({ id: Date.now() + Math.random(), id_receta: receta.id_receta, nombre_producto: receta.nombre_producto, nombre_receta: receta.nombre_receta, cantidad_planificada: item.cantidad });
        }
    });
    renderizarTablaProductosProduccion();
    recalcularRequerimientoMP();
    if (sinReceta.length) alert(`Se precargaron los productos con receta definida. Los siguientes no tienen receta asociada y deben agregarse manualmente: ${sinReceta.join(', ')}.`);
}

// ==========================================
// SECCIÓN 1: PRODUCTOS A FABRICAR (buscador + tabla multi-producto)
// ==========================================
function filtrarProductosProduccion() {
    const input = document.getElementById('prod-item-autocompletar');
    const cont = document.getElementById('prod-item-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    document.getElementById('prod-item-select').value = '';
    document.getElementById('prod-item-receta-detectada').textContent = '';

    if (!termino) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }

    const filtrados = listaRecetas.filter(r => normalizarTexto(r.nombre_producto).includes(termino));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados. No hay receta para ese producto.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(r => `
        <button type="button" onmousedown="event.preventDefault(); elegirProductoProduccion(${r.id_receta})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${r.nombre_producto}</span>
            <span class="block text-[11px] text-slate-400">${r.nombre_receta}</span>
        </button>`).join('');
    cont.classList.remove('hidden');
}

function elegirProductoProduccion(idReceta) {
    const receta = listaRecetas.find(r => r.id_receta === idReceta);
    if (!receta) return;
    document.getElementById('prod-item-autocompletar').value = receta.nombre_producto;
    document.getElementById('prod-item-select').value = receta.id_receta;
    document.getElementById('prod-item-autocompletar-opciones').classList.add('hidden');
    document.getElementById('prod-item-receta-detectada').textContent = `Receta: ${receta.nombre_receta}`;
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#prod-item-autocompletar') && !e.target.closest('#prod-item-autocompletar-opciones')) {
        document.getElementById('prod-item-autocompletar-opciones')?.classList.add('hidden');
    }
});

function agregarProductoProduccion() {
    const idReceta = parseInt(document.getElementById('prod-item-select').value);
    const cantidad = parseFloat(document.getElementById('prod-item-cant').value);
    const receta = listaRecetas.find(r => r.id_receta === idReceta);

    if (!receta) return alert('Elegí un producto de la lista de sugerencias.');
    if (!cantidad || cantidad <= 0) return alert('Ingrese una cantidad a fabricar válida.');

    const existente = itemsProductosProduccionActual.find(p => p.id_receta === idReceta);
    if (existente) {
        existente.cantidad_planificada += cantidad;
    } else {
        itemsProductosProduccionActual.push({ id: Date.now() + Math.random(), id_receta: receta.id_receta, nombre_producto: receta.nombre_producto, nombre_receta: receta.nombre_receta, cantidad_planificada: cantidad });
    }

    document.getElementById('prod-item-autocompletar').value = '';
    document.getElementById('prod-item-select').value = '';
    document.getElementById('prod-item-receta-detectada').textContent = '';
    document.getElementById('prod-item-cant').value = 20;
    renderizarTablaProductosProduccion();
    recalcularRequerimientoMP();
}

function actualizarCantidadProductoProduccion(id, valor) {
    const item = itemsProductosProduccionActual.find(p => p.id === id);
    if (!item) return;
    const cantidad = parseFloat(valor);
    if (!cantidad || cantidad <= 0) { renderizarTablaProductosProduccion(); return; }
    item.cantidad_planificada = cantidad;
    recalcularRequerimientoMP();
}

function eliminarProductoProduccion(id) {
    itemsProductosProduccionActual = itemsProductosProduccionActual.filter(p => p.id !== id);
    renderizarTablaProductosProduccion();
    recalcularRequerimientoMP();
}

function renderizarTablaProductosProduccion() {
    const tbody = document.getElementById('tabla-productos-produccion');
    tbody.innerHTML = '';
    if (itemsProductosProduccionActual.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400 text-xs">Todavía no agregó productos a fabricar.</td></tr>`;
        return;
    }
    itemsProductosProduccionActual.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 font-medium text-slate-800">${item.nombre_producto}</td>
            <td class="p-3 text-slate-500">${item.nombre_receta}</td>
            <td class="p-3 text-center"><input type="number" min="1" value="${item.cantidad_planificada}" onchange="actualizarCantidadProductoProduccion(${item.id}, this.value)" class="w-20 text-center border border-slate-300 rounded-md p-1 text-sm outline-none focus:ring-2 focus:ring-red-500"></td>
            <td class="p-3 text-slate-400">Se asigna al registrar</td>
            <td class="p-3 text-center"><button type="button" onclick="eliminarProductoProduccion(${item.id})" class="text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-4 h-4 inline"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

// ==========================================
// SECCIÓN 2: REQUERIMIENTO DE MATERIA PRIMA (consolidado, read-only)
// ==========================================
function calcularRequerimientoConsolidado(items) {
    const mapa = {};
    items.forEach(item => {
        const receta = listaRecetas.find(r => r.id_receta === item.id_receta);
        if (!receta) return;
        receta.detalle.forEach(d => {
            const cantidad = d.cantidad_por_kg * item.cantidad_planificada;
            if (!mapa[d.clave_mp]) mapa[d.clave_mp] = 0;
            mapa[d.clave_mp] += cantidad;
        });
    });
    return Object.entries(mapa).map(([clave_mp, cantidad_planificada]) => ({
        clave_mp, nombre: stockMateriaPrima[clave_mp].nombre, cantidad_planificada: +cantidad_planificada.toFixed(2)
    }));
}

function recalcularRequerimientoMP() {
    ultimoRequerimientoMP = calcularRequerimientoConsolidado(itemsProductosProduccionActual);
    const tbody = document.getElementById('tabla-detalle-materia-prima');
    const btnNota = document.getElementById('btn-generar-nota-mp');
    tbody.innerHTML = '';

    if (ultimoRequerimientoMP.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 text-xs">Agregue un producto a fabricar para calcular la materia prima necesaria.</td></tr>`;
        btnNota.classList.add('hidden');
        return;
    }

    let hayFaltante = false;
    ultimoRequerimientoMP.forEach(d => {
        const disponible = stockMateriaPrima[d.clave_mp].cantidad_actual;
        const unidad = stockMateriaPrima[d.clave_mp].unidad_medida;
        const faltante = d.cantidad_planificada > disponible;
        if (faltante) hayFaltante = true;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 font-medium text-slate-800">${d.nombre}</td>
            <td class="p-3 text-center ${faltante ? 'text-red-600 font-bold' : ''} whitespace-nowrap">${d.cantidad_planificada} ${unidad}</td>
            <td class="p-3 text-center text-slate-500 whitespace-nowrap">${disponible} ${unidad}</td>
            <td class="p-3 text-center"><span class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${faltante ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}">${faltante ? 'Faltante' : 'Suficiente'}</span></td>
        `;
        tbody.appendChild(tr);
    });
    btnNota.classList.toggle('hidden', !hayFaltante);
}

// Deja en sessionStorage los faltantes para que Compras los precargue en un Presupuesto a Proveedor.
function generarNotaPedidoMP() {
    const faltantes = ultimoRequerimientoMP
        .map(d => ({ clave: d.clave_mp, cantidad: +(d.cantidad_planificada - stockMateriaPrima[d.clave_mp].cantidad_actual).toFixed(2) }))
        .filter(f => f.cantidad > 0);
    if (!faltantes.length) return;
    sessionStorage.setItem('notaPedidoMPPendiente', JSON.stringify(faltantes));
    alert('Se generó la Nota de Pedido de Materia Prima. Te llevamos a Compras para elegir el proveedor y confirmarla.');
    window.location.href = 'compras.html#registrar-presupuesto';
}

// ==========================================
// SECCIÓN 3: MAQUINARIA UTILIZADA
// ==========================================
function agregarMaquinariaProduccion() {
    const idMaquinaria = parseInt(document.getElementById('prod-det-maquinaria').value);
    const maquina = listaMaquinaria.find(m => m.id_maquinaria === idMaquinaria);
    const horaInicio = document.getElementById('prod-det-hora-inicio-plan').value;
    const horaFin = document.getElementById('prod-det-hora-fin-plan').value;
    if (!maquina) return alert('Seleccione una maquinaria.');
    if (maquina.estado !== 'Operativa') return alert(`Esa maquinaria no está disponible (${maquina.estado}).`);
    if (!horaInicio || !horaFin) return alert('Ingrese la hora de inicio y fin planificadas.');

    itemsMaquinariaProduccionActual.push({ id_maquinaria: idMaquinaria, nombre_maquinaria: maquina.nombre, hora_inicio_planificada: horaInicio, hora_fin_planificada: horaFin });
    renderizarTablaMaquinariaProduccion();
}

function eliminarMaquinariaProduccion(idx) {
    itemsMaquinariaProduccionActual.splice(idx, 1);
    renderizarTablaMaquinariaProduccion();
}

function renderizarTablaMaquinariaProduccion() {
    const tbody = document.getElementById('tabla-detalle-maquinaria-produccion');
    tbody.innerHTML = '';
    itemsMaquinariaProduccionActual.forEach((m, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 font-medium text-slate-800">${m.nombre_maquinaria}</td>
            <td class="p-3 text-slate-600">${m.hora_inicio_planificada}</td>
            <td class="p-3 text-slate-600">${m.hora_fin_planificada}</td>
            <td class="p-3 text-center"><button type="button" onclick="eliminarMaquinariaProduccion(${idx})" class="text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-4 h-4 inline"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

// ==========================================
// REGISTRAR ORDEN DE PRODUCCIÓN
// Fecha/hora de emisión no se piden en el formulario: el sistema las captura solas al confirmar (igual que
// fecha_emisión/hora_emisión en comprobantes, remitos y órdenes de compra en todo el resto del sistema).
// ==========================================
function registrarOrdenProduccion() {
    const idPedido = document.getElementById('prod-pedido-asociado').value;
    const empleado = document.getElementById('prod-empleado').value;
    const estadoInicial = document.getElementById('prod-estado').value;

    if (itemsProductosProduccionActual.length === 0) return alert('Agregue al menos un producto a fabricar.');
    if (!empleado) return alert('Seleccione el empleado responsable.');
    if (itemsMaquinariaProduccionActual.length === 0) return alert('Agregue al menos una maquinaria al detalle de la orden.');

    const detalleMateriaPrima = calcularRequerimientoConsolidado(itemsProductosProduccionActual);

    if (estadoInicial === 'En Proceso') {
        const faltante = detalleMateriaPrima.find(d => d.cantidad_planificada > stockMateriaPrima[d.clave_mp].cantidad_actual);
        if (faltante) return alert(`Stock insuficiente de ${faltante.nombre} para iniciar ahora. Generá la Nota de Pedido de MP o registrá la orden como "Planificada".`);
        detalleMateriaPrima.forEach(d => { stockMateriaPrima[d.clave_mp].cantidad_actual -= d.cantidad_planificada; });
    }

    const detalleProductos = itemsProductosProduccionActual.map(it => ({
        id_receta: it.id_receta, nombre_producto: it.nombre_producto, nombre_receta: it.nombre_receta,
        cantidad_planificada: it.cantidad_planificada, cantidad_real: null,
        numero_lote_proyectado: `LOT-${numLoteContador++}`, numero_lote_definitivo: null, fecha_vencimiento: null
    }));

    const ahora = new Date();
    const orden = {
        id_orden_produccion: numOrdenProduccionContador++,
        id_orden_pedido_cliente: idPedido ? parseInt(idPedido) : null,
        id_empleado: empleado,
        fecha_emision: ahora.toISOString().slice(0, 10),
        hora_emision: ahora.toTimeString().slice(0, 5),
        fecha_inicio: document.getElementById('prod-fecha-inicio').value,
        hora_inicio: document.getElementById('prod-hora-inicio').value,
        fecha_fin: document.getElementById('prod-fecha-fin').value,
        hora_fin: document.getElementById('prod-hora-fin').value,
        estado: estadoInicial,
        observaciones: document.getElementById('prod-observaciones').value.trim(),
        stockDescontado: estadoInicial === 'En Proceso',
        detalleProductos,
        detalleMateriaPrima,
        detalleMaquinaria: itemsMaquinariaProduccionActual
    };
    listaOrdenesProduccion.unshift(orden);

    if (idPedido) {
        const pedido = listaPedidos.find(p => p.id === parseInt(idPedido));
        if (pedido) { pedido.estado = 'En preparación'; pedido.idOrdenProduccionGenerada = orden.id_orden_produccion; }
    }

    guardarDatos();
    const lotes = detalleProductos.map(d => d.numero_lote_proyectado).join(', ');
    alert(`¡Orden de producción OP-${orden.id_orden_produccion} registrada! Lote(s) proyectado(s): ${lotes}.`);
    volverAlHistorialProduccion();
}

function resetFormularioNuevaOrden() {
    itemsProductosProduccionActual = [];
    itemsMaquinariaProduccionActual = [];
    idPedidoOrigenSeleccionado = null;
    inicializarCombosProduccion();
    document.getElementById('prod-pedido-autocompletar').value = '';
    document.getElementById('prod-pedido-asociado').value = '';
    document.getElementById('prod-fecha-inicio').value = '';
    document.getElementById('prod-hora-inicio').value = '';
    document.getElementById('prod-fecha-fin').value = '';
    document.getElementById('prod-hora-fin').value = '';
    document.getElementById('prod-estado').value = 'Planificada';
    document.getElementById('prod-observaciones').value = '';
    document.getElementById('prod-item-autocompletar').value = '';
    document.getElementById('prod-item-select').value = '';
    document.getElementById('prod-item-receta-detectada').textContent = '';
    document.getElementById('prod-item-cant').value = 20;
    document.getElementById('btn-precargar-pedido').classList.add('hidden');
    renderizarTablaProductosProduccion();
    recalcularRequerimientoMP();
    renderizarTablaMaquinariaProduccion();
    recibirHandoffDesdePedido();
}

// Si desde "Pedidos" se tocó "Generar orden de producción", precarga ese pedido como Origen y sus productos.
function recibirHandoffDesdePedido() {
    const crudo = sessionStorage.getItem('opDesdePedidoPendiente');
    if (!crudo) return;
    sessionStorage.removeItem('opDesdePedidoPendiente');
    try {
        const { idPedido } = JSON.parse(crudo);
        if (!idPedido || !pedidosOrigenDisponibles().some(p => p.id === idPedido)) return;
        elegirPedidoOrigen(idPedido);
        precargarProductosDesdePedido();
    } catch (e) { /* handoff corrupto o vacío: se ignora */ }
}

// ==========================================
// PANTALLA A: HISTORIAL / LISTADO
// ==========================================
function renderizarHistorialProduccion() {
    const tbody = document.getElementById('tabla-ordenes-produccion');
    if (!tbody) return;
    const filtroEstado = document.getElementById('historial-filtro-estado').value;
    const termino = normalizarTexto(document.getElementById('historial-buscador').value).trim();

    const ordenes = listaOrdenesProduccion.filter(o => {
        if (filtroEstado && o.estado !== filtroEstado) return false;
        if (!termino) return true;
        const haystack = normalizarTexto([
            `OP-${o.id_orden_produccion}`,
            o.id_orden_pedido_cliente ? `PED-${o.id_orden_pedido_cliente}` : '',
            ...o.detalleProductos.map(d => d.nombre_producto)
        ].join(' '));
        return haystack.includes(termino);
    });

    tbody.innerHTML = '';
    if (ordenes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-sm text-slate-400">No se encontraron órdenes de producción con esos filtros.</td></tr>`;
        return;
    }
    ordenes.forEach(o => {
        const prodTexto = o.detalleProductos.length > 1
            ? `${o.detalleProductos[0].nombre_producto} +${o.detalleProductos.length - 1} más`
            : o.detalleProductos[0].nombre_producto;
        const cancelable = o.estado === 'Planificada' || o.estado === 'En Proceso';
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="px-6 py-3 font-semibold text-slate-800 whitespace-nowrap">OP-${o.id_orden_produccion}</td>
            <td class="px-6 py-3 text-slate-600 whitespace-nowrap">${o.id_orden_pedido_cliente ? 'PED-' + o.id_orden_pedido_cliente : 'Producción interna'}</td>
            <td class="px-6 py-3 text-slate-600 whitespace-nowrap">${o.id_empleado}</td>
            <td class="px-6 py-3 text-slate-600">${prodTexto}</td>
            <td class="px-6 py-3 text-slate-500 whitespace-nowrap">${o.fecha_emision || '-'}</td>
            <td class="px-6 py-3 text-center"><span class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${COLOR_ESTADO_ORDEN_PRODUCCION[o.estado]}">${o.estado}</span></td>
            <td class="px-6 py-3 text-center whitespace-nowrap">
                <button type="button" onclick="verDetalleOrdenProduccion(${o.id_orden_produccion})" title="Ver detalle" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                ${cancelable ? `<button type="button" onclick="cancelarOrdenProduccion(${o.id_orden_produccion})" title="Cancelar orden" class="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"><i data-lucide="x-circle" class="w-4 h-4"></i></button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function cancelarOrdenProduccion(id) {
    const orden = listaOrdenesProduccion.find(o => o.id_orden_produccion === id);
    if (!orden) return;
    if (!confirm(`¿Cancelar la orden OP-${id}? Esta acción no se puede deshacer.`)) return;

    if (orden.stockDescontado) {
        orden.detalleMateriaPrima.forEach(d => { stockMateriaPrima[d.clave_mp].cantidad_actual += d.cantidad_planificada; });
    }
    if (orden.id_orden_pedido_cliente) {
        const pedido = listaPedidos.find(p => p.id === orden.id_orden_pedido_cliente);
        if (pedido && pedido.estado === 'En preparación') pedido.estado = 'Pendiente';
    }
    orden.estado = 'Cancelada';
    orden.stockDescontado = false;
    guardarDatos();
    renderizarStockUI();
    renderizarHistorialProduccion();
    renderizarStatsProduccion();
}

function renderizarStatsProduccion() {
    const total = listaOrdenesProduccion.length;
    const planificadas = listaOrdenesProduccion.filter(o => o.estado === 'Planificada').length;
    const enProceso = listaOrdenesProduccion.filter(o => o.estado === 'En Proceso').length;
    const finalizadas = listaOrdenesProduccion.filter(o => o.estado === 'Finalizada').length;
    const canceladas = listaOrdenesProduccion.filter(o => o.estado === 'Cancelada').length;
    const stockBajo = Object.values(stockMateriaPrima).filter(mp => mp.cantidad_actual <= 20).length;

    const elTotal = document.getElementById('kpi-prod-total');
    if (!elTotal) return;
    elTotal.textContent = total;
    document.getElementById('kpi-prod-planificadas').textContent = planificadas;
    document.getElementById('kpi-prod-en-proceso').textContent = enProceso;
    document.getElementById('kpi-prod-finalizadas').textContent = finalizadas;
    document.getElementById('kpi-prod-canceladas').textContent = canceladas;
    document.getElementById('kpi-prod-stock-bajo').textContent = stockBajo;
}

// ==========================================
// PANTALLA C: DETALLE DE ORDEN (consulta + seguimiento + cierre, según "Consultar orden de producción")
// ==========================================
function verDetalleOrdenProduccion(id) {
    ordenDetalleActualId = id;
    renderizarDetalleOrdenProduccion();
    mostrarSubvistaProduccion('detalle-orden');
}

function volverDesdeDetalleOrden() {
    ordenDetalleActualId = null;
    volverAlHistorialProduccion();
}

function renderizarDetalleOrdenProduccion() {
    const cont = document.getElementById('detalle-orden-contenido');
    const o = listaOrdenesProduccion.find(x => x.id_orden_produccion === ordenDetalleActualId);
    if (!cont || !o) return;

    const totalPlanificado = o.detalleProductos.reduce((s, d) => s + d.cantidad_planificada, 0);
    const totalReal = o.detalleProductos.reduce((s, d) => s + (d.cantidad_real || 0), 0);
    const avance = o.estado === 'En Proceso' ? Math.min(100, Math.round((totalReal / totalPlanificado) * 100)) : (o.estado === 'Finalizada' ? 100 : 0);
    const enProceso = o.estado === 'En Proceso';

    const filasProductos = o.detalleProductos.map((d, idx) => `
        <tr>
            <td class="p-3 font-medium text-slate-800">${d.nombre_producto}</td>
            <td class="p-3 text-slate-500">${d.nombre_receta}</td>
            <td class="p-3 text-center whitespace-nowrap">${d.cantidad_planificada} kg</td>
            <td class="p-3 text-center">${enProceso
                ? `<input type="number" min="0" step="0.1" id="seg-real-${o.id_orden_produccion}-${idx}" placeholder="${d.cantidad_planificada}" class="w-20 text-center border border-slate-300 rounded-md p-1 text-sm outline-none">`
                : `<span class="${d.cantidad_real == null ? 'text-slate-400' : 'text-slate-700'}">${d.cantidad_real ?? '-'}</span>`}</td>
            <td class="p-3 text-center">${enProceso
                ? `<input type="text" id="seg-lote-${o.id_orden_produccion}-${idx}" value="${d.numero_lote_proyectado}" class="w-28 text-center border border-slate-300 rounded-md p-1 text-sm outline-none">`
                : `<span class="text-slate-600">${d.numero_lote_definitivo || d.numero_lote_proyectado}${d.numero_lote_definitivo ? '' : ' (proy.)'}</span>`}</td>
            <td class="p-3 text-center">${enProceso
                ? `<input type="date" id="seg-venc-${o.id_orden_produccion}-${idx}" class="w-36 text-center border border-slate-300 rounded-md p-1 text-sm outline-none">`
                : `<span class="${d.fecha_vencimiento ? 'text-slate-600' : 'text-slate-400'}">${d.fecha_vencimiento || '-'}</span>`}</td>
        </tr>`).join('');

    const filasMP = o.detalleMateriaPrima.map(d => `
        <tr>
            <td class="p-3 font-medium text-slate-800">${d.nombre}</td>
            <td class="p-3 text-center whitespace-nowrap">${d.cantidad_planificada} ${stockMateriaPrima[d.clave_mp].unidad_medida}</td>
        </tr>`).join('');

    const filasMaquinaria = o.detalleMaquinaria.map(m => `
        <tr>
            <td class="p-3 font-medium text-slate-800">${m.nombre_maquinaria}</td>
            <td class="p-3 text-slate-600">${m.hora_inicio_planificada}</td>
            <td class="p-3 text-slate-600">${m.hora_fin_planificada}</td>
        </tr>`).join('');

    let bloqueAccion = '';
    if (o.estado === 'Planificada') {
        bloqueAccion = `<p class="text-xs text-slate-500">Orden planificada. Al iniciarla se descuenta el stock de materia prima.</p>
            <div class="flex justify-end"><button type="button" onclick="iniciarOrdenProduccion(${o.id_orden_produccion})" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"><i data-lucide="play" class="w-4 h-4"></i>Iniciar Producción</button></div>`;
    } else if (o.estado === 'En Proceso') {
        bloqueAccion = `
            <div>
                <div class="flex items-center justify-between text-xs text-slate-500 mb-1"><span>Avance (cantidad real vs. planificada)</span><span class="font-semibold text-slate-700">${avance}%</span></div>
                <div class="h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-blue-500" style="width:${avance}%"></div></div>
            </div>
            <div class="flex justify-end"><button type="button" onclick="finalizarOrdenProduccion(${o.id_orden_produccion})" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"><i data-lucide="check-check" class="w-4 h-4"></i>Finalizar Orden</button></div>`;
    } else if (o.estado === 'Finalizada') {
        bloqueAccion = `<p class="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">Orden finalizada. Cantidad real, lote definitivo y vencimiento confirmados por producto.</p>`;
    } else {
        bloqueAccion = `<p class="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Orden cancelada.</p>`;
    }

    cont.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="font-semibold text-slate-800 text-lg">OP-${o.id_orden_produccion}</p>
                <span class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${COLOR_ESTADO_ORDEN_PRODUCCION[o.estado]}">${o.estado}</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-500">
                <div><p class="font-semibold text-slate-700">Pedido asociado</p>${o.id_orden_pedido_cliente ? 'PED-' + o.id_orden_pedido_cliente : 'Producción interna'}</div>
                <div><p class="font-semibold text-slate-700">Responsable</p>${o.id_empleado}</div>
                <div><p class="font-semibold text-slate-700">Emisión</p>${o.fecha_emision} ${o.hora_emision}</div>
                <div><p class="font-semibold text-slate-700">Inicio programado</p>${o.fecha_inicio || '-'} ${o.hora_inicio || ''}</div>
                <div><p class="font-semibold text-slate-700">Fin programado</p>${o.fecha_fin || '-'} ${o.hora_fin || ''}</div>
            </div>
            ${o.observaciones ? `<p class="text-xs italic text-slate-400">${o.observaciones}</p>` : ''}

            <div>
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Productos</h4>
                <table class="w-full text-sm text-left bg-white rounded-lg overflow-hidden border border-slate-200">
                    <thead class="bg-slate-100 text-xs text-slate-600 uppercase border-b border-slate-200">
                        <tr><th class="p-3">Producto</th><th class="p-3">Receta</th><th class="p-3 text-center">Cant. Planificada</th><th class="p-3 text-center">Cant. Real</th><th class="p-3 text-center">Lote</th><th class="p-3 text-center">Vencimiento</th></tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">${filasProductos}</tbody>
                </table>
            </div>

            <div>
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Materia prima consumida (consolidada)</h4>
                <table class="w-full text-sm text-left bg-white rounded-lg overflow-hidden border border-slate-200">
                    <thead class="bg-slate-100 text-xs text-slate-600 uppercase border-b border-slate-200">
                        <tr><th class="p-3">Materia Prima</th><th class="p-3 text-center">Cantidad Planificada</th></tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">${filasMP}</tbody>
                </table>
            </div>

            <div>
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Maquinaria utilizada</h4>
                <table class="w-full text-sm text-left bg-white rounded-lg overflow-hidden border border-slate-200">
                    <thead class="bg-slate-100 text-xs text-slate-600 uppercase border-b border-slate-200">
                        <tr><th class="p-3">Maquinaria</th><th class="p-3">Hora inicio plan.</th><th class="p-3">Hora fin plan.</th></tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">${filasMaquinaria}</tbody>
                </table>
            </div>

            ${bloqueAccion}
        </div>
    `;
    lucide.createIcons();
}

function iniciarOrdenProduccion(id) {
    const orden = listaOrdenesProduccion.find(o => o.id_orden_produccion === id);
    if (!orden || orden.estado !== 'Planificada') return;

    const faltante = orden.detalleMateriaPrima.find(d => d.cantidad_planificada > stockMateriaPrima[d.clave_mp].cantidad_actual);
    if (faltante) return alert(`Stock insuficiente de ${faltante.nombre} para iniciar esta orden. Generá una Nota de Pedido de MP desde Compras antes de continuar.`);

    orden.detalleMateriaPrima.forEach(d => { stockMateriaPrima[d.clave_mp].cantidad_actual -= d.cantidad_planificada; });
    orden.estado = 'En Proceso';
    orden.stockDescontado = true;
    guardarDatos();
    renderizarStockUI();
    renderizarDetalleOrdenProduccion();
}

function finalizarOrdenProduccion(id) {
    const orden = listaOrdenesProduccion.find(o => o.id_orden_produccion === id);
    if (!orden || orden.estado !== 'En Proceso') return;

    orden.detalleProductos.forEach((d, idx) => {
        const real = parseFloat(document.getElementById(`seg-real-${id}-${idx}`)?.value);
        const lote = document.getElementById(`seg-lote-${id}-${idx}`)?.value.trim();
        const venc = document.getElementById(`seg-venc-${id}-${idx}`)?.value;
        d.cantidad_real = (real && real > 0) ? real : d.cantidad_planificada;
        d.numero_lote_definitivo = lote || d.numero_lote_proyectado;
        d.fecha_vencimiento = venc || null;
    });
    orden.estado = 'Finalizada';

    if (orden.id_orden_pedido_cliente) {
        const pedido = listaPedidos.find(p => p.id === orden.id_orden_pedido_cliente);
        if (pedido) pedido.estado = 'Listo';
    }
    guardarDatos();
    renderizarDetalleOrdenProduccion();
    alert(`¡Orden OP-${id} finalizada! Lote(s) definitivo(s) confirmado(s).`);
}

// ==========================================
function initPaginaProduccion() {
    inicializarCombosProduccion();
    irASubvistaDesdeHashProduccion();
    window.addEventListener('hashchange', irASubvistaDesdeHashProduccion);
}
