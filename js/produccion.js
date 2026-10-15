// ==========================================
// MÓDULO DE PRODUCCIÓN: Orden_Producción (multi-producto) + sus 3 detalles
// Ciclo: En Proceso (arranca así, descuenta stock planificado al registrarla) -> Finalizada (Cierre de Orden:
// confirma cantidad/lote/vencimiento real por producto, ajusta stock por la MP real utilizada y registra
// horas reales de maquinaria) | Cancelada (revierte el stock descontado, disponible en cualquier momento)
// Pantallas: Historial (listado + KPIs) / Registrar Orden / Detalle de Orden (consulta + seguimiento + cierre)
// ==========================================
const SUBVISTAS_PRODUCCION = ['historial', 'nueva-orden', 'detalle-orden'];
let itemsProductosProduccionActual = [];
let itemsMaquinariaProduccionActual = [];
let ultimoRequerimientoMP = [];
let idPedidoOrigenSeleccionado = null; // null = Producción interna
let ordenDetalleActualId = null;
let ordenEnCierreId = null; // id de la OP que se está cerrando

// Función auxiliar para formatear fechas a DD/MM/AAAA
function formatearFechaLatina(fechaStr) {
    if (!fechaStr) return '-';
    // Si viene en formato ISO (YYYY-MM-DD)
    const partes = fechaStr.split('-');
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return fechaStr;
}

function mostrarSubvistaProduccion(subvista) {
    SUBVISTAS_PRODUCCION.forEach(v => {
        const el = document.getElementById(`vista-${v}`);
        if (el) el.classList.add('hidden');
    });
    const vistaDestino = document.getElementById(`vista-${subvista}`);
    if (vistaDestino) vistaDestino.classList.remove('hidden');
}

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
    if (window.location.hash !== '#nueva-orden') window.location.hash = 'nueva-orden'; 
    else irASubvistaDesdeHashProduccion();
}

function volverAlHistorialProduccion() {
    if (window.location.hash !== '#historial') window.location.hash = 'historial'; 
    else irASubvistaDesdeHashProduccion();
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
            <p class="text-xl font-bold ${bajo ? 'text-red-600' : 'text-slate-900'}">${formatearCantidad(mp.cantidad_actual)} <span class="text-xs font-normal text-slate-400">${mp.unidad_medida}</span></p>
            ${bajo ? '<span class="text-[10px] font-semibold text-red-500">Stock bajo</span>' : ''}
        `;
        grid.appendChild(div);
    });
}

// ==========================================
// EMPLEADO RESPONSABLE (Automático desde usuario activo)
// ==========================================
function inicializarEmpleadoLogueado() {
    const inputEmpleado = document.getElementById('prod-empleado');
    if (!inputEmpleado) return;
    
    let nombreEmpleado = 'Carlos Gómez (Maestro Pastero)';
    if (typeof usuarioInternoActual !== 'undefined' && usuarioInternoActual && usuarioInternoActual.nombre) {
        nombreEmpleado = usuarioInternoActual.nombre;
    } else if (typeof currentUser !== 'undefined' && currentUser && currentUser.nombre) {
        nombreEmpleado = currentUser.nombre;
    }
    inputEmpleado.value = nombreEmpleado;
}

// ==========================================
// ORIGEN DE LA ORDEN (buscador de pedidos "Pendiente" + Producción interna)
// ==========================================
function pedidosOrigenDisponibles() {
    return (typeof listaPedidos !== 'undefined' && listaPedidos) ? listaPedidos.filter(p => p.estado === 'Pendiente') : [];
}

function filtrarPedidosOrigen() {
    const input = document.getElementById('prod-pedido-autocompletar');
    const cont = document.getElementById('prod-pedido-autocompletar-opciones');
    if (!input || !cont) return;

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
               <span class="block text-[11px] text-slate-400">${(o.pedido.detalle || []).map(d => d.nombre).join(', ')}</span>
           </button>`
    ).join('');
    cont.classList.remove('hidden');
}

