// ==========================================
// MÓDULO DE PRODUCCIÓN: Orden_Producción (ejecuta una Receta: id_receta) + detalle de producto y de materia prima
// Ciclo: A iniciar (nace así; se puede editar o cancelar) -> En Proceso (descuenta la MP planificada; ya no se
// edita ni se cancela) -> Finalizada (Cierre: cantidad real y vencimiento por producto, ajusta stock por la MP real)
// Pantallas: Historial (listado + KPIs) / Registrar-Editar Orden / Detalle de Orden (consulta + cierre)
// ==========================================
const SUBVISTAS_PRODUCCION = [
    'historial', 'nueva-orden', 'detalle-orden',
    'productos', 'registrar-producto',
    'recetas', 'registrar-receta',
    'materias-primas', 'registrar-materia-prima',
    'maquinaria', 'registrar-maquinaria', 'historial-maquina'
];
let itemsProductosProduccionActual = [];
let ultimoRequerimientoMP = [];
let ordenDetalleActualId = null;
let ordenEnCierreId = null; // id de la OP que se está cerrando
let ordenProduccionEnEdicionId = null;
let ordenListadoProduccion = { campo: '', direccion: '' };
let filtroEstadoProduccion = '';

function elegirFiltroEstadoProduccion(estado) {
    filtroEstadoProduccion = estado;
    document.getElementById('pop-prod-estado')?.classList.add('hidden');
    renderizarHistorialProduccion();
}

function ordenarListadoProduccion(campo) {
    ordenListadoProduccion.direccion = ordenListadoProduccion.campo === campo && ordenListadoProduccion.direccion === 'asc' ? 'desc' : 'asc';
    ordenListadoProduccion.campo = campo;
    renderizarHistorialProduccion();
}

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
    if (hash !== 'nueva-orden') ordenProduccionEnEdicionId = null;
    if (hash === 'nueva-orden') {
        if (!ordenProduccionEnEdicionId) resetFormularioNuevaOrden();
        mostrarSubvistaProduccion('nueva-orden');
    } else if (hash === 'productos') {
        renderizarTablaProductos();
        mostrarSubvistaProduccion('productos');
    } else if (hash === 'registrar-producto') {
        if (!productoEnEdicionId) resetFormularioProducto();
        mostrarSubvistaProduccion('registrar-producto');
    } else if (hash === 'recetas') {
        renderizarTablaRecetas();
        mostrarSubvistaProduccion('recetas');
    } else if (hash === 'registrar-receta') {
        if (!recetaEnEdicionId) resetFormularioReceta();
        mostrarSubvistaProduccion('registrar-receta');
    } else if (hash === 'materias-primas') {
        renderizarTablaMateriasPrimas();
        mostrarSubvistaProduccion('materias-primas');
    } else if (hash === 'registrar-materia-prima') {
        if (!materiaPrimaEnEdicionId) resetFormularioMateriaPrima();
        mostrarSubvistaProduccion('registrar-materia-prima');
    } else if (hash === 'maquinaria') {
        renderizarTablaMaquinaria();
        mostrarSubvistaProduccion('maquinaria');
    } else if (hash === 'registrar-maquinaria') {
        if (!maquinariaEnEdicionId) resetFormularioMaquinaria();
        mostrarSubvistaProduccion('registrar-maquinaria');
    } else {
        renderizarStockUI();
        renderizarHistorialProduccion();
        renderizarStatsProduccion();
        mostrarSubvistaProduccion('historial');
    }
}

function irANuevaOrdenProduccion() {
    ordenProduccionEnEdicionId = null;
    if (window.location.hash !== '#nueva-orden') window.location.hash = 'nueva-orden'; 
    else irASubvistaDesdeHashProduccion();
}

function volverAlHistorialProduccion() {
    if (window.location.hash !== '#historial') window.location.hash = 'historial'; 
    else irASubvistaDesdeHashProduccion();
}

// ==========================================
// STOCK DE MATERIA PRIMA (el mismo stock de la pantalla Materias Primas)
// ==========================================
const stockBajoMateriaPrima = mp => mp.stock_actual <= mp.stock_minimo;

function renderizarStockUI() {
    const grid = document.getElementById('grid-stock-materia-prima');
    if (!grid) return;
    grid.innerHTML = '';
    listaMateriasPrimas.filter(mp => mp.estado_activa).forEach(mp => {
        const bajo = stockBajoMateriaPrima(mp);
        const div = document.createElement('div');
        div.className = 'bg-white border border-slate-200 rounded-xl p-4';
        div.innerHTML = `
            <p class="text-xs text-slate-400">${mp.nombre_materia_prima}</p>
            <p class="text-xl font-bold ${bajo ? 'text-red-600' : 'text-slate-900'}">${formatearCantidad(mp.stock_actual)} <span class="text-xs font-normal text-slate-400">${abreviaturaUnidadMedida(mp.id_unidad_medida)}</span></p>
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
// SECCIÓN 1: RECETA A EJECUTAR
// ==========================================
function productoProduccionPorNombre(nombre) {
    return listaProductos.find(p => normalizarTexto(p.nombre) === normalizarTexto(nombre));
}

function unidadProductoProduccion(nombre) {
    const producto = productoProduccionPorNombre(nombre);
    return producto ? nombreUnidadMedida(producto.id_unidad_medida) : 'Kilogramo (Kg)';
}

// Orden_Producción.id_receta: cada orden ejecuta UNA receta (como en el diagrama de clases). El producto a
// fabricar es el de la receta; el detalle de productos de la orden queda con esa única línea.
function poblarSelectRecetaOrden(idSeleccionada) {
    const select = document.getElementById('prod-receta');
    if (!select) return;
    // Al editar, la receta ya elegida se mantiene en la lista aunque después se haya desactivado.
    const recetas = listaRecetas.filter(r => r.estado_activa || r.id_receta === idSeleccionada);
    select.innerHTML = '<option value="" disabled selected>Elegí la receta a ejecutar</option>' +
        recetas.map(r => `<option value="${r.id_receta}">${r.nombre_receta} (v${r.version}) · ${r.nombre_producto}</option>`).join('');
    if (idSeleccionada) select.value = idSeleccionada;
}

function elegirRecetaOrdenProduccion() {
    const receta = listaRecetas.find(r => r.id_receta === parseInt(document.getElementById('prod-receta').value));
    if (!receta) return;
    // Propone la cantidad estándar de la receta; se puede cambiar.
    document.getElementById('prod-item-cant').value = receta.cantidad_a_producir;
    actualizarCantidadOrdenProduccion();
}

function actualizarCantidadOrdenProduccion() {
    const receta = listaRecetas.find(r => r.id_receta === parseInt(document.getElementById('prod-receta').value));
    const cantidad = parseFloat(document.getElementById('prod-item-cant').value);
    const loteAnterior = itemsProductosProduccionActual[0]?.numero_lote_proyectado;
    itemsProductosProduccionActual = receta && cantidad > 0 ? [{
        id_receta: receta.id_receta,
        nombre_producto: receta.nombre_producto,
        nombre_receta: receta.nombre_receta,
        cantidad_planificada: cantidad,
        numero_lote_proyectado: loteAnterior
    }] : [];
    document.getElementById('prod-item-unidad').textContent = receta ? abreviaturaUnidadMedida(productoProduccionPorNombre(receta.nombre_producto)?.id_unidad_medida) : '';
    renderizarTablaProductosProduccion();
    recalcularRequerimientoMP();
}

function renderizarTablaProductosProduccion() {
    const tbody = document.getElementById('tabla-productos-produccion');
    if (!tbody) return;
    if (itemsProductosProduccionActual.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400 text-xs">Elegí la receta a ejecutar y la cantidad a fabricar.</td></tr>`;
        return;
    }
    tbody.innerHTML = itemsProductosProduccionActual.map(item => `
        <tr>
            <td class="p-3 font-medium text-slate-800">${item.nombre_producto}</td>
            <td class="p-3 text-slate-500">${item.nombre_receta}</td>
            <td class="p-3 text-center">${formatearCantidad(item.cantidad_planificada)}</td>
            <td class="p-3 text-center text-slate-500 whitespace-nowrap">${unidadProductoProduccion(item.nombre_producto)}</td>
            <td class="p-3 text-center ${item.numero_lote_proyectado ? 'text-slate-600' : 'text-slate-400'}">${item.numero_lote_proyectado || 'Se asigna al registrar'}</td>
        </tr>`).join('');
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
            const mp = materiaPrimaDeItem(d);
            if (!mp) return;
            mapa[mp.id_materia_prima] = (mapa[mp.id_materia_prima] || 0) + (d.cantidad_por_kg || 0) * item.cantidad_planificada;
        });
    });

    return Object.entries(mapa).map(([id, cantidad_planificada]) => {
        const mp = listaMateriasPrimas.find(m => m.id_materia_prima === Number(id));
        return {
            id_materia_prima: mp.id_materia_prima,
            nombre: mp.nombre_materia_prima,
            cantidad_planificada: +cantidad_planificada.toFixed(2)
        };
    });
}

const stockDisponibleMP = d => materiaPrimaDeItem(d)?.stock_actual || 0;
const unidadMP = d => { const mp = materiaPrimaDeItem(d); return mp ? abreviaturaUnidadMedida(mp.id_unidad_medida) : 'kg'; };

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
        const disponible = stockDisponibleMP(d);
        const unidad = unidadMP(d);
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

// El faltante (en la unidad de stock) se convierte a envases del catálogo de compra (ej. 30 kg de harina -> 1 Bolsa
// 50kg) y se precarga en una nueva Orden de Compra.
function generarNotaPedidoMP() {
    const faltantes = ultimoRequerimientoMP
        .map(d => {
            const mp = materiaPrimaDeItem(d);
            const faltante = d.cantidad_planificada - mp.stock_actual;
            if (faltante <= 0) return null;
            const item = itemCatalogoComprasDeMateriaPrima(mp);
            return { clave: item.clave, cantidad: Math.ceil(faltante / item.contenido) };
        })
        .filter(Boolean);
    if (!faltantes.length) return;
    guardarDatos();
    sessionStorage.setItem('notaPedidoMPPendiente', JSON.stringify(faltantes));
    alert('Se generó la Nota de Pedido de Materia Prima. Te llevamos a Compras para elegir el proveedor y confirmar la Orden de Compra.');
    window.location.href = 'compras.html#registrar-orden-compra';
}

// ==========================================
// REGISTRAR / EDITAR ORDEN DE PRODUCCIÓN (solo editable mientras está "A iniciar")
// ==========================================
function editarOrdenProduccion(id) {
    const o = listaOrdenesProduccion.find(x => x.id_orden_produccion === id);
    if (!o || o.estado !== 'A iniciar') return alert('Solo se pueden modificar órdenes en estado "A iniciar".');

    resetFormularioNuevaOrden();
    ordenProduccionEnEdicionId = id;
    const codigo = formatearIdentificador("OP", id);
    document.getElementById('titulo-nueva-orden').innerText = `Editar Orden de Producción ${codigo}`;
    document.getElementById('codigo-nueva-orden').innerText = codigo;
    document.getElementById('texto-boton-nueva-orden').innerText = 'Guardar cambios';
    document.getElementById('prod-empleado').value = o.id_empleado;
    document.getElementById('prod-fecha-inicio').value = o.fecha_inicio;
    document.getElementById('prod-hora-inicio').value = o.hora_inicio;
    document.getElementById('prod-fecha-fin').value = o.fecha_fin;
    document.getElementById('prod-hora-fin').value = o.hora_fin;
    document.getElementById('prod-observaciones').value = o.observaciones || '';

    const linea = o.detalleProductos[0];
    poblarSelectRecetaOrden(o.id_receta);
    document.getElementById('prod-item-cant').value = linea ? linea.cantidad_planificada : '';
    itemsProductosProduccionActual = linea ? [{ numero_lote_proyectado: linea.numero_lote_proyectado }] : [];
    actualizarCantidadOrdenProduccion();

    if (window.location.hash !== '#nueva-orden') window.location.hash = 'nueva-orden';
    else mostrarSubvistaProduccion('nueva-orden');
}

function registrarOrdenProduccion() {
    const empleado = document.getElementById('prod-empleado')?.value;

    const fechaInicio = document.getElementById('prod-fecha-inicio')?.value;
    const horaInicio = document.getElementById('prod-hora-inicio')?.value;
    const fechaFin = document.getElementById('prod-fecha-fin')?.value;
    const horaFin = document.getElementById('prod-hora-fin')?.value;
    const observaciones = document.getElementById('prod-observaciones')?.value.trim() || '';

    if (itemsProductosProduccionActual.length === 0) return alert('Elegí la receta a ejecutar y una cantidad a fabricar válida.');
    if (!fechaInicio || !horaInicio || !fechaFin || !horaFin) return alert('Complete la fecha y hora de inicio y fin programadas.');

    const detalleMateriaPrima = calcularRequerimientoConsolidado(itemsProductosProduccionActual);

    const faltante = detalleMateriaPrima.find(d => d.cantidad_planificada > stockDisponibleMP(d));
    if (faltante) return alert(`Stock insuficiente de ${faltante.nombre} para esta orden. Generá una Nota de Pedido de MP desde Compras antes de continuar.`);

    const detalleProductos = itemsProductosProduccionActual.map(it => ({
        id_receta: it.id_receta,
        nombre_producto: it.nombre_producto,
        nombre_receta: it.nombre_receta,
        cantidad_planificada: it.cantidad_planificada,
        cantidad_real: null,
        numero_lote_proyectado: it.numero_lote_proyectado || `LOT-${numLoteContador++}`,
        numero_lote_definitivo: null,
        fecha_vencimiento: null
    }));

    if (ordenProduccionEnEdicionId) {
        const ordenEditada = listaOrdenesProduccion.find(o => o.id_orden_produccion === ordenProduccionEnEdicionId);
        if (!ordenEditada || ordenEditada.estado !== 'A iniciar') return alert('Solo se pueden modificar órdenes en estado "A iniciar".');
        Object.assign(ordenEditada, {
            fecha_inicio: fechaInicio, hora_inicio: horaInicio, fecha_fin: fechaFin, hora_fin: horaFin,
            observaciones, id_receta: detalleProductos[0].id_receta, detalleProductos, detalleMateriaPrima
        });
        ordenProduccionEnEdicionId = null;
        guardarDatos();
        alert(`¡Orden de producción ${formatearIdentificador("OP", ordenEditada.id_orden_produccion)} actualizada!`);
        volverAlHistorialProduccion();
        return;
    }

    const ahora = new Date();
    const orden = {
        id_orden_produccion: numOrdenProduccionContador++,
        id_empleado: empleado,
        id_receta: detalleProductos[0].id_receta,
        fecha_emision: ahora.toISOString().slice(0, 10),
        hora_emision: ahora.toTimeString().slice(0, 5),
        fecha_inicio: fechaInicio,
        hora_inicio: horaInicio,
        fecha_fin: fechaFin,
        hora_fin: horaFin,
        fecha_vencimiento: null,
        estado: 'A iniciar',
        observaciones: observaciones,
        stockDescontado: false,
        detalleProductos,
        detalleMateriaPrima
    };

    listaOrdenesProduccion.unshift(orden);
    guardarDatos();

    alert(`¡Orden de producción ${formatearIdentificador("OP", orden.id_orden_produccion)} registrada! Lote proyectado: ${detalleProductos[0].numero_lote_proyectado}.`);
    volverAlHistorialProduccion();
}

function resetFormularioNuevaOrden() {
    itemsProductosProduccionActual = [];
    ordenProduccionEnEdicionId = null;

    inicializarEmpleadoLogueado();
    document.getElementById('titulo-nueva-orden').innerText = 'Registrar Orden de Producción';
    document.getElementById('codigo-nueva-orden').innerText = 'se asigna automáticamente al registrar';
    document.getElementById('texto-boton-nueva-orden').innerText = 'Registrar Orden de Producción';

    if (document.getElementById('prod-observaciones')) document.getElementById('prod-observaciones').value = '';
    poblarSelectRecetaOrden(null);
    if (document.getElementById('prod-item-cant')) document.getElementById('prod-item-cant').value = '';
    if (document.getElementById('prod-item-unidad')) document.getElementById('prod-item-unidad').textContent = '';

    const hoyStr = new Date().toISOString().slice(0, 10);
    if (document.getElementById('prod-fecha-inicio')) document.getElementById('prod-fecha-inicio').value = hoyStr;
    if (document.getElementById('prod-hora-inicio')) document.getElementById('prod-hora-inicio').value = '08:00';
    if (document.getElementById('prod-fecha-fin')) document.getElementById('prod-fecha-fin').value = hoyStr;
    if (document.getElementById('prod-hora-fin')) document.getElementById('prod-hora-fin').value = '17:00';

    renderizarTablaProductosProduccion();
    recalcularRequerimientoMP();
}

// ==========================================
// PANTALLA A: HISTORIAL / LISTADO DE OP
// ==========================================
// Orden_Producción.id_receta -> "Receta Tallarines al Huevo (v1)".
function textoRecetaOrden(o) {
    const receta = listaRecetas.find(r => r.id_receta === o.id_receta);
    if (receta) return `${receta.nombre_receta} (v${receta.version})`;
    return o.detalleProductos?.[0]?.nombre_receta || '-';
}

function renderizarHistorialProduccion() {
    const tbody = document.getElementById('tabla-ordenes-produccion');
    if (!tbody) return;

    const filtroEstado = filtroEstadoProduccion;
    const terminoNumero = normalizarTexto(document.getElementById('buscar-prod-numero')?.value || '').trim();
    const terminoEmpleado = normalizarTexto(document.getElementById('buscar-prod-empleado')?.value || '').trim();
    const terminoProducto = normalizarTexto(document.getElementById('buscar-prod-producto')?.value || '').trim();
    const terminoReceta = normalizarTexto(document.getElementById('buscar-prod-receta')?.value || '').trim();
    const terminoObservaciones = normalizarTexto(document.getElementById('buscar-prod-observaciones')?.value || '').trim();
    const vencimientoDesde = document.getElementById('buscar-prod-vencimiento-desde')?.value || '';
    const vencimientoHasta = document.getElementById('buscar-prod-vencimiento-hasta')?.value || '';

    const ordenes = listaOrdenesProduccion.filter(o => {
        if (filtroEstado && o.estado !== filtroEstado) return false;
        const numero = formatearIdentificador('OP', o.id_orden_produccion);
        const producto = o.detalleProductos.map(d => d.nombre_producto).join(' ');
        return (!terminoNumero || normalizarTexto(numero).includes(terminoNumero)) &&
            (!terminoEmpleado || normalizarTexto(o.id_empleado).includes(terminoEmpleado)) &&
            (!terminoProducto || normalizarTexto(producto).includes(terminoProducto)) &&
            (!terminoReceta || normalizarTexto(textoRecetaOrden(o)).includes(terminoReceta)) &&
            (!terminoObservaciones || normalizarTexto(o.observaciones || '').includes(terminoObservaciones)) &&
            coincideRangoFecha(vencimientoDesde, vencimientoHasta, o.fecha_vencimiento);
    });

    if (['empleado', 'producto', 'estado'].includes(ordenListadoProduccion.campo)) {
        const campo = ordenListadoProduccion.campo;
        ordenes.sort((a, b) => {
            const va = campo === 'empleado' ? a.id_empleado : campo === 'estado' ? a.estado : a.detalleProductos.map(d => d.nombre_producto).join(' ');
            const vb = campo === 'empleado' ? b.id_empleado : campo === 'estado' ? b.estado : b.detalleProductos.map(d => d.nombre_producto).join(' ');
            const cmp = typeof va === 'number' ? va - vb : String(va || '').localeCompare(String(vb || ''), 'es');
            return ordenListadoProduccion.direccion === 'asc' ? cmp : -cmp;
        });
    }

    tbody.innerHTML = '';
    if (ordenes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-sm text-slate-400">No se encontraron órdenes de producción con esos filtros.</td></tr>`;
        return;
    }

    ordenes.forEach(o => {
        const prodTexto = o.detalleProductos.map(d => d.nombre_producto).join(', ');

        const aIniciar = o.estado === 'A iniciar';

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 border-b border-slate-100';
        tr.innerHTML = `
            <td class="px-6 py-3 font-semibold text-slate-800 whitespace-nowrap">${formatearIdentificador("OP", o.id_orden_produccion)}</td>
            <td class="px-6 py-3 text-slate-600 whitespace-nowrap">${o.id_empleado}</td>
            <td class="px-6 py-3 text-slate-600">${prodTexto}</td>
            <td class="px-6 py-3 text-slate-500">${textoRecetaOrden(o)}</td>
            <td class="px-6 py-3 text-slate-500 whitespace-nowrap">${formatearFechaLatina(o.fecha_vencimiento)}</td>
            <td class="px-6 py-3 text-center"><span class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${COLOR_ESTADO_ORDEN_PRODUCCION[o.estado]}">${o.estado}</span></td>
            <td class="px-6 py-3 text-slate-500 max-w-[180px] truncate" title="${o.observaciones || ''}">${o.observaciones || '-'}</td>
            <td class="px-6 py-3 text-center whitespace-nowrap">
                <button type="button" onclick="verDetalleOrdenProduccion(${o.id_orden_produccion})" title="Ver detalle" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                ${aIniciar ? `
                <button type="button" onclick="editarOrdenProduccion(${o.id_orden_produccion})" title="Editar orden" class="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                <button type="button" onclick="marcarEnProcesoOrdenProduccion(${o.id_orden_produccion})" title="Marcar En Proceso" class="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"><i data-lucide="play-circle" class="w-4 h-4"></i></button>
                <button type="button" onclick="cancelarOrdenProduccion(${o.id_orden_produccion})" title="Cancelar orden" class="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"><i data-lucide="x-circle" class="w-4 h-4"></i></button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Al pasar a "En Proceso" recién se descuenta la MP planificada (mientras está "A iniciar" la orden todavía se puede editar).
function marcarEnProcesoOrdenProduccion(id) {
    const orden = listaOrdenesProduccion.find(o => o.id_orden_produccion === id);
    if (!orden || orden.estado !== 'A iniciar') return;

    const faltante = orden.detalleMateriaPrima.find(d => d.cantidad_planificada > stockDisponibleMP(d));
    if (faltante) return alert(`Stock insuficiente de ${faltante.nombre} para iniciar la orden ${formatearIdentificador("OP", id)}. Generá una Nota de Pedido de MP desde Compras antes de continuar.`);
    if (!confirm(`¿Marcar la orden ${formatearIdentificador("OP", id)} como En Proceso? A partir de ahora no se podrá modificar ni cancelar.`)) return;

    orden.detalleMateriaPrima.forEach(d => {
        const mp = materiaPrimaDeItem(d);
        if (mp) mp.stock_actual = +(mp.stock_actual - d.cantidad_planificada).toFixed(3);
    });
    orden.estado = 'En Proceso';
    orden.stockDescontado = true;
    guardarDatos();

    renderizarStockUI();
    renderizarHistorialProduccion();
    renderizarStatsProduccion();
}

function cancelarOrdenProduccion(id) {
    const orden = listaOrdenesProduccion.find(o => o.id_orden_produccion === id);
    if (!orden) return;
    if (orden.estado !== 'A iniciar') return alert('Solo se pueden cancelar órdenes en estado "A iniciar".');
    if (!confirm(`¿Cancelar la orden ${formatearIdentificador("OP", id)}? Esta acción no se puede deshacer.`)) return;

    orden.estado = 'Cancelada';
    guardarDatos();

    renderizarHistorialProduccion();
    renderizarStatsProduccion();
}

function renderizarStatsProduccion() {
    if (!document.getElementById('kpi-prod-total')) return;
    document.getElementById('kpi-prod-total').textContent = listaOrdenesProduccion.length;
    document.getElementById('kpi-prod-a-iniciar').textContent = listaOrdenesProduccion.filter(o => o.estado === 'A iniciar').length;
    document.getElementById('kpi-prod-en-proceso').textContent = listaOrdenesProduccion.filter(o => o.estado === 'En Proceso').length;
    document.getElementById('kpi-prod-finalizadas').textContent = listaOrdenesProduccion.filter(o => o.estado === 'Finalizada').length;
    document.getElementById('kpi-prod-canceladas').textContent = listaOrdenesProduccion.filter(o => o.estado === 'Cancelada').length;
    document.getElementById('kpi-prod-stock-bajo').textContent = listaMateriasPrimas.filter(mp => mp.estado_activa && stockBajoMateriaPrima(mp)).length;
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

    const conUnidad = (cantidad, unidad) => cantidad != null ? `${formatearCantidad(cantidad)} ${unidad}` : '-';

    const filasProductos = o.detalleProductos.map(d => {
        const producto = productoProduccionPorNombre(d.nombre_producto);
        const st = producto ? subtipoProducto(producto.id_subtipo_producto) : null;
        const unidad = (unidadProductoProduccion(d.nombre_producto).match(/\(([^)]+)\)/) || [, 'kg'])[1].toLowerCase();
        return `
        <tr class="border-b border-slate-100">
            <td class="py-2">${d.nombre_producto}</td>
            <td class="py-2 pr-4 text-slate-500">${st ? st.tipo : '-'}</td>
            <td class="py-2 pr-4 text-slate-500">${st ? st.subtipo : '-'}</td>
            <td class="py-2 text-center">${conUnidad(d.cantidad_planificada, unidad)}</td>
            <td class="py-2 text-center">${conUnidad(d.cantidad_real, unidad)}</td>
            <td class="py-2 text-center">${d.numero_lote_definitivo || d.numero_lote_proyectado || '-'}</td>
            <td class="py-2 text-right">${formatearFechaLatina(d.fecha_vencimiento)}</td>
        </tr>`;
    }).join('');

    const filasMateriaPrima = o.detalleMateriaPrima.map(d => {
        const unidad = unidadMP(d);
        return `
        <tr class="border-b border-slate-100">
            <td class="py-2">${d.nombre}</td>
            <td class="py-2 text-center">${conUnidad(d.cantidad_planificada, unidad)}</td>
            <td class="py-2 text-right">${conUnidad(d.cantidad_real, unidad)}</td>
        </tr>`;
    }).join('');

    const campoProduccion = (etiqueta, valor) => `
        <div>
            <p class="text-[11px] text-slate-500">${etiqueta}</p>
            <p class="text-sm font-semibold text-slate-800">${valor}</p>
        </div>`;

    const acciones = document.getElementById('detalle-orden-acciones');
    if (acciones) {
        acciones.innerHTML = o.estado === 'En Proceso' ? `
            <button type="button" onclick="abrirModalCierreOrden(${o.id_orden_produccion})" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2 shadow-sm transition">
                <i data-lucide="check-check" class="w-4 h-4"></i><span>Cerrar Orden de Producción</span>
            </button>` : '';
    }

    cont.innerHTML = `
        <div class="grid grid-cols-[1fr_auto_1fr] gap-4 items-start border-b border-slate-200 pb-4">
            <div class="text-xs text-slate-600 space-y-0.5">
                <p class="text-sm font-bold text-slate-900">${DATOS_EMPRESA.razonSocial}</p>
                <p>${DATOS_EMPRESA.domicilioComercial}</p>
                <p>Condición frente al IVA: ${DATOS_EMPRESA.condicionIva}</p>
                <p>CUIT: ${DATOS_EMPRESA.cuit}</p>
                <p>Fecha de Inicio de Actividades: ${DATOS_EMPRESA.fechaInicioActividades}</p>
            </div>
            <div class="text-center border border-slate-300 rounded-md px-4 py-1">
                <p class="text-2xl font-bold text-slate-800 leading-none">OP</p>
                <p class="text-[10px] text-slate-500">Orden de Producción</p>
            </div>
            <div class="text-xs text-slate-600 text-right space-y-0.5">
                <p class="text-sm font-bold text-slate-900">${formatearIdentificador("OP", o.id_orden_produccion)}</p>
                <p>Fecha Emisión: ${formatearFechaLatina(o.fecha_emision)}</p>
                <p>Hora de Emisión: ${o.hora_emision || '-'}</p>
                <p>Responsable: ${o.id_empleado}</p>
            </div>
        </div>

        <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs">
            <h3 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><i data-lucide="factory" class="w-3.5 h-3.5"></i>Producción <span class="text-xs px-2.5 py-0.5 rounded-full font-semibold normal-case tracking-normal ${COLOR_ESTADO_ORDEN_PRODUCCION[o.estado]}">${o.estado}</span></h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                <div class="col-span-2 sm:col-span-3 md:col-span-5">${campoProduccion('Receta', textoRecetaOrden(o))}</div>
                ${campoProduccion('Fecha de Inicio', formatearFechaLatina(o.fecha_inicio))}
                ${campoProduccion('Hora de Inicio', o.hora_inicio || '-')}
                ${campoProduccion('Fecha de Fin', formatearFechaLatina(o.fecha_fin))}
                ${campoProduccion('Hora de Fin', o.hora_fin || '-')}
                ${campoProduccion('Fecha de Vencimiento', formatearFechaLatina(o.fecha_vencimiento))}
            </div>
        </div>

        <div class="space-y-2">
            <h4 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Detalle de Productos</h4>
            <table class="w-full text-xs text-left">
                <thead class="border-b border-slate-300 uppercase text-slate-500">
                    <tr><th class="py-2">Producto</th><th class="py-2 pr-4">Tipo</th><th class="py-2 pr-4">Subtipo</th><th class="py-2 text-center">Cant. Planificada</th><th class="py-2 text-center">Cant. Real</th><th class="py-2 text-center">N° Lote</th><th class="py-2 text-right">Fecha de Vencimiento</th></tr>
                </thead>
                <tbody>${filasProductos}</tbody>
            </table>
        </div>

        <div class="space-y-2">
            <h4 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Detalle de Materia Prima</h4>
            <table class="w-full text-xs text-left">
                <thead class="border-b border-slate-300 uppercase text-slate-500">
                    <tr><th class="py-2">Materia Prima</th><th class="py-2 text-center">Cant. Planificada</th><th class="py-2 text-right">Cant. Real</th></tr>
                </thead>
                <tbody>${filasMateriaPrima}</tbody>
            </table>
        </div>

        <div class="border-t border-slate-200 pt-4">
            <p class="text-xs text-slate-500"><b class="text-slate-700">Observaciones:</b> ${o.observaciones || '-'}</p>
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

    let html = `
        <div class="space-y-5 text-xs">
            <p class="text-slate-500">Confirme los valores reales consumidos y producidos para cerrar la orden ${formatearIdentificador("OP", orden.id_orden_produccion)}:</p>

            <!-- 1. Productos -->
            <div class="space-y-2">
                <h5 class="font-bold text-slate-700 uppercase">1. Producción Real Obtenida</h5>
                ${orden.detalleProductos.map((p, idx) => `
                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                        <p class="font-bold text-slate-800">${p.nombre_producto}</p>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[10px] text-slate-500">Cant. Real (kg)</label>
                                <input type="number" id="cierre-prod-cant-${idx}" value="${p.cantidad_planificada}" class="w-full border border-slate-300 rounded p-1">
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
                            <span class="text-slate-500">${unidadMP(mp)}</span>
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
        p.fecha_vencimiento = document.getElementById(`cierre-prod-venc-${idx}`)?.value;
        if (!primeraFechaVenc) primeraFechaVenc = p.fecha_vencimiento;
    });

    orden.fecha_vencimiento = primeraFechaVenc;

    // Al iniciar ya se descontó lo planificado: acá solo se ajusta la diferencia con lo realmente utilizado.
    orden.detalleMateriaPrima.forEach((d, idx) => {
        const cantReal = parseFloat(document.getElementById(`cierre-mp-cant-${idx}`)?.value) || d.cantidad_planificada;
        const diferencia = cantReal - d.cantidad_planificada;
        d.cantidad_real = cantReal;
        const mp = materiaPrimaDeItem(d);
        if (diferencia !== 0 && mp) mp.stock_actual = +(mp.stock_actual - diferencia).toFixed(3);
    });

    // Lo producido entra al stock de productos terminados.
    moverStockProductos(orden.detalleProductos.map(p => ({ nombre: p.nombre_producto, cantidad: p.cantidad_real })), +1);

    orden.estado = 'Finalizada';
    guardarDatos();

    cerrarModalCierreOrden();
    renderizarHistorialProduccion();
    renderizarStatsProduccion();
    if (ordenDetalleActualId) renderizarDetalleOrdenProduccion();
    alert(`Orden ${formatearIdentificador("OP", orden.id_orden_produccion)} finalizada y cerrada exitosamente.`);
}

function cerrarModalCierreOrden() {
    document.getElementById('modal-cierre-orden')?.classList.add('hidden');
    ordenEnCierreId = null;
}

// ==========================================
// MAQUINARIA (trasladado desde Mantenimiento: el catálogo de equipos vive en Producción;
// la vista "Historial por Máquina" sigue cruzando con listaOrdenesMantenimiento, que es global).
// ==========================================
let ordenListadoMaquinaria = { campo: '', direccion: '' };
let filtroEstadoMaquinariaListado = '';
let maquinariaEnEdicionId = null;

function ordenarListadoMaquinaria(campo) {
    ordenListadoMaquinaria.direccion = ordenListadoMaquinaria.campo === campo && ordenListadoMaquinaria.direccion === 'asc' ? 'desc' : 'asc';
    ordenListadoMaquinaria.campo = campo;
    renderizarTablaMaquinaria();
}

function elegirFiltroEstadoMaquinaria(estado) {
    filtroEstadoMaquinariaListado = estado;
    document.getElementById('pop-maq-estado')?.classList.add('hidden');
    renderizarTablaMaquinaria();
}

function filtrarListadoMaquinaria() { renderizarTablaMaquinaria(); }

function irAMaquinaria() {
    if (window.location.hash !== '#maquinaria') window.location.hash = 'maquinaria';
    else irASubvistaDesdeHashProduccion();
}

function irARegistrarMaquinaria() {
    maquinariaEnEdicionId = null;
    if (window.location.hash !== '#registrar-maquinaria') window.location.hash = 'registrar-maquinaria';
    else irASubvistaDesdeHashProduccion();
}

function volverAMaquinaria() {
    irAMaquinaria();
}

function poblarSelectMarcaMaquinaria() {
    const select = document.getElementById('maq-marca');
    if (!select || typeof dbMarcas === 'undefined') return;
    select.innerHTML = dbMarcas.map(m => `<option value="${m.id_marca}">${m.nombre}</option>`).join('');
}

function resetFormularioMaquinaria() {
    maquinariaEnEdicionId = null;
    document.getElementById('maq-nombre').value = '';
    poblarSelectMarcaMaquinaria();
    document.getElementById('maq-modelo').value = '';
    document.getElementById('maq-descripcion').value = '';
    document.getElementById('maq-fecha-adquisicion').value = '';
    document.getElementById('maq-unidad-tiempo').value = 'Horas';
    document.getElementById('maq-estado').value = 'Operativa';
    document.getElementById('titulo-registrar-maquinaria').innerText = 'Registrar Maquinaria';
}

function renderizarTablaMaquinaria() {
    const tbody = document.getElementById('tabla-maquinaria');
    if (!tbody) return;

    tbody.innerHTML = '';
    renderizarStatsMaquinaria();
    if (typeof listaMaquinaria === 'undefined' || !listaMaquinaria.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-slate-400">No hay maquinarias registradas.</td></tr>`;
        return;
    }

    const estadoSeleccionado = filtroEstadoMaquinariaListado;
    const filtrosColumna = {
        numero: normalizarTexto(document.getElementById('buscar-maq-numero')?.value || '').trim(),
        nombre: normalizarTexto(document.getElementById('buscar-maq-nombre')?.value || '').trim(),
        marca: normalizarTexto(document.getElementById('buscar-maq-marca')?.value || '').trim(),
        modelo: normalizarTexto(document.getElementById('buscar-maq-modelo')?.value || '').trim()
    };
    const fechaAdquisicion = document.getElementById('buscar-maq-fecha')?.value || '';
    let maquinarias = listaMaquinaria.filter(m => (!filtrosColumna.numero || normalizarTexto(`${formatearIdentificador("MAQ", m.id_maquinaria)}`).includes(filtrosColumna.numero)) && (!filtrosColumna.nombre || normalizarTexto(m.nombre).includes(filtrosColumna.nombre)) && (!filtrosColumna.marca || normalizarTexto(nombreMarca(m.id_marca)).includes(filtrosColumna.marca)) && (!filtrosColumna.modelo || normalizarTexto(m.modelo).includes(filtrosColumna.modelo)) && (!fechaAdquisicion || m.fecha_adquisicion === fechaAdquisicion) && (!estadoSeleccionado || m.estado === estadoSeleccionado));
    if (['nombre', 'marca', 'modelo'].includes(ordenListadoMaquinaria.campo)) {
        const campo = ordenListadoMaquinaria.campo;
        maquinarias.sort((a, b) => {
            const va = campo === 'nombre' ? a.nombre : campo === 'marca' ? nombreMarca(a.id_marca) : a.modelo;
            const vb = campo === 'nombre' ? b.nombre : campo === 'marca' ? nombreMarca(b.id_marca) : b.modelo;
            const cmp = typeof va === 'number' ? va - vb : String(va || '').localeCompare(String(vb || ''), 'es');
            return ordenListadoMaquinaria.direccion === 'asc' ? cmp : -cmp;
        });
    }
    maquinarias.forEach(m => {
        const idx = listaMaquinaria.indexOf(m);
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 border-b border-slate-100';
        tr.innerHTML = `
            <td class="px-6 py-3 font-semibold text-slate-500">${formatearIdentificador("MAQ", String(m.id_maquinaria).padStart(4, '0'))}</td>
            <td class="px-6 py-3 font-semibold text-slate-800">${m.nombre}</td>
            <td class="px-6 py-3 text-slate-600">${nombreMarca(m.id_marca)}</td>
            <td class="px-6 py-3 text-slate-600">${m.modelo || '-'}</td>
            <td class="px-6 py-3 text-slate-500">${m.descripcion || '-'}</td>
            <td class="px-6 py-3 text-slate-500">${m.id_unidad_tiempo || '-'}</td>
            <td class="px-6 py-3 whitespace-nowrap text-slate-600">${formatearFechaLatina(m.fecha_adquisicion)}</td>
            <td class="px-6 py-3 text-center">
                <span class="text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${m.estado === 'Operativa' ? 'bg-emerald-100 text-emerald-800' : m.estado === 'En reparación' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}">${m.estado || 'Sin estado'}</span>
            </td>
            <td class="px-6 py-3 text-center whitespace-nowrap">
                <button type="button" onclick="editarMaquinaria(${idx})" title="Editar" class="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                <button type="button" onclick="verHistorialMaquina(${idx})" title="Ver historial de mantenimientos" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderizarStatsMaquinaria() {
    const maquinarias = typeof listaMaquinaria !== 'undefined' ? listaMaquinaria : [];
    const set = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };
    set('kpi-maquinaria-total', maquinarias.length);
    set('kpi-maquinaria-operativa', maquinarias.filter(m => m.estado === 'Operativa').length);
    set('kpi-maquinaria-reparacion', maquinarias.filter(m => m.estado === 'En reparación').length);
    set('kpi-maquinaria-fuera-servicio', maquinarias.filter(m => m.estado === 'Fuera de servicio').length);
}

function verHistorialMaquina(idx) {
    const maquina = listaMaquinaria[idx];
    if (!maquina) return;
    document.getElementById('historial-maquina-titulo').innerText = `Listado de Mantenimientos - ${maquina.nombre}`;
    const ordenes = listaOrdenesMantenimiento.filter(o => o.detalle && o.detalle.some(d => d.id_maquinaria === maquina.id_maquinaria));
    const tbody = document.getElementById('tabla-historial-maquina');

    if (!ordenes.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400">Esta máquina no tiene mantenimientos registrados.</td></tr>`;
    } else {
        let html = '';
        ordenes.forEach(o => {
            const detMaq = o.detalle.find(d => d.id_maquinaria === maquina.id_maquinaria);
            const fIni = o.fecha_inicio || o.fecha_emision || o.fecha || '2026-10-15';
            const fFin = o.fecha_fin || o.fecha_emision || o.fecha || '2026-10-15';
            const hIni = o.hora_inicio || o.hora_emision || '08:00';
            const hFin = o.hora_fin || '12:00';

            const periodoStr = `${formatearFechaLatina(fIni)} ${hIni} - ${formatearFechaLatina(fFin)} ${hFin}`;
            html += `
                <tr class="hover:bg-slate-50 border-b border-slate-100">
                    <td class="px-6 py-3 font-semibold text-slate-800 whitespace-nowrap">${formatearIdentificador("MANT", String(o.id_orden_mantenimiento).padStart(4, '0'))}</td>
                    <td class="px-6 py-3"><span class="text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap ${o.id_tipo_mantenimiento === 'Preventivo' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}">${o.id_tipo_mantenimiento}</span></td>
                    <td class="px-6 py-3 text-slate-600 whitespace-nowrap">${periodoStr}</td>
                    <td class="px-6 py-3 text-slate-600">${detMaq ? detMaq.tareas_realizadas : '-'}</td>
                    <td class="px-6 py-3 text-slate-600 whitespace-nowrap">${detMaq && detMaq.fecha_proximo_mantenimiento ? formatearFechaLatina(detMaq.fecha_proximo_mantenimiento) : '-'}</td>
                </tr>`;
        });
        tbody.innerHTML = html;
    }
    mostrarSubvistaProduccion('historial-maquina');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function volverDesdeHistorialMaquina() {
    irAMaquinaria();
}

function editarMaquinaria(idx) {
    const m = listaMaquinaria[idx];
    if (!m) return;
    maquinariaEnEdicionId = m.id_maquinaria;
    poblarSelectMarcaMaquinaria();
    document.getElementById('maq-nombre').value = m.nombre;
    document.getElementById('maq-marca').value = m.id_marca || '';
    document.getElementById('maq-modelo').value = m.modelo || '';
    document.getElementById('maq-descripcion').value = m.descripcion || '';
    document.getElementById('maq-fecha-adquisicion').value = m.fecha_adquisicion || '';
    document.getElementById('maq-unidad-tiempo').value = m.id_unidad_tiempo || 'Horas';
    document.getElementById('maq-estado').value = m.estado || 'Operativa';
    document.getElementById('titulo-registrar-maquinaria').innerText = `Editar ${formatearIdentificador("MAQ", String(m.id_maquinaria).padStart(4, '0'))}`;
    if (window.location.hash !== '#registrar-maquinaria') window.location.hash = 'registrar-maquinaria';
    else mostrarSubvistaProduccion('registrar-maquinaria');
}

function guardarMaquinaria() {
    const nombre = document.getElementById('maq-nombre').value.trim();
    const idMarca = parseInt(document.getElementById('maq-marca').value);
    const modelo = document.getElementById('maq-modelo').value.trim();
    const descripcion = document.getElementById('maq-descripcion').value.trim();
    const fechaAdquisicion = document.getElementById('maq-fecha-adquisicion').value;
    const unidadTiempo = document.getElementById('maq-unidad-tiempo').value;
    const estado = document.getElementById('maq-estado').value;

    if (!nombre) return alert('Ingrese el nombre de la máquina.');
    if (!idMarca) return alert('Seleccione la marca.');
    if (!modelo) return alert('Ingrese el modelo.');
    if (!fechaAdquisicion) return alert('Seleccione la fecha de adquisición.');
    if (!estado) return alert('Seleccione el estado de la maquinaria.');

    if (maquinariaEnEdicionId) {
        const m = listaMaquinaria.find(x => x.id_maquinaria === maquinariaEnEdicionId);
        Object.assign(m, { nombre, descripcion: descripcion || 'Sin descripción', fecha_adquisicion: fechaAdquisicion, id_unidad_tiempo: unidadTiempo, estado, id_marca: idMarca, modelo });
        guardarDatos();
        alert(`¡Máquina "${nombre}" actualizada con éxito!`);
    } else {
        const idNueva = numMaquinariaContador++;
        listaMaquinaria.push(new Maquinaria(idNueva, nombre, descripcion || 'Sin descripción', fechaAdquisicion, unidadTiempo, estado, idMarca, modelo));
        guardarDatos();
        alert(`¡Máquina "${nombre}" registrada con éxito!`);
    }
    irAMaquinaria();
}

// ==========================================
// PRODUCTOS (catálogo propio de Producción, independiente del catálogo que usa Ventas para vender)
// ==========================================
let ordenListadoProductos = { campo: '', direccion: '' };
let filtroSubtipoProductoListado = '';
let filtroEstadoProductoListado = '';
let productoEnEdicionId = null;

function irAProductos() {
    if (window.location.hash !== '#productos') window.location.hash = 'productos';
    else irASubvistaDesdeHashProduccion();
}
function irARegistrarProducto() {
    productoEnEdicionId = null;
    if (window.location.hash !== '#registrar-producto') window.location.hash = 'registrar-producto';
    else irASubvistaDesdeHashProduccion();
}
function volverAProductos() {
    irAProductos();
}

function ordenarListadoProductos(campo) {
    ordenListadoProductos.direccion = ordenListadoProductos.campo === campo && ordenListadoProductos.direccion === 'asc' ? 'desc' : 'asc';
    ordenListadoProductos.campo = campo;
    renderizarTablaProductos();
}

function elegirFiltroEstadoProducto(valor) {
    filtroEstadoProductoListado = valor;
    document.getElementById('pop-productos-estado')?.classList.add('hidden');
    renderizarTablaProductos();
}

function elegirFiltroSubtipoProducto(id) {
    filtroSubtipoProductoListado = id;
    document.getElementById('pop-productos-subtipo')?.classList.add('hidden');
    renderizarTablaProductos();
}

function poblarPopoverSubtipoProducto() {
    const cont = document.getElementById('pop-productos-subtipo');
    if (!cont || cont.children.length) return;
    cont.innerHTML = `<button type="button" onclick="elegirFiltroSubtipoProducto('')" class="block w-full text-left px-2 py-1 text-xs hover:bg-slate-100">Todos</button>` +
        dbSubtiposProducto.map(s => `<button type="button" onclick="elegirFiltroSubtipoProducto(${s.id_subtipo_producto})" class="block w-full text-left px-2 py-1 text-xs hover:bg-slate-100">${s.tipo} - ${s.subtipo}</button>`).join('');
}

function resetFormularioProducto() {
    productoEnEdicionId = null;
    document.getElementById('prodn-nombre').value = '';
    poblarSelectTipoProducto('prodn-tipo');
    poblarSelectSubtipoProductoCascada('prodn-tipo', 'prodn-subtipo');
    poblarSelectUnidadMedida('prodn-unidad');
    document.getElementById('prodn-precio').value = '';
    document.getElementById('prodn-estado').value = 'true';
    document.getElementById('prodn-stock-actual').value = 0;
    document.getElementById('prodn-stock-minimo').value = 0;
    document.getElementById('prodn-descripcion').value = '';
    document.getElementById('titulo-registrar-producto').innerText = 'Registrar Producto';
}

function renderizarTablaProductos() {
    const tbody = document.getElementById('tabla-productos');
    if (!tbody) return;
    poblarPopoverSubtipoProducto();

    const set = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };
    set('kpi-productos-total', listaProductos.length);
    set('kpi-productos-activos', listaProductos.filter(p => p.estado_activo).length);
    set('kpi-productos-inactivos', listaProductos.filter(p => !p.estado_activo).length);
    set('kpi-productos-stock-bajo', listaProductos.filter(p => p.stock_actual <= p.stock_minimo).length);

    const terminoNumero = normalizarTexto(document.getElementById('buscar-productos-numero')?.value || '').trim();
    const terminoNombre = normalizarTexto(document.getElementById('buscar-productos-nombre')?.value || '').trim();

    let productos = listaProductos.filter(p => {
        return (!terminoNumero || String(p.id_producto).includes(terminoNumero)) &&
            (!terminoNombre || normalizarTexto(p.nombre).includes(terminoNombre)) &&
            (!filtroSubtipoProductoListado || p.id_subtipo_producto === filtroSubtipoProductoListado) &&
            (!filtroEstadoProductoListado || (filtroEstadoProductoListado === 'activo' ? p.estado_activo : !p.estado_activo));
    });

    if (ordenListadoProductos.campo) {
        const campo = ordenListadoProductos.campo;
        productos.sort((a, b) => {
            const va = a[campo], vb = b[campo];
            const cmp = typeof va === 'number' ? va - vb : String(va || '').localeCompare(String(vb || ''), 'es');
            return ordenListadoProductos.direccion === 'asc' ? cmp : -cmp;
        });
    }

    if (!productos.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-slate-400">No se encontraron productos con ese criterio.</td></tr>`;
    } else {
        tbody.innerHTML = productos.map(p => {
            const st = subtipoProducto(p.id_subtipo_producto);
            const idx = listaProductos.indexOf(p);
            return `
            <tr class="hover:bg-slate-50 border-b border-slate-100">
                <td class="px-6 py-3 font-semibold text-slate-500">${formatearIdentificador("PROD", String(p.id_producto).padStart(4, '0'))}</td>
                <td class="px-6 py-3 font-semibold text-slate-800">${p.nombre}</td>
                <td class="px-6 py-3 text-slate-600">${st ? `${st.tipo} - ${st.subtipo}` : '-'}</td>
                <td class="px-6 py-3 text-slate-500">${nombreUnidadMedida(p.id_unidad_medida)}</td>
                <td class="px-6 py-3 text-right whitespace-nowrap">$ ${p.precio_unitario.toLocaleString()}</td>
                <td class="px-6 py-3 text-right ${p.stock_actual <= p.stock_minimo ? 'text-red-600 font-semibold' : 'text-slate-700'}">${p.stock_actual}</td>
                <td class="px-6 py-3 text-right text-slate-500">${p.stock_minimo}</td>
                <td class="px-6 py-3 text-center"><span class="text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${p.estado_activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">${p.estado_activo ? 'Activo' : 'Inactivo'}</span></td>
                <td class="px-6 py-3 text-center whitespace-nowrap">
                    <button type="button" onclick="verProducto(${idx})" title="Ver producto" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    <button type="button" onclick="editarProducto(${idx})" title="Editar" class="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                </td>
            </tr>`;
        }).join('');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Modal de solo lectura compartido por Productos y Materias Primas.
const campoVerRegistro = (etiqueta, valor) => `<div><p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">${etiqueta}</p><p class="text-sm text-slate-800">${valor}</p></div>`;
const stockConAviso = (actual, minimo) => actual <= minimo
    ? `<span class="text-red-600 font-semibold">${actual}</span> <span class="text-xs text-red-500">(stock bajo)</span>`
    : actual;

function abrirModalVerRegistro(icono, titulo, nombre, activo, textoEstado, campos, pie = '') {
    document.getElementById('modal-ver-registro-icono').innerHTML = `<i data-lucide="${icono}" class="w-5 h-5"></i>`;
    document.getElementById('modal-ver-registro-titulo').innerText = titulo;
    document.getElementById('modal-ver-registro-contenido').innerHTML = `
        <div class="flex items-center justify-between">
            <h4 class="text-lg font-bold text-slate-900">${nombre}</h4>
            <span class="text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">${textoEstado}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${campos.map(([etiqueta, valor]) => campoVerRegistro(etiqueta, valor)).join('')}</div>
        ${pie}`;
    document.getElementById('modal-ver-registro').classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function cerrarModalVerRegistro() {
    document.getElementById('modal-ver-registro').classList.add('hidden');
}

function verProducto(idx) {
    const p = listaProductos[idx];
    if (!p) return;
    const st = subtipoProducto(p.id_subtipo_producto);
    abrirModalVerRegistro('package', `Producto ${formatearIdentificador("PROD", String(p.id_producto).padStart(4, '0'))}`, p.nombre,
        p.estado_activo, p.estado_activo ? 'Activo' : 'Inactivo',
        [
            ['Tipo', st ? st.tipo : '-'],
            ['Subtipo', st ? st.subtipo : '-'],
            ['Unidad de Medida', nombreUnidadMedida(p.id_unidad_medida)],
            ['Precio Unitario', `$ ${p.precio_unitario.toLocaleString()}`],
            ['Stock Actual', stockConAviso(p.stock_actual, p.stock_minimo)],
            ['Stock Mínimo', p.stock_minimo]
        ],
        campoVerRegistro('Descripción', p.descripcion || '-'));
}

// "+" al lado de Tipo y Subtipo: abre el alta de la tabla del sistema y deja elegida la fila nueva.
function altaRapidaTipoProducto() {
    abrirAltaParametrica('tiposProducto', tipo => {
        poblarSelectTipoProducto('prodn-tipo');
        document.getElementById('prodn-tipo').value = tipo.nombre_tipo_producto;
        poblarSelectSubtipoProductoCascada('prodn-tipo', 'prodn-subtipo');
    });
}

function altaRapidaSubtipoProducto() {
    abrirAltaParametrica('subtiposProducto', subtipo => {
        poblarSelectTipoProducto('prodn-tipo');
        document.getElementById('prodn-tipo').value = subtipo.tipo;
        poblarSelectSubtipoProductoCascada('prodn-tipo', 'prodn-subtipo');
        document.getElementById('prodn-subtipo').value = subtipo.id_subtipo_producto;
    });
    // Propone el tipo que ya estaba elegido en el formulario del producto.
    const tipo = dbTiposProducto.find(t => t.nombre_tipo_producto === document.getElementById('prodn-tipo').value);
    if (tipo) document.getElementById('param-id_tipo_producto').value = tipo.id_tipo_producto;
}

function editarProducto(idx) {
    const p = listaProductos[idx];
    if (!p) return;
    productoEnEdicionId = p.id_producto;
    const st = subtipoProducto(p.id_subtipo_producto);
    poblarSelectTipoProducto('prodn-tipo');
    if (st) document.getElementById('prodn-tipo').value = st.tipo;
    poblarSelectSubtipoProductoCascada('prodn-tipo', 'prodn-subtipo');
    poblarSelectUnidadMedida('prodn-unidad');
    document.getElementById('prodn-nombre').value = p.nombre;
    document.getElementById('prodn-subtipo').value = p.id_subtipo_producto;
    document.getElementById('prodn-unidad').value = p.id_unidad_medida;
    document.getElementById('prodn-precio').value = p.precio_unitario;
    document.getElementById('prodn-estado').value = String(p.estado_activo);
    document.getElementById('prodn-stock-actual').value = p.stock_actual;
    document.getElementById('prodn-stock-minimo').value = p.stock_minimo;
    document.getElementById('prodn-descripcion').value = p.descripcion || '';
    document.getElementById('titulo-registrar-producto').innerText = `Editar ${formatearIdentificador("PROD", String(p.id_producto).padStart(4, '0'))}`;
    if (window.location.hash !== '#registrar-producto') window.location.hash = 'registrar-producto';
    else mostrarSubvistaProduccion('registrar-producto');
}

function guardarProducto() {
    const nombre = document.getElementById('prodn-nombre').value.trim();
    const idSubtipo = parseInt(document.getElementById('prodn-subtipo').value);
    const idUnidad = parseInt(document.getElementById('prodn-unidad').value);
    const precio = parseFloat(document.getElementById('prodn-precio').value);
    const estadoActivo = document.getElementById('prodn-estado').value === 'true';
    const stockActual = parseFloat(document.getElementById('prodn-stock-actual').value) || 0;
    const stockMinimo = parseFloat(document.getElementById('prodn-stock-minimo').value) || 0;
    const descripcion = document.getElementById('prodn-descripcion').value.trim();

    if (!nombre) return alert('Ingrese el nombre del producto.');
    if (!idSubtipo) return alert('Seleccione el tipo/subtipo.');
    if (!idUnidad) return alert('Seleccione la unidad de medida.');
    if (!precio || precio <= 0) return alert('Ingrese un precio unitario válido.');

    if (productoEnEdicionId) {
        const p = listaProductos.find(x => x.id_producto === productoEnEdicionId);
        Object.assign(p, { nombre, id_subtipo_producto: idSubtipo, id_unidad_medida: idUnidad, precio_unitario: precio, estado_activo: estadoActivo, stock_actual: stockActual, stock_minimo: stockMinimo, descripcion });
        guardarDatos();
        alert(`¡Producto "${nombre}" actualizado con éxito!`);
    } else {
        const idNuevo = numProductoContador++;
        listaProductos.push(new Producto(idNuevo, idSubtipo, idUnidad, nombre, descripcion, precio, stockActual, stockMinimo, estadoActivo));
        guardarDatos();
        alert(`¡Producto "${nombre}" registrado con éxito!`);
    }
    volverAProductos();
}

// ==========================================
// RECETAS (Receta + detalle de ingredientes). Las Órdenes de Producción eligen sus productos entre las
// recetas activas y calculan la MP necesaria con cantidad_por_kg de cada ingrediente.
// ==========================================
let ordenListadoRecetas = { campo: '', direccion: '' };
let filtroEstadoRecetaListado = '';
let recetaEnEdicionId = null;
let ingredientesRecetaActual = []; // Detalle_Receta en edición: [{ id_materia_prima, id_unidad_medida, cantidad }]

function irARecetas() {
    if (window.location.hash !== '#recetas') window.location.hash = 'recetas';
    else irASubvistaDesdeHashProduccion();
}
function irARegistrarReceta() {
    recetaEnEdicionId = null;
    if (window.location.hash !== '#registrar-receta') window.location.hash = 'registrar-receta';
    else irASubvistaDesdeHashProduccion();
}
function volverARecetas() {
    recetaEnEdicionId = null;
    irARecetas();
}

function ordenarListadoRecetas(campo) {
    ordenListadoRecetas.direccion = ordenListadoRecetas.campo === campo && ordenListadoRecetas.direccion === 'asc' ? 'desc' : 'asc';
    ordenListadoRecetas.campo = campo;
    renderizarTablaRecetas();
}

function elegirFiltroEstadoReceta(valor) {
    filtroEstadoRecetaListado = valor;
    document.getElementById('pop-recetas-estado')?.classList.add('hidden');
    renderizarTablaRecetas();
}

const unidadProductoDeReceta = r => {
    const p = listaProductos.find(x => x.id_producto === r.id_producto);
    return p ? abreviaturaUnidadMedida(p.id_unidad_medida) : 'kg';
};

function renderizarTablaRecetas() {
    const tbody = document.getElementById('tabla-recetas');
    if (!tbody) return;

    const set = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };
    set('kpi-recetas-total', listaRecetas.length);
    set('kpi-recetas-activas', listaRecetas.filter(r => r.estado_activa).length);
    set('kpi-recetas-inactivas', listaRecetas.filter(r => !r.estado_activa).length);
    set('kpi-recetas-por-vencer', listaRecetas.filter(r => r.estado_activa && r.fecha_vencimiento && diasHasta(r.fecha_vencimiento) <= 15 && diasHasta(r.fecha_vencimiento) >= 0).length);

    const terminoNumero = normalizarTexto(document.getElementById('buscar-recetas-numero')?.value || '').trim();
    const terminoNombre = normalizarTexto(document.getElementById('buscar-recetas-nombre')?.value || '').trim();
    const terminoProducto = normalizarTexto(document.getElementById('buscar-recetas-producto')?.value || '').trim();

    const recetas = listaRecetas.filter(r =>
        (!terminoNumero || String(r.id_receta).includes(terminoNumero)) &&
        (!terminoNombre || normalizarTexto(r.nombre_receta).includes(terminoNombre)) &&
        (!terminoProducto || normalizarTexto(r.nombre_producto).includes(terminoProducto)) &&
        (!filtroEstadoRecetaListado || (filtroEstadoRecetaListado === 'activa' ? r.estado_activa : !r.estado_activa)));

    if (ordenListadoRecetas.campo) {
        const campo = ordenListadoRecetas.campo;
        recetas.sort((a, b) => {
            const va = a[campo], vb = b[campo];
            const cmp = typeof va === 'number' ? va - vb : String(va || '').localeCompare(String(vb || ''), 'es');
            return ordenListadoRecetas.direccion === 'asc' ? cmp : -cmp;
        });
    }

    if (!recetas.length) {
        tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-400">No se encontraron recetas con ese criterio.</td></tr>`;
    } else {
        tbody.innerHTML = recetas.map(r => {
            const idx = listaRecetas.indexOf(r);
            const vencidaOPorVencer = r.fecha_vencimiento && diasHasta(r.fecha_vencimiento) <= 15;
            return `
            <tr class="hover:bg-slate-50 border-b border-slate-100">
                <td class="px-6 py-3 font-semibold text-slate-500 whitespace-nowrap">${formatearIdentificador("REC", String(r.id_receta).padStart(4, '0'))}</td>
                <td class="px-6 py-3 font-semibold text-slate-800">${r.nombre_receta}</td>
                <td class="px-6 py-3 text-slate-600">${r.nombre_producto || '-'}</td>
                <td class="px-6 py-3 text-center text-slate-600">v${r.version}</td>
                <td class="px-6 py-3 text-right text-slate-600 whitespace-nowrap">${formatearCantidad(r.cantidad_a_producir)} ${unidadProductoDeReceta(r)}</td>
                <td class="px-6 py-3 text-right text-slate-600 whitespace-nowrap">${formatearCantidad(r.rendimiento_kg)}</td>
                <td class="px-6 py-3 text-center"><button type="button" onclick="verReceta(${idx})" title="Ver detalle de materias primas" class="text-slate-600 hover:text-red-600 underline decoration-dotted underline-offset-2">${r.detalle.length}</button></td>
                <td class="px-6 py-3 whitespace-nowrap ${vencidaOPorVencer && r.estado_activa ? 'text-amber-600 font-semibold' : 'text-slate-500'}">${formatearFechaLatina(r.fecha_vencimiento)}</td>
                <td class="px-6 py-3 text-center"><span class="text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${r.estado_activa ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">${r.estado_activa ? 'Activa' : 'Inactiva'}</span></td>
                <td class="px-6 py-3 text-center whitespace-nowrap">
                    <button type="button" onclick="verReceta(${idx})" title="Ver receta" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    <button type="button" onclick="editarReceta(${idx})" title="Editar" class="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                </td>
            </tr>`;
        }).join('');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ---------- Formulario Registrar / Editar Receta ----------
function poblarSelectProductoReceta(idSeleccionado) {
    const select = document.getElementById('rec-producto');
    select.innerHTML = `<option value="" disabled ${idSeleccionado ? '' : 'selected'}>Elegí un producto</option>` +
        listaProductos.filter(p => p.estado_activo || p.id_producto === idSeleccionado)
            .map(p => `<option value="${p.id_producto}" ${p.id_producto === idSeleccionado ? 'selected' : ''}>${p.nombre}</option>`).join('');
    actualizarUnidadProductoReceta();
}

function actualizarUnidadProductoReceta() {
    const p = listaProductos.find(x => x.id_producto === parseInt(document.getElementById('rec-producto').value));
    document.getElementById('rec-unidad-producto').textContent = p ? `(${abreviaturaUnidadMedida(p.id_unidad_medida)})` : '';
}

function poblarSelectMateriaPrimaReceta() {
    const select = document.getElementById('rec-ing-mp');
    select.innerHTML = `<option value="" disabled selected>Elegí una materia prima</option>` +
        listaMateriasPrimas.filter(m => m.estado_activa)
            .map(m => `<option value="${m.id_materia_prima}">${m.nombre_materia_prima} (${nombreTipoMateriaPrima(m.id_tipo_materia_prima)} · ${nombreMarca(m.id_marca)})</option>`).join('');
    actualizarUnidadIngredienteReceta();
}

// Detalle_Receta.id_unidad_medida: por defecto, la unidad en la que se lleva el stock de esa materia prima.
function actualizarUnidadIngredienteReceta() {
    const mp = listaMateriasPrimas.find(m => m.id_materia_prima === parseInt(document.getElementById('rec-ing-mp').value));
    poblarSelectUnidadMedida('rec-ing-unidad-medida');
    if (mp) document.getElementById('rec-ing-unidad-medida').value = mp.id_unidad_medida;
}

function resetFormularioReceta() {
    recetaEnEdicionId = null;
    ingredientesRecetaActual = [];
    document.getElementById('titulo-registrar-receta').innerText = 'Registrar Receta';
    document.getElementById('rec-nombre').value = '';
    document.getElementById('rec-version').value = 1;
    poblarSelectProductoReceta(null);
    document.getElementById('rec-estado').value = 'true';
    document.getElementById('rec-cantidad-a-producir').value = '';
    document.getElementById('rec-rendimiento').value = '';
    document.getElementById('rec-vencimiento').value = '';
    document.getElementById('rec-procedimiento').value = '';
    poblarSelectMateriaPrimaReceta();
    document.getElementById('rec-ing-cant').value = '';
    renderizarTablaIngredientesReceta();
}

function agregarIngredienteReceta() {
    const idMp = parseInt(document.getElementById('rec-ing-mp').value);
    const cantidad = parseFloat(document.getElementById('rec-ing-cant').value);
    const idUnidad = parseInt(document.getElementById('rec-ing-unidad-medida').value);
    if (!idMp) return alert('Elegí una materia prima.');
    if (!cantidad || cantidad <= 0) return alert('Ingresá una cantidad válida.');
    if (!idUnidad) return alert('Elegí la unidad de medida.');

    // Clave (id_receta, id_materia_prima): si la materia prima ya está en la receta se suma a esa misma línea.
    const existente = ingredientesRecetaActual.find(i => i.id_materia_prima === idMp);
    if (existente && existente.id_unidad_medida !== idUnidad) {
        return alert(`Esa materia prima ya está en la receta en ${nombreUnidadMedida(existente.id_unidad_medida)}. Modificá la cantidad en la tabla.`);
    }
    if (existente) existente.cantidad = +(existente.cantidad + cantidad).toFixed(3);
    else ingredientesRecetaActual.push({ id_materia_prima: idMp, id_unidad_medida: idUnidad, cantidad });

    document.getElementById('rec-ing-cant').value = '';
    renderizarTablaIngredientesReceta();
}

function actualizarCantidadIngredienteReceta(idMp, valor) {
    const item = ingredientesRecetaActual.find(i => i.id_materia_prima === idMp);
    const cantidad = parseFloat(valor);
    if (item && cantidad > 0) item.cantidad = cantidad;
    renderizarTablaIngredientesReceta();
}

function eliminarIngredienteReceta(idMp) {
    ingredientesRecetaActual = ingredientesRecetaActual.filter(i => i.id_materia_prima !== idMp);
    renderizarTablaIngredientesReceta();
}

function renderizarTablaIngredientesReceta() {
    const tbody = document.getElementById('tabla-ingredientes-receta');
    if (!ingredientesRecetaActual.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 text-xs">Todavía no agregó ingredientes a la receta.</td></tr>`;
        return;
    }
    tbody.innerHTML = ingredientesRecetaActual.map(i => {
        const mp = listaMateriasPrimas.find(m => m.id_materia_prima === i.id_materia_prima);
        return `
        <tr>
            <td class="p-3 font-medium text-slate-800">${mp ? mp.nombre_materia_prima : '-'}</td>
            <td class="p-3 text-center"><input type="number" min="0" step="any" value="${i.cantidad}" onchange="actualizarCantidadIngredienteReceta(${i.id_materia_prima}, this.value)" class="w-24 text-center border border-slate-300 rounded-md p-1 text-sm outline-none focus:ring-2 focus:ring-red-500"></td>
            <td class="p-3 text-center text-slate-500">${nombreUnidadMedida(i.id_unidad_medida)}</td>
            <td class="p-3 text-center"><button type="button" onclick="eliminarIngredienteReceta(${i.id_materia_prima})" class="text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-4 h-4 inline"></i></button></td>
        </tr>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function editarReceta(idx) {
    const r = listaRecetas[idx];
    if (!r) return;
    resetFormularioReceta();
    recetaEnEdicionId = r.id_receta;
    document.getElementById('titulo-registrar-receta').innerText = `Editar ${formatearIdentificador("REC", String(r.id_receta).padStart(4, '0'))}`;
    document.getElementById('rec-nombre').value = r.nombre_receta;
    document.getElementById('rec-version').value = r.version;
    poblarSelectProductoReceta(r.id_producto);
    document.getElementById('rec-estado').value = String(r.estado_activa);
    document.getElementById('rec-cantidad-a-producir').value = r.cantidad_a_producir;
    document.getElementById('rec-rendimiento').value = r.rendimiento_kg;
    document.getElementById('rec-vencimiento').value = r.fecha_vencimiento || '';
    document.getElementById('rec-procedimiento').value = r.procedimiento;
    ingredientesRecetaActual = r.detalle.map(d => ({ id_materia_prima: d.id_materia_prima, id_unidad_medida: d.id_unidad_medida, cantidad: d.cantidad }));
    renderizarTablaIngredientesReceta();
    if (window.location.hash !== '#registrar-receta') window.location.hash = 'registrar-receta';
    else mostrarSubvistaProduccion('registrar-receta');
}

function guardarReceta() {
    const nombre = document.getElementById('rec-nombre').value.trim();
    const version = parseInt(document.getElementById('rec-version').value);
    const idProducto = parseInt(document.getElementById('rec-producto').value);
    const estadoActiva = document.getElementById('rec-estado').value === 'true';
    const cantidadAProducir = parseFloat(document.getElementById('rec-cantidad-a-producir').value);
    const rendimiento = parseFloat(document.getElementById('rec-rendimiento').value);
    const fechaVencimiento = document.getElementById('rec-vencimiento').value || null;
    const procedimiento = document.getElementById('rec-procedimiento').value.trim();

    if (!nombre) return alert('Ingrese el nombre de la receta.');
    if (!version || version < 1) return alert('Ingrese una versión válida (1 o mayor).');
    if (!idProducto) return alert('Seleccione el producto que elabora la receta.');
    if (!cantidadAProducir || cantidadAProducir <= 0) return alert('Ingrese la cantidad a producir.');
    if (!rendimiento || rendimiento <= 0) return alert('Ingrese el rendimiento en kg.');
    if (!procedimiento) return alert('Describa el procedimiento de la receta.');
    if (!ingredientesRecetaActual.length) return alert('Agregue al menos un ingrediente.');
    if (listaRecetas.some(r => r.id_receta !== recetaEnEdicionId && normalizarTexto(r.nombre_receta) === normalizarTexto(nombre) && r.version === version)) {
        return alert(`Ya existe la versión ${version} de "${nombre}". Usá otro número de versión.`);
    }

    const producto = listaProductos.find(p => p.id_producto === idProducto);
    let receta;
    if (recetaEnEdicionId) {
        receta = listaRecetas.find(x => x.id_receta === recetaEnEdicionId);
        Object.assign(receta, { id_producto: idProducto, nombre_receta: nombre, nombre_producto: producto.nombre, cantidad_a_producir: cantidadAProducir, version, estado_activa: estadoActiva, procedimiento, rendimiento_kg: rendimiento, fecha_vencimiento: fechaVencimiento });
    } else {
        receta = new Receta(numRecetaContador++, idProducto, nombre, producto.nombre, cantidadAProducir, version, estadoActiva, procedimiento, rendimiento, fechaVencimiento);
        listaRecetas.push(receta);
    }
    // Detalle_Receta: se reemplazan las líneas de esta receta por las del formulario.
    for (let i = listaDetallesReceta.length - 1; i >= 0; i--) {
        if (listaDetallesReceta[i].id_receta === receta.id_receta) listaDetallesReceta.splice(i, 1);
    }
    ingredientesRecetaActual.forEach(i => listaDetallesReceta.push(new DetalleReceta(receta.id_receta, i.id_materia_prima, i.id_unidad_medida, i.cantidad)));
    guardarDatos();
    alert(`¡Receta "${nombre}" ${recetaEnEdicionId ? 'actualizada' : 'registrada'} con éxito!`);
    volverARecetas();
}

// ---------- Ver receta: formato de "receta estándar de producción" (imprimible) ----------
function verReceta(idx) {
    const r = listaRecetas[idx];
    if (!r) return;
    const producto = listaProductos.find(p => p.id_producto === r.id_producto);
    const st = producto ? subtipoProducto(producto.id_subtipo_producto) : null;
    const celdaEtiqueta = 'border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 w-1/4';
    const celdaValor = 'border border-slate-300 px-3 py-2 w-1/4';
    const filasIngredientes = r.detalle.map((d, i) => `
        <tr>
            <td class="border border-slate-300 px-3 py-2">${d.nombre}</td>
            <td class="border border-slate-300 px-3 py-2 text-center">${formatearCantidad(d.cantidad)}</td>
            <td class="border border-slate-300 px-3 py-2 text-center">${d.unidad}</td>
            ${i === 0 ? `<td rowspan="${r.detalle.length}" class="border border-slate-300 px-3 py-2 align-top text-xs leading-relaxed whitespace-pre-line">${r.procedimiento || '-'}</td>` : ''}
        </tr>`).join('');

    document.getElementById('modal-ver-receta-titulo').innerText = `Receta ${formatearIdentificador("REC", String(r.id_receta).padStart(4, '0'))}`;
    document.getElementById('area-receta').innerHTML = `
        <div class="border border-slate-300 text-slate-800">
            <div class="text-center py-4 border-b border-slate-300">
                <p class="text-[11px] uppercase tracking-wider text-slate-500">${DATOS_EMPRESA.razonSocial}</p>
                <h2 class="text-xl font-bold">Receta Estándar de Producción</h2>
            </div>
            <table class="w-full border-collapse">
                <tr><td class="${celdaEtiqueta}">Nombre receta</td><td class="${celdaValor} font-semibold" colspan="3">${r.nombre_receta}</td></tr>
                <tr><td class="${celdaEtiqueta}">Producto</td><td class="${celdaValor}">${r.nombre_producto || '-'}</td><td class="${celdaEtiqueta}">Tipo / Subtipo</td><td class="${celdaValor}">${st ? `${st.tipo} · ${st.subtipo}` : '-'}</td></tr>
                <tr><td class="${celdaEtiqueta}">Cantidad a producir</td><td class="${celdaValor}">${formatearCantidad(r.cantidad_a_producir)} ${unidadProductoDeReceta(r)}</td><td class="${celdaEtiqueta}">Rendimiento</td><td class="${celdaValor}">${formatearCantidad(r.rendimiento_kg)} kg</td></tr>
                <tr><td class="${celdaEtiqueta}">Versión</td><td class="${celdaValor}">v${r.version}</td><td class="${celdaEtiqueta}">Estado</td><td class="${celdaValor}">${r.estado_activa ? 'Activa' : 'Inactiva'}</td></tr>
                <tr><td class="${celdaEtiqueta}">Fecha de vencimiento</td><td class="${celdaValor}" colspan="3">${formatearFechaLatina(r.fecha_vencimiento)}</td></tr>
            </table>
            <div class="text-center font-semibold bg-slate-100 border-y border-slate-300 py-1.5">Preparación</div>
            <table class="w-full border-collapse">
                <thead>
                    <tr class="text-xs text-slate-600">
                        <th class="border border-slate-300 px-3 py-2 text-left w-[30%]">Ingredientes</th>
                        <th class="border border-slate-300 px-3 py-2 w-[12%]">Cantidad</th>
                        <th class="border border-slate-300 px-3 py-2 w-[14%]">Unidad de medida</th>
                        <th class="border border-slate-300 px-3 py-2 text-left">Procedimiento</th>
                    </tr>
                </thead>
                <tbody>${filasIngredientes}</tbody>
            </table>
        </div>`;
    document.getElementById('modal-ver-receta').classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function cerrarModalVerReceta() {
    document.getElementById('modal-ver-receta').classList.add('hidden');
}

// ==========================================
// MATERIAS PRIMAS: su stock_actual es el único stock de MP (lo suman los Remitos, lo descuentan las Órdenes de
// Producción). Compras las compra por envase a través de CATALOGO_MATERIAS_PRIMAS.
// ==========================================
let ordenListadoMateriasPrimas = { campo: '', direccion: '' };
let filtroTipoMateriaPrimaListado = '';
let filtroEstadoMateriaPrimaListado = '';
let materiaPrimaEnEdicionId = null;

function irAMateriasPrimas() {
    if (window.location.hash !== '#materias-primas') window.location.hash = 'materias-primas';
    else irASubvistaDesdeHashProduccion();
}
function irARegistrarMateriaPrima() {
    materiaPrimaEnEdicionId = null;
    if (window.location.hash !== '#registrar-materia-prima') window.location.hash = 'registrar-materia-prima';
    else irASubvistaDesdeHashProduccion();
}
function volverAMateriasPrimas() {
    irAMateriasPrimas();
}

function ordenarListadoMateriasPrimas(campo) {
    ordenListadoMateriasPrimas.direccion = ordenListadoMateriasPrimas.campo === campo && ordenListadoMateriasPrimas.direccion === 'asc' ? 'desc' : 'asc';
    ordenListadoMateriasPrimas.campo = campo;
    renderizarTablaMateriasPrimas();
}

function elegirFiltroEstadoMateriaPrima(valor) {
    filtroEstadoMateriaPrimaListado = valor;
    document.getElementById('pop-mp-estado')?.classList.add('hidden');
    renderizarTablaMateriasPrimas();
}

function elegirFiltroTipoMateriaPrima(id) {
    filtroTipoMateriaPrimaListado = id;
    document.getElementById('pop-mp-tipo')?.classList.add('hidden');
    renderizarTablaMateriasPrimas();
}

function poblarPopoverTipoMateriaPrima() {
    const cont = document.getElementById('pop-mp-tipo');
    if (!cont || cont.children.length) return;
    cont.innerHTML = `<button type="button" onclick="elegirFiltroTipoMateriaPrima('')" class="block w-full text-left px-2 py-1 text-xs hover:bg-slate-100">Todos</button>` +
        dbTiposMateriaPrima.map(t => `<button type="button" onclick="elegirFiltroTipoMateriaPrima(${t.id_tipo_materia_prima})" class="block w-full text-left px-2 py-1 text-xs hover:bg-slate-100">${t.nombre}</button>`).join('');
}

function actualizarVisibilidadVencimientoMP() {
    const tiene = document.getElementById('mpn-tiene-vencimiento').checked;
    document.getElementById('wrap-mpn-vencimiento').classList.toggle('hidden', !tiene);
    if (!tiene) document.getElementById('mpn-fecha-vencimiento').value = '';
}

function resetFormularioMateriaPrima() {
    materiaPrimaEnEdicionId = null;
    document.getElementById('mpn-nombre').value = '';
    poblarSelectTipoMateriaPrima('mpn-tipo');
    poblarSelectMarcaMateriaPrima('mpn-marca');
    poblarSelectUnidadMedida('mpn-unidad');
    document.getElementById('mpn-factor').value = 1;
    document.getElementById('mpn-precio').value = '';
    document.getElementById('mpn-stock-actual').value = 0;
    document.getElementById('mpn-stock-minimo').value = 0;
    document.getElementById('mpn-stock-maximo').value = 0;
    document.getElementById('mpn-estado').value = 'true';
    document.getElementById('mpn-tiene-vencimiento').checked = false;
    document.getElementById('mpn-fecha-vencimiento').value = '';
    document.getElementById('wrap-mpn-vencimiento').classList.add('hidden');
    document.getElementById('titulo-registrar-materia-prima').innerText = 'Registrar Materia Prima';
}

function diasHasta(fechaStr) {
    if (!fechaStr) return Infinity;
    return Math.ceil((new Date(fechaStr + 'T00:00:00') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')) / 86400000);
}

function renderizarTablaMateriasPrimas() {
    const tbody = document.getElementById('tabla-materias-primas');
    if (!tbody) return;
    poblarPopoverTipoMateriaPrima();

    const set = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };
    set('kpi-mp-total', listaMateriasPrimas.length);
    set('kpi-mp-activas', listaMateriasPrimas.filter(m => m.estado_activa).length);
    set('kpi-mp-stock-bajo', listaMateriasPrimas.filter(m => m.stock_actual <= m.stock_minimo).length);
    set('kpi-mp-por-vencer', listaMateriasPrimas.filter(m => m.tiene_vencimiento && diasHasta(m.fecha_vencimiento) <= 15 && diasHasta(m.fecha_vencimiento) >= 0).length);

    const terminoNumero = normalizarTexto(document.getElementById('buscar-mp-numero')?.value || '').trim();
    const terminoNombre = normalizarTexto(document.getElementById('buscar-mp-nombre')?.value || '').trim();
    const fechaVencimiento = document.getElementById('buscar-mp-vencimiento')?.value || '';

    let materias = listaMateriasPrimas.filter(m => {
        return (!terminoNumero || String(m.id_materia_prima).includes(terminoNumero)) &&
            (!terminoNombre || normalizarTexto(m.nombre_materia_prima).includes(terminoNombre)) &&
            (!filtroTipoMateriaPrimaListado || m.id_tipo_materia_prima === filtroTipoMateriaPrimaListado) &&
            (!filtroEstadoMateriaPrimaListado || (filtroEstadoMateriaPrimaListado === 'activa' ? m.estado_activa : !m.estado_activa)) &&
            coincideFechaExacta(fechaVencimiento, m.fecha_vencimiento);
    });

    if (ordenListadoMateriasPrimas.campo) {
        const campo = ordenListadoMateriasPrimas.campo;
        materias.sort((a, b) => {
            const va = a[campo], vb = b[campo];
            const cmp = typeof va === 'number' ? va - vb : String(va || '').localeCompare(String(vb || ''), 'es');
            return ordenListadoMateriasPrimas.direccion === 'asc' ? cmp : -cmp;
        });
    }

    if (!materias.length) {
        tbody.innerHTML = `<tr><td colspan="12" class="p-6 text-center text-slate-400">No se encontraron materias primas con ese criterio.</td></tr>`;
    } else {
        tbody.innerHTML = materias.map(m => {
            const idx = listaMateriasPrimas.indexOf(m);
            return `
            <tr class="hover:bg-slate-50 border-b border-slate-100">
                <td class="px-6 py-3 font-semibold text-slate-500">${formatearIdentificador("MP", String(m.id_materia_prima).padStart(4, '0'))}</td>
                <td class="px-6 py-3 font-semibold text-slate-800">${m.nombre_materia_prima}</td>
                <td class="px-6 py-3 text-slate-600">${nombreTipoMateriaPrima(m.id_tipo_materia_prima)}</td>
                <td class="px-6 py-3 text-slate-600">${nombreMarca(m.id_marca)}</td>
                <td class="px-6 py-3 text-slate-500">${nombreUnidadMedida(m.id_unidad_medida)}</td>
                <td class="px-6 py-3 text-right text-slate-500">${m.factor_conversion}</td>
                <td class="px-6 py-3 text-right ${m.stock_actual <= m.stock_minimo ? 'text-red-600 font-semibold' : 'text-slate-700'}">${m.stock_actual}</td>
                <td class="px-6 py-3 text-right text-slate-500">${m.stock_minimo}</td>
                <td class="px-6 py-3 text-right text-slate-500">${m.stock_maximo}</td>
                <td class="px-6 py-3 text-slate-500 whitespace-nowrap">${m.tiene_vencimiento ? formatearFechaLatina(m.fecha_vencimiento) : 'No aplica'}</td>
                <td class="px-6 py-3 text-right whitespace-nowrap">$ ${m.precio_unitario.toLocaleString()}</td>
                <td class="px-6 py-3 text-center"><span class="text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${m.estado_activa ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">${m.estado_activa ? 'Activa' : 'Inactiva'}</span></td>
                <td class="px-6 py-3 text-center whitespace-nowrap">
                    <button type="button" onclick="verMateriaPrima(${idx})" title="Ver materia prima" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    <button type="button" onclick="editarMateriaPrima(${idx})" title="Editar" class="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                </td>
            </tr>`;
        }).join('');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function verMateriaPrima(idx) {
    const m = listaMateriasPrimas[idx];
    if (!m) return;
    abrirModalVerRegistro('wheat', `Materia Prima ${formatearIdentificador("MP", String(m.id_materia_prima).padStart(4, '0'))}`, m.nombre_materia_prima,
        m.estado_activa, m.estado_activa ? 'Activa' : 'Inactiva',
        [
            ['Tipo de Materia Prima', nombreTipoMateriaPrima(m.id_tipo_materia_prima)],
            ['Marca', nombreMarca(m.id_marca)],
            ['Unidad de Medida', nombreUnidadMedida(m.id_unidad_medida)],
            ['Factor de Conversión', m.factor_conversion],
            ['Precio Unitario', `$ ${m.precio_unitario.toLocaleString()}`],
            ['Stock Actual', stockConAviso(m.stock_actual, m.stock_minimo)],
            ['Stock Mínimo', m.stock_minimo],
            ['Stock Máximo', m.stock_maximo],
            ['Fecha de Vencimiento', m.tiene_vencimiento ? formatearFechaLatina(m.fecha_vencimiento) : 'No aplica']
        ]);
}

function editarMateriaPrima(idx) {
    const m = listaMateriasPrimas[idx];
    if (!m) return;
    materiaPrimaEnEdicionId = m.id_materia_prima;
    poblarSelectTipoMateriaPrima('mpn-tipo');
    poblarSelectMarcaMateriaPrima('mpn-marca');
    poblarSelectUnidadMedida('mpn-unidad');
    document.getElementById('mpn-nombre').value = m.nombre_materia_prima;
    document.getElementById('mpn-tipo').value = m.id_tipo_materia_prima;
    document.getElementById('mpn-marca').value = m.id_marca || '';
    document.getElementById('mpn-unidad').value = m.id_unidad_medida;
    document.getElementById('mpn-factor').value = m.factor_conversion;
    document.getElementById('mpn-precio').value = m.precio_unitario;
    document.getElementById('mpn-stock-actual').value = m.stock_actual;
    document.getElementById('mpn-stock-minimo').value = m.stock_minimo;
    document.getElementById('mpn-stock-maximo').value = m.stock_maximo;
    document.getElementById('mpn-estado').value = String(m.estado_activa);
    document.getElementById('mpn-tiene-vencimiento').checked = m.tiene_vencimiento;
    document.getElementById('wrap-mpn-vencimiento').classList.toggle('hidden', !m.tiene_vencimiento);
    document.getElementById('mpn-fecha-vencimiento').value = m.fecha_vencimiento || '';
    document.getElementById('titulo-registrar-materia-prima').innerText = `Editar ${formatearIdentificador("MP", String(m.id_materia_prima).padStart(4, '0'))}`;
    if (window.location.hash !== '#registrar-materia-prima') window.location.hash = 'registrar-materia-prima';
    else mostrarSubvistaProduccion('registrar-materia-prima');
}

function guardarMateriaPrima() {
    const nombre = document.getElementById('mpn-nombre').value.trim();
    const idTipo = parseInt(document.getElementById('mpn-tipo').value);
    const idMarca = parseInt(document.getElementById('mpn-marca').value);
    const idUnidad = parseInt(document.getElementById('mpn-unidad').value);
    const factor = parseFloat(document.getElementById('mpn-factor').value) || 1;
    const precio = parseFloat(document.getElementById('mpn-precio').value);
    const stockActual = parseFloat(document.getElementById('mpn-stock-actual').value) || 0;
    const stockMinimo = parseFloat(document.getElementById('mpn-stock-minimo').value) || 0;
    const stockMaximo = parseFloat(document.getElementById('mpn-stock-maximo').value) || 0;
    const estadoActiva = document.getElementById('mpn-estado').value === 'true';
    const tieneVencimiento = document.getElementById('mpn-tiene-vencimiento').checked;
    const fechaVencimiento = document.getElementById('mpn-fecha-vencimiento').value || null;

    if (!nombre) return alert('Ingrese el nombre de la materia prima.');
    if (!idTipo) return alert('Seleccione el tipo de materia prima.');
    if (!idMarca) return alert('Seleccione la marca.');
    if (!idUnidad) return alert('Seleccione la unidad de medida.');
    if (!precio || precio <= 0) return alert('Ingrese un precio unitario válido.');
    if (tieneVencimiento && !fechaVencimiento) return alert('Ingrese la fecha de vencimiento.');

    if (materiaPrimaEnEdicionId) {
        const m = listaMateriasPrimas.find(x => x.id_materia_prima === materiaPrimaEnEdicionId);
        Object.assign(m, { nombre_materia_prima: nombre, id_tipo_materia_prima: idTipo, id_marca: idMarca, id_unidad_medida: idUnidad, factor_conversion: factor, precio_unitario: precio, stock_actual: stockActual, stock_minimo: stockMinimo, stock_maximo: stockMaximo, estado_activa: estadoActiva, tiene_vencimiento: tieneVencimiento, fecha_vencimiento: tieneVencimiento ? fechaVencimiento : null });
        guardarDatos();
        alert(`¡Materia prima "${nombre}" actualizada con éxito!`);
    } else {
        const idNuevo = numMateriaPrimaContador++;
        const nueva = new MateriaPrima(idNuevo, idUnidad, idTipo, idMarca, nombre, '', estadoActiva, factor, stockActual, stockMinimo, stockMaximo, tieneVencimiento, tieneVencimiento ? fechaVencimiento : null, precio);
        listaMateriasPrimas.push(nueva);
        if (estadoActiva) agregarMateriaPrimaAlCatalogoCompras(nueva);
        guardarDatos();
        alert(`¡Materia prima "${nombre}" registrada con éxito!`);
    }
    volverAMateriasPrimas();
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
function initPaginaProduccion() {
    inicializarEmpleadoLogueado();
    window.addEventListener('hashchange', irASubvistaDesdeHashProduccion);
    irASubvistaDesdeHashProduccion();
}