function elegirPedidoOrigen(idPedido) {
    idPedidoOrigenSeleccionado = idPedido;
    const inputOculto = document.getElementById('prod-pedido-asociado');
    const inputMostrar = document.getElementById('prod-pedido-autocompletar');
    const btnPrecargar = document.getElementById('btn-precargar-pedido');

    if (inputOculto) inputOculto.value = idPedido || '';
    if (inputMostrar) {
        const ped = typeof listaPedidos !== 'undefined' ? listaPedidos.find(p => p.id === idPedido) : null;
        inputMostrar.value = (idPedido && ped) ? `PED-${idPedido} — ${ped.cliente}` : 'Producción interna';
    }
    document.getElementById('prod-pedido-autocompletar-opciones')?.classList.add('hidden');
    if (btnPrecargar) btnPrecargar.classList.toggle('hidden', !idPedido);
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#prod-pedido-autocompletar') && !e.target.closest('#prod-pedido-autocompletar-opciones')) {
        document.getElementById('prod-pedido-autocompletar-opciones')?.classList.add('hidden');
    }
});

function precargarProductosDesdePedido() {
    if (typeof listaPedidos === 'undefined' || typeof listaRecetas === 'undefined') return;
    const idPedido = parseInt(document.getElementById('prod-pedido-asociado').value);
    const pedido = listaPedidos.find(p => p.id === idPedido);
    if (!pedido || !pedido.detalle) return;

    const sinReceta = [];
    pedido.detalle.forEach(item => {
        const receta = listaRecetas.find(r => normalizarTexto(r.nombre_producto) === normalizarTexto(item.nombre));
        if (!receta) { sinReceta.push(item.nombre); return; }

        const existente = itemsProductosProduccionActual.find(p => p.id_receta === receta.id_receta);
        if (existente) {
            existente.cantidad_planificada += item.cantidad;
        } else {
            itemsProductosProduccionActual.push({
                id: Date.now() + Math.random(),
                id_receta: receta.id_receta,
                nombre_producto: receta.nombre_producto,
                nombre_receta: receta.nombre_receta,
                cantidad_planificada: item.cantidad
            });
        }
    });

    sincronizarMaquinariaSugerida();
    renderizarTablaProductosProduccion();
    recalcularRequerimientoMP();
    if (sinReceta.length) alert(`Se precargaron los productos con receta definida. Los siguientes no tienen receta asociada: ${sinReceta.join(', ')}.`);
}

// ==========================================
// SECCIÓN 1: PRODUCTOS A FABRICAR
// ==========================================
function filtrarProductosProduccion() {
    const input = document.getElementById('prod-item-autocompletar');
    const cont = document.getElementById('prod-item-autocompletar-opciones');
    if (!input || !cont || typeof listaRecetas === 'undefined') return;

    const termino = normalizarTexto(input.value).trim();
    document.getElementById('prod-item-select').value = '';

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
        </button>`).join('');
    cont.classList.remove('hidden');
}

function elegirProductoProduccion(idReceta) {
    if (typeof listaRecetas === 'undefined') return;
    const receta = listaRecetas.find(r => r.id_receta === idReceta);
    if (!receta) return;
    document.getElementById('prod-item-autocompletar').value = receta.nombre_producto;
    document.getElementById('prod-item-select').value = receta.id_receta;
    document.getElementById('prod-item-autocompletar-opciones').classList.add('hidden');
}

function agregarProductoProduccion() {
    if (typeof listaRecetas === 'undefined') return;
    const idReceta = parseInt(document.getElementById('prod-item-select').value);
    const cantidad = parseFloat(document.getElementById('prod-item-cant').value);
    const receta = listaRecetas.find(r => r.id_receta === idReceta);

    if (!receta) return alert('Elegí un producto de la lista de sugerencias.');
    if (!cantidad || cantidad <= 0) return alert('Ingrese una cantidad a fabricar válida.');

    const existente = itemsProductosProduccionActual.find(p => p.id_receta === idReceta);
    if (existente) {
        existente.cantidad_planificada += cantidad;
    } else {
        itemsProductosProduccionActual.push({
            id: Date.now() + Math.random(),
            id_receta: receta.id_receta,
            nombre_producto: receta.nombre_producto,
            nombre_receta: receta.nombre_receta,
            cantidad_planificada: cantidad
        });
    }

    document.getElementById('prod-item-autocompletar').value = '';
    document.getElementById('prod-item-select').value = '';
    document.getElementById('prod-item-cant').value = 20;

    sincronizarMaquinariaSugerida();
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
    sincronizarMaquinariaSugerida();
    renderizarTablaProductosProduccion();
    recalcularRequerimientoMP();
}

function renderizarTablaProductosProduccion() {
    const tbody = document.getElementById('tabla-productos-produccion');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (itemsProductosProduccionActual.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 text-xs">Todavía no agregó productos a fabricar.</td></tr>`;
        return;
    }
    itemsProductosProduccionActual.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 font-medium text-slate-800">${item.nombre_producto}</td>
            <td class="p-3 text-center"><input type="number" min="1" value="${item.cantidad_planificada}" onchange="actualizarCantidadProductoProduccion(${item.id}, this.value)" class="w-20 text-center border border-slate-300 rounded-md p-1 text-sm outline-none focus:ring-2 focus:ring-red-500"></td>
            <td class="p-3 text-slate-400 text-center">Se asigna al registrar</td>
            <td class="p-3 text-center"><button type="button" onclick="eliminarProductoProduccion(${item.id})" class="text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-4 h-4 inline"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// SECCIÓN 2: REQUERIMIENTO DE MATERIA PRIMA
// ==========================================
function calcularRequerimientoConsolidado(items) {
    const mapa = {};
    if (typeof listaRecetas === 'undefined') return [];

    items.forEach(item => {
        const receta = listaRecetas.find(r => r.id_receta === item.id_receta);
        if (!receta || !receta.detalle) return;

        receta.detalle.forEach(d => {
            const prop = d.cantidad_por_kg || d.cantidad || 0;
            const cantidad = prop * item.cantidad_planificada;
            if (!mapa[d.clave_mp]) mapa[d.clave_mp] = 0;
            mapa[d.clave_mp] += cantidad;
        });
    });

    return Object.entries(mapa).map(([clave_mp, cantidad_planificada]) => {
        const mpObj = stockMateriaPrima[clave_mp] || { nombre: clave_mp, unidad_medida: 'kg', cantidad_actual: 0 };
        return {
            clave_mp,
            nombre: mpObj.nombre,
            cantidad_planificada: +cantidad_planificada.toFixed(2)
        };
    });
}

function recalcularRequerimientoMP() {
    ultimoRequerimientoMP = calcularRequerimientoConsolidado(itemsProductosProduccionActual);
    const tbody = document.getElementById('tabla-detalle-materia-prima');
    const btnNota = document.getElementById('btn-generar-nota-mp');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (ultimoRequerimientoMP.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400 text-xs">Agregue un producto a fabricar para calcular la materia prima necesaria.</td></tr>`;
        if (btnNota) btnNota.classList.add('hidden');
        return;
    }

    let hayFaltante = false;
    ultimoRequerimientoMP.forEach(d => {
        const mpInfo = stockMateriaPrima[d.clave_mp] || { cantidad_actual: 0, unidad_medida: 'kg' };
        const disponible = mpInfo.cantidad_actual;
        const unidad = mpInfo.unidad_medida;
        const faltante = d.cantidad_planificada > disponible;
        if (faltante) hayFaltante = true;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 font-medium text-slate-800">${d.nombre}</td>
            <td class="p-3 text-center ${faltante ? 'text-red-600 font-bold' : ''} whitespace-nowrap">${formatearCantidad(d.cantidad_planificada)}</td>
            <td class="p-3 text-center text-slate-500 whitespace-nowrap">${formatearCantidad(disponible)}</td>
            <td class="p-3 text-center text-slate-500 whitespace-nowrap">${unidad}</td>
            <td class="p-3 text-center"><span class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${faltante ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}">${faltante ? 'Faltante' : 'Suficiente'}</span></td>
        `;
        tbody.appendChild(tr);
    });
    if (btnNota) btnNota.classList.toggle('hidden', !hayFaltante);
}

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
function sincronizarMaquinariaSugerida() {
    itemsMaquinariaProduccionActual = [];
    if (typeof listaMaquinaria === 'undefined' || !listaMaquinaria) return;

    if (itemsProductosProduccionActual.length > 0) {
        listaMaquinaria.forEach(m => {
            itemsMaquinariaProduccionActual.push({
                id_maquinaria: m.id_maquinaria,
                nombre_maquinaria: m.nombre,
                estado: m.estado,
                hora_inicio_planificada: document.getElementById('prod-hora-inicio')?.value || '08:00',
                hora_fin_planificada: document.getElementById('prod-hora-fin')?.value || '17:00'
            });
        });
    }
    renderizarTablaMaquinariaProduccion();
}

function renderizarTablaMaquinariaProduccion() {
    const tbody = document.getElementById('tabla-detalle-maquinaria-produccion');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (itemsMaquinariaProduccionActual.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 text-xs">Agregue un producto para relacionar la maquinaria requerida.</td></tr>`;
        return;
    }

    const hInicio = document.getElementById('prod-hora-inicio')?.value || '08:00';
    const hFin = document.getElementById('prod-hora-fin')?.value || '17:00';

    itemsMaquinariaProduccionActual.forEach((m) => {
        const noDisponible = m.estado && m.estado !== 'Operativa';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 font-medium text-slate-800">${m.nombre_maquinaria}</td>
            <td class="p-3 text-slate-600">${hInicio} hs</td>
            <td class="p-3 text-slate-600">${hFin} hs</td>
            <td class="p-3 text-center">
                <span class="text-xs px-2 py-0.5 rounded-full ${noDisponible ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}">
                    ${noDisponible ? `No disponible (${m.estado})` : 'Operativa'}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// REGISTRAR ORDEN DE PRODUCCIÓN
// ==========================================
function registrarOrdenProduccion() {
    const idPedido = document.getElementById('prod-pedido-asociado')?.value;
    const empleado = document.getElementById('prod-empleado')?.value;

    const fechaInicio = document.getElementById('prod-fecha-inicio')?.value;
    const horaInicio = document.getElementById('prod-hora-inicio')?.value;
    const fechaFin = document.getElementById('prod-fecha-fin')?.value;
    const horaFin = document.getElementById('prod-hora-fin')?.value;
    const observaciones = document.getElementById('prod-observaciones')?.value.trim() || '';

    if (itemsProductosProduccionActual.length === 0) return alert('Agregue al menos un producto a fabricar.');
    if (!fechaInicio || !horaInicio || !fechaFin || !horaFin) return alert('Complete la fecha y hora de inicio y fin programadas.');

    const maquinaInhabilitada = itemsMaquinariaProduccionActual.find(m => m.estado && m.estado !== 'Operativa');
    if (maquinaInhabilitada) return alert(`La maquinaria "${maquinaInhabilitada.nombre_maquinaria}" no está disponible (${maquinaInhabilitada.estado}).`);

    const detalleMateriaPrima = calcularRequerimientoConsolidado(itemsProductosProduccionActual);

    const faltante = detalleMateriaPrima.find(d => d.cantidad_planificada > (stockMateriaPrima[d.clave_mp]?.cantidad_actual || 0));
    if (faltante) return alert(`Stock insuficiente de ${faltante.nombre} para iniciar esta orden. Generá una Nota de Pedido de MP desde Compras antes de continuar.`);
    
    detalleMateriaPrima.forEach(d => {
        if (stockMateriaPrima[d.clave_mp]) stockMateriaPrima[d.clave_mp].cantidad_actual -= d.cantidad_planificada;
    });

    const detalleProductos = itemsProductosProduccionActual.map(it => ({
        id_receta: it.id_receta,
        nombre_producto: it.nombre_producto,
        nombre_receta: it.nombre_receta,
        cantidad_planificada: it.cantidad_planificada,
        cantidad_real: null,
        numero_lote_proyectado: `LOT-${numLoteContador++}`,
        numero_lote_definitivo: null,
        fecha_vencimiento: null
    }));

    const ahora = new Date();
    const orden = {
        id_orden_produccion: numOrdenProduccionContador++,
        id_orden_pedido_cliente: idPedido ? parseInt(idPedido) : null,
        id_empleado: empleado,
        fecha_emision: ahora.toISOString().slice(0, 10),
        hora_emision: ahora.toTimeString().slice(0, 5),
        fecha_inicio: fechaInicio,
        hora_inicio: horaInicio,
        fecha_fin: fechaFin,
        hora_fin: horaFin,
        fecha_vencimiento: null,
        estado: 'En Proceso',
        observaciones: observaciones,
        stockDescontado: true,
        detalleProductos,
        detalleMateriaPrima,
        detalleMaquinaria: itemsMaquinariaProduccionActual
    };

    listaOrdenesProduccion.unshift(orden);

    if (idPedido && typeof listaPedidos !== 'undefined') {
        const pedido = listaPedidos.find(p => p.id === parseInt(idPedido));
        if (pedido) { pedido.estado = 'En preparación'; pedido.idOrdenProduccionGenerada = orden.id_orden_produccion; }
    }

    const lotes = detalleProductos.map(d => d.numero_lote_proyectado).join(', ');
    alert(`¡Orden de producción OP-${orden.id_orden_produccion} registrada! Lote(s) proyectado(s): ${lotes}.`);
    volverAlHistorialProduccion();
}

function resetFormularioNuevaOrden() {
    itemsProductosProduccionActual = [];
    itemsMaquinariaProduccionActual = [];
    idPedidoOrigenSeleccionado = null;
    
    inicializarEmpleadoLogueado();

    if (document.getElementById('prod-pedido-autocompletar')) document.getElementById('prod-pedido-autocompletar').value = '';
    if (document.getElementById('prod-pedido-asociado')) document.getElementById('prod-pedido-asociado').value = '';
    if (document.getElementById('prod-observaciones')) document.getElementById('prod-observaciones').value = '';
    if (document.getElementById('prod-item-autocompletar')) document.getElementById('prod-item-autocompletar').value = '';
    if (document.getElementById('prod-item-select')) document.getElementById('prod-item-select').value = '';
    if (document.getElementById('prod-item-cant')) document.getElementById('prod-item-cant').value = 20;

    const hoyStr = new Date().toISOString().slice(0, 10);
    if (document.getElementById('prod-fecha-inicio')) document.getElementById('prod-fecha-inicio').value = hoyStr;
    if (document.getElementById('prod-hora-inicio')) document.getElementById('prod-hora-inicio').value = '08:00';
    if (document.getElementById('prod-fecha-fin')) document.getElementById('prod-fecha-fin').value = hoyStr;
    if (document.getElementById('prod-hora-fin')) document.getElementById('prod-hora-fin').value = '17:00';

    document.getElementById('btn-precargar-pedido')?.classList.add('hidden');

    renderizarTablaProductosProduccion();
    recalcularRequerimientoMP();
    renderizarTablaMaquinariaProduccion();
}

// ==========================================
// PANTALLA A: HISTORIAL / LISTADO DE OP
// ==========================================
function renderizarHistorialProduccion() {
    const tbody = document.getElementById('tabla-ordenes-produccion');
    if (!tbody) return;

    const filtroEstado = document.getElementById('historial-filtro-estado')?.value || '';
    const termino = normalizarTexto(document.getElementById('historial-buscador')?.value || '').trim();

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

        const cancelable = o.estado === 'En Proceso';

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 border-b border-slate-100';
        tr.innerHTML = `
            <td class="px-6 py-3 font-semibold text-slate-800 whitespace-nowrap">OP-${o.id_orden_produccion}</td>
            <td class="px-6 py-3 text-slate-600 whitespace-nowrap">${o.id_orden_pedido_cliente ? 'PED-' + o.id_orden_pedido_cliente : 'Producción interna'}</td>
            <td class="px-6 py-3 text-slate-600 whitespace-nowrap">${o.id_empleado}</td>
            <td class="px-6 py-3 text-slate-600">${prodTexto}</td>
            <td class="px-6 py-3 text-slate-500 whitespace-nowrap">${formatearFechaLatina(o.fecha_emision)}</td>
            <td class="px-6 py-3 text-center"><span class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${COLOR_ESTADO_ORDEN_PRODUCCION[o.estado]}">${o.estado}</span></td>
            <td class="px-6 py-3 text-center whitespace-nowrap">
                <button type="button" onclick="verDetalleOrdenProduccion(${o.id_orden_produccion})" title="Ver detalle" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                ${cancelable ? `<button type="button" onclick="cancelarOrdenProduccion(${o.id_orden_produccion})" title="Cancelar orden" class="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"><i data-lucide="x-circle" class="w-4 h-4"></i></button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function cancelarOrdenProduccion(id) {
    const orden = listaOrdenesProduccion.find(o => o.id_orden_produccion === id);
    if (!orden) return;
    if (!confirm(`¿Cancelar la orden OP-${id}? Esta acción no se puede deshacer.`)) return;

    if (orden.stockDescontado) {
        orden.detalleMateriaPrima.forEach(d => {
            if (stockMateriaPrima[d.clave_mp]) stockMateriaPrima[d.clave_mp].cantidad_actual += d.cantidad_planificada;
        });
    }
    if (orden.id_orden_pedido_cliente && typeof listaPedidos !== 'undefined') {
        const pedido = listaPedidos.find(p => p.id === orden.id_orden_pedido_cliente);
        if (pedido && pedido.estado === 'En preparación') pedido.estado = 'Pendiente';
    }
    orden.estado = 'Cancelada';
    orden.stockDescontado = false;

    renderizarStockUI();
    renderizarHistorialProduccion();
    renderizarStatsProduccion();
}

function renderizarStatsProduccion() {
    if (!document.getElementById('kpi-prod-total')) return;
    document.getElementById('kpi-prod-total').textContent = listaOrdenesProduccion.length;
    document.getElementById('kpi-prod-en-proceso').textContent = listaOrdenesProduccion.filter(o => o.estado === 'En Proceso').length;
    document.getElementById('kpi-prod-finalizadas').textContent = listaOrdenesProduccion.filter(o => o.estado === 'Finalizada').length;
    document.getElementById('kpi-prod-canceladas').textContent = listaOrdenesProduccion.filter(o => o.estado === 'Cancelada').length;
    document.getElementById('kpi-prod-stock-bajo').textContent = Object.values(stockMateriaPrima).filter(mp => mp.cantidad_actual <= 20).length;
}

// ==========================================
// PANTALLA C: DETALLE DE ORDEN (Sin línea de avance + Fechas DD/MM/AAAA)
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

    const filasProductos = o.detalleProductos.map(d => `
        <tr>
            <td class="p-3 font-medium text-slate-800">${d.nombre_producto}</td>
            <td class="p-3 text-center whitespace-nowrap">${formatearCantidad(d.cantidad_planificada)} kg</td>
            <td class="p-3 text-center"><span class="${d.cantidad_real == null ? 'text-slate-400' : 'text-slate-700'}">${d.cantidad_real != null ? formatearCantidad(d.cantidad_real) : '-'}</span></td>
            <td class="p-3 text-center text-slate-600">${d.numero_lote_definitivo || d.numero_lote_proyectado}${d.numero_lote_definitivo ? '' : ' (proy.)'}</td>
            <td class="p-3 text-center"><span class="${d.fecha_vencimiento ? 'text-slate-600' : 'text-slate-400'}">${formatearFechaLatina(d.fecha_vencimiento)}</span></td>
        </tr>`).join('');

    const filasMP = o.detalleMateriaPrima.map(d => `
        <tr>
            <td class="p-3 font-medium text-slate-800">${d.nombre}</td>
            <td class="p-3 text-center whitespace-nowrap">${formatearCantidad(d.cantidad_planificada)}</td>
            <td class="p-3 text-center whitespace-nowrap"><span class="${d.cantidad_real == null ? 'text-slate-400' : 'text-slate-700'}">${d.cantidad_real != null ? formatearCantidad(d.cantidad_real) : '-'}</span></td>
            <td class="p-3 text-center whitespace-nowrap">${stockMateriaPrima[d.clave_mp] ? stockMateriaPrima[d.clave_mp].unidad_medida : 'kg'}</td>
        </tr>`).join('');

    const filasMaquinaria = o.detalleMaquinaria.map(m => `
        <tr>
            <td class="p-3 font-medium text-slate-800">${m.nombre_maquinaria}</td>
            <td class="p-3 text-slate-600 text-center">${m.hora_inicio_planificada || '08:00'}</td>
            <td class="p-3 text-slate-600 text-center">${m.hora_fin_planificada || '17:00'}</td>
            <td class="p-3 text-center"><span class="${m.hora_inicio_real ? 'text-slate-700' : 'text-slate-400'}">${m.hora_inicio_real || '-'}</span></td>
            <td class="p-3 text-center"><span class="${m.hora_fin_real ? 'text-slate-700' : 'text-slate-400'}">${m.hora_fin_real || '-'}</span></td>
        </tr>`).join('');

    cont.innerHTML = `
        <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                    <div class="flex items-center space-x-3">
                        <h3 class="text-xl font-bold text-slate-900">Orden de Producción OP-${o.id_orden_produccion}</h3>
                        <span class="text-xs px-2.5 py-0.5 rounded-full font-semibold ${COLOR_ESTADO_ORDEN_PRODUCCION[o.estado]}">${o.estado}</span>
                    </div>
                    <p class="text-xs text-slate-500 mt-1">Origen: <span class="font-medium text-slate-700">${o.id_orden_pedido_cliente ? 'PED-' + o.id_orden_pedido_cliente : 'Producción interna'}</span> — Empleado Responsable: <span class="font-medium text-slate-700">${o.id_empleado}</span></p>
                </div>
                ${o.estado === 'En Proceso' ? `
                    <button type="button" onclick="abrirModalCierreOrden(${o.id_orden_produccion})" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2 shadow-sm transition">
                        <i data-lucide="check-check" class="w-4 h-4"></i><span>Cerrar Orden de Producción</span>
                    </button>` : ''}
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div class="bg-slate-50 p-3 rounded-lg"><p class="text-slate-400">Emisión</p><p class="font-bold text-slate-800">${formatearFechaLatina(o.fecha_emision)} (${o.hora_emision} hs)</p></div>
                <div class="bg-slate-50 p-3 rounded-lg"><p class="text-slate-400">Inicio Programado</p><p class="font-bold text-slate-800">${formatearFechaLatina(o.fecha_inicio)} (${o.hora_inicio} hs)</p></div>
                <div class="bg-slate-50 p-3 rounded-lg"><p class="text-slate-400">Fin Programado</p><p class="font-bold text-slate-800">${formatearFechaLatina(o.fecha_fin)} (${o.hora_fin} hs)</p></div>
                <div class="bg-slate-50 p-3 rounded-lg"><p class="text-slate-400">Vencimiento Producción</p><p class="font-bold text-slate-800">${formatearFechaLatina(o.fecha_vencimiento)}</p></div>
            </div>

            <!-- Tablas de detalle -->
            <div class="space-y-4">
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Productos Fabricados</h4>
                <table class="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                    <thead class="bg-slate-50 uppercase text-slate-500 border-b border-slate-200">
                        <tr><th class="p-3">Producto</th><th class="p-3 text-center">Cant. Plan.</th><th class="p-3 text-center">Cant. Real</th><th class="p-3 text-center">Lote</th><th class="p-3 text-center">Vencimiento</th></tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">${filasProductos}</tbody>
                </table>

                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Materia Prima Consumida</h4>
                <table class="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                    <thead class="bg-slate-50 uppercase text-slate-500 border-b border-slate-200">
                        <tr><th class="p-3">Insumo</th><th class="p-3 text-center">Cant. Plan.</th><th class="p-3 text-center">Cant. Real Utilizada</th><th class="p-3 text-center">Unidad</th></tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">${filasMP}</tbody>
                </table>

                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Maquinaria Utilizada</h4>
                <table class="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                    <thead class="bg-slate-50 uppercase text-slate-500 border-b border-slate-200">
                        <tr><th class="p-3">Maquinaria</th><th class="p-3 text-center">Inicio Plan.</th><th class="p-3 text-center">Fin Plan.</th><th class="p-3 text-center">Inicio Real</th><th class="p-3 text-center">Fin Real</th></tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">${filasMaquinaria}</tbody>
                </table>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// MODAL CIERRE DE ORDEN
// ==========================================
function abrirModalCierreOrden(id) {
    ordenEnCierreId = id;
    const orden = listaOrdenesProduccion.find(o => o.id_orden_produccion === id);
    if (!orden) return;

    const modal = document.getElementById('modal-cierre-orden');
    const cont = document.getElementById('modal-cierre-contenido');
    if (!modal || !cont) return;

    const fechaSugerida = new Date();
    fechaSugerida.setDate(fechaSugerida.getDate() + 15);
    const strVenc = fechaSugerida.toISOString().slice(0, 10);
    const horaActual = new Date().toTimeString().slice(0, 5);

    let html = `
        <div class="space-y-5 text-xs">
            <p class="text-slate-500">Confirme los valores reales consumidos y producidos para cerrar la orden OP-${orden.id_orden_produccion}:</p>

            <!-- 1. Productos -->
            <div class="space-y-2">
                <h5 class="font-bold text-slate-700 uppercase">1. Producción Real Obtenida</h5>
                ${orden.detalleProductos.map((p, idx) => `
                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                        <p class="font-bold text-slate-800">${p.nombre_producto}</p>
                        <div class="grid grid-cols-3 gap-2">
                            <div>
                                <label class="block text-[10px] text-slate-500">Cant. Real (kg)</label>
                                <input type="number" id="cierre-prod-cant-${idx}" value="${p.cantidad_planificada}" class="w-full border border-slate-300 rounded p-1">
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-500">Lote Definitivo</label>
                                <input type="text" id="cierre-prod-lote-${idx}" value="${p.numero_lote_proyectado}" class="w-full border border-slate-300 rounded p-1">
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-500">Vencimiento</label>
                                <input type="date" id="cierre-prod-venc-${idx}" value="${strVenc}" class="w-full border border-slate-300 rounded p-1">
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- 2. Materia Prima Real -->
            <div class="space-y-2">
                <h5 class="font-bold text-slate-700 uppercase">2. Materia Prima Real Utilizada</h5>
                ${orden.detalleMateriaPrima.map((mp, idx) => `
                    <div class="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <span class="font-medium text-slate-800">${mp.nombre}</span>
                        <div class="flex items-center space-x-2">
                            <span class="text-slate-400">(Plan: ${mp.cantidad_planificada})</span>
                            <input type="number" id="cierre-mp-cant-${idx}" value="${mp.cantidad_planificada}" class="w-20 border border-slate-300 rounded p-1 text-center">
                            <span class="text-slate-500">${stockMateriaPrima[mp.clave_mp] ? stockMateriaPrima[mp.clave_mp].unidad_medida : 'kg'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- 3. Maquinaria Horas Reales -->
            <div class="space-y-2">
                <h5 class="font-bold text-slate-700 uppercase">3. Horas Reales de Maquinaria</h5>
                ${orden.detalleMaquinaria.map((m, idx) => `
                    <div class="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                        <p class="font-medium text-slate-800">${m.nombre_maquinaria}</p>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[10px] text-slate-500">Hora Inicio Real</label>
                                <input type="time" id="cierre-maq-inicio-${idx}" value="${m.hora_inicio_planificada || '08:00'}" class="w-full border border-slate-300 rounded p-1">
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-500">Hora Fin Real</label>
                                <input type="time" id="cierre-maq-fin-${idx}" value="${horaActual}" class="w-full border border-slate-300 rounded p-1">
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    cont.innerHTML = html;
    modal.classList.remove('hidden');
}

function confirmarCierreOrden() {
    const orden = listaOrdenesProduccion.find(o => o.id_orden_produccion === ordenEnCierreId);
    if (!orden) return;

    let primeraFechaVenc = null;

    orden.detalleProductos.forEach((p, idx) => {
        p.cantidad_real = parseFloat(document.getElementById(`cierre-prod-cant-${idx}`)?.value) || p.cantidad_planificada;
        p.numero_lote_definitivo = document.getElementById(`cierre-prod-lote-${idx}`)?.value || p.numero_lote_proyectado;
        p.fecha_vencimiento = document.getElementById(`cierre-prod-venc-${idx}`)?.value;
        if (!primeraFechaVenc) primeraFechaVenc = p.fecha_vencimiento;
    });

    orden.fecha_vencimiento = primeraFechaVenc;

    orden.detalleMateriaPrima.forEach((mp, idx) => {
        const cantReal = parseFloat(document.getElementById(`cierre-mp-cant-${idx}`)?.value) || mp.cantidad_planificada;
        const diferencia = cantReal - mp.cantidad_planificada;
        mp.cantidad_real = cantReal;

        if (diferencia !== 0 && stockMateriaPrima[mp.clave_mp]) {
            stockMateriaPrima[mp.clave_mp].cantidad_actual -= diferencia;
        }
    });

    orden.detalleMaquinaria.forEach((m, idx) => {
        m.hora_inicio_real = document.getElementById(`cierre-maq-inicio-${idx}`)?.value;
        m.hora_fin_real = document.getElementById(`cierre-maq-fin-${idx}`)?.value;
    });

    orden.estado = 'Finalizada';

    if (orden.id_orden_pedido_cliente && typeof listaPedidos !== 'undefined') {
        const pedido = listaPedidos.find(p => p.id === orden.id_orden_pedido_cliente);
        if (pedido) pedido.estado = 'Listo';
    }

    cerrarModalCierreOrden();
    renderizarHistorialProduccion();
    renderizarStatsProduccion();
    if (ordenDetalleActualId) renderizarDetalleOrdenProduccion();
    alert(`Orden OP-${orden.id_orden_produccion} finalizada y cerrada exitosamente.`);
}

function cerrarModalCierreOrden() {
    document.getElementById('modal-cierre-orden')?.classList.add('hidden');
    ordenEnCierreId = null;
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
function initPaginaProduccion() {
    inicializarEmpleadoLogueado();
    window.addEventListener('hashchange', irASubvistaDesdeHashProduccion);
    irASubvistaDesdeHashProduccion();
}