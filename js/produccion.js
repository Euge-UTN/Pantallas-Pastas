// ==========================================
// MÓDULO DE PRODUCCIÓN: Orden_Producción + sus 3 detalles
// ==========================================
let itemsMaquinariaProduccionActual = [];

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

function inicializarCombosProduccion() {
    const selectReceta = document.getElementById('prod-receta');
    const selectEmpleado = document.getElementById('prod-empleado');
    const selectPedido = document.getElementById('prod-pedido-asociado');
    const selectMaquinaria = document.getElementById('prod-det-maquinaria');
    if (!selectReceta) return;

    selectReceta.innerHTML = '';
    listaRecetas.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id_receta; opt.innerText = `${r.nombre_receta} (${r.nombre_producto})`;
        selectReceta.appendChild(opt);
    });

    selectEmpleado.innerHTML = '';
    listaEmpleados.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.nombreCompleto; opt.innerText = `${e.nombreCompleto} (${e.cargo})`;
        selectEmpleado.appendChild(opt);
    });

    selectPedido.innerHTML = '<option value="">Sin pedido asociado (producción para stock)</option>';
    listaPedidos.filter(p => p.estado === 'Pendiente').forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id; opt.innerText = `PED-${p.id} — ${p.cliente}`;
        selectPedido.appendChild(opt);
    });

    selectMaquinaria.innerHTML = '';
    listaMaquinaria.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id_maquinaria; opt.innerText = m.nombre;
        selectMaquinaria.appendChild(opt);
    });

    actualizarVistaPreviaReceta();
}

function actualizarVistaPreviaReceta() {
    const receta = listaRecetas.find(r => r.id_receta === parseInt(document.getElementById('prod-receta').value));
    const cantidad = parseFloat(document.getElementById('prod-cantidad-planificada').value) || 0;
    if (!receta) return;

    document.getElementById('prod-preview-receta').innerHTML = `Producto a elaborar: <b class="text-slate-800">${receta.nombre_producto}</b>`;

    const tbody = document.getElementById('tabla-detalle-materia-prima');
    tbody.innerHTML = '';
    receta.detalle.forEach(d => {
        const mp = stockMateriaPrima[d.clave_mp];
        const cantidadPlanificada = (d.cantidad_por_kg * cantidad).toFixed(2);
        const insuficiente = parseFloat(cantidadPlanificada) > mp.cantidad_actual;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 font-medium text-slate-800">${mp.nombre}</td>
            <td class="p-3 text-center ${insuficiente ? 'text-red-600 font-bold' : ''}">${cantidadPlanificada} ${mp.unidad_medida}</td>
            <td class="p-3 text-center text-slate-500">${mp.cantidad_actual} ${mp.unidad_medida}</td>
        `;
        tbody.appendChild(tr);
    });
}

function agregarMaquinariaProduccion() {
    const idMaquinaria = parseInt(document.getElementById('prod-det-maquinaria').value);
    const maquina = listaMaquinaria.find(m => m.id_maquinaria === idMaquinaria);
    const horaInicio = document.getElementById('prod-det-hora-inicio-plan').value;
    const horaFin = document.getElementById('prod-det-hora-fin-plan').value;
    if (!maquina) return alert('Seleccione una maquinaria.');
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

function registrarOrdenProduccion() {
    const idPedido = document.getElementById('prod-pedido-asociado').value;
    const receta = listaRecetas.find(r => r.id_receta === parseInt(document.getElementById('prod-receta').value));
    const empleado = document.getElementById('prod-empleado').value;
    const cantidadPlanificada = parseFloat(document.getElementById('prod-cantidad-planificada').value) || 0;

    if (!receta) return alert('Seleccione una receta.');
    if (!empleado) return alert('Seleccione el empleado responsable.');
    if (cantidadPlanificada <= 0) return alert('Ingrese una cantidad planificada válida.');
    if (itemsMaquinariaProduccionActual.length === 0) return alert('Agregue al menos una maquinaria al detalle de la orden.');

    const detalleMateriaPrima = receta.detalle.map(d => ({ clave_mp: d.clave_mp, nombre: stockMateriaPrima[d.clave_mp].nombre, cantidad_planificada: +(d.cantidad_por_kg * cantidadPlanificada).toFixed(2) }));
    const faltante = detalleMateriaPrima.find(d => d.cantidad_planificada > stockMateriaPrima[d.clave_mp].cantidad_actual);
    if (faltante) return alert(`Stock insuficiente de ${faltante.nombre}. Genere un pedido de materia prima antes de continuar.`);

    detalleMateriaPrima.forEach(d => { stockMateriaPrima[d.clave_mp].cantidad_actual -= d.cantidad_planificada; });

    const numeroLote = `LOT-${numLoteContador++}`;
    const orden = {
        id_orden_produccion: numOrdenProduccionContador++,
        id_orden_pedido_cliente: idPedido || null,
        id_receta: receta.id_receta,
        nombre_receta: receta.nombre_receta,
        id_empleado: empleado,
        fecha_emision: document.getElementById('prod-fecha-emision').value || new Date().toISOString().slice(0, 10),
        hora_emision: document.getElementById('prod-hora-emision').value,
        fecha_inicio: document.getElementById('prod-fecha-inicio').value,
        hora_inicio: document.getElementById('prod-hora-inicio').value,
        fecha_fin: document.getElementById('prod-fecha-fin').value,
        hora_fin: document.getElementById('prod-hora-fin').value,
        fecha_vencimiento: document.getElementById('prod-fecha-vencimiento').value,
        hora_vencimiento: document.getElementById('prod-hora-vencimiento').value,
        estado: document.getElementById('prod-estado').value,
        observaciones: document.getElementById('prod-observaciones').value.trim(),
        detalleProducto: {
            nombre_producto: receta.nombre_producto,
            cantidad_planificada: cantidadPlanificada,
            cantidad_real: parseFloat(document.getElementById('prod-cantidad-real').value) || null,
            numero_lote: numeroLote,
            fecha_vencimiento: document.getElementById('prod-fecha-vencimiento').value
        },
        detalleMateriaPrima,
        detalleMaquinaria: itemsMaquinariaProduccionActual
    };
    listaOrdenesProduccion.unshift(orden);

    if (idPedido) {
        const pedido = listaPedidos.find(p => p.id === parseInt(idPedido));
        if (pedido) pedido.estado = 'En preparación';
    }

    itemsMaquinariaProduccionActual = [];
    guardarDatos();
    renderizarTablaMaquinariaProduccion();
    document.getElementById('prod-observaciones').value = '';
    document.getElementById('prod-cantidad-real').value = '';
    renderizarStockUI();
    inicializarCombosProduccion();
    renderizarHistorialProduccion();
    alert(`¡Orden de producción registrada! N° de lote: ${numeroLote}`);
}

function renderizarHistorialProduccion() {
    const cont = document.getElementById('lista-ordenes-produccion');
    if (!cont) return;
    cont.innerHTML = '';
    if (listaOrdenesProduccion.length === 0) {
        cont.innerHTML = `<p class="text-sm text-slate-400 text-center py-6">Todavía no se registraron órdenes de producción.</p>`;
        return;
    }
    const colorEstado = { 'Planificada': 'bg-slate-100 text-slate-700', 'En Proceso': 'bg-blue-100 text-blue-800', 'Finalizada': 'bg-emerald-100 text-emerald-800', 'Cancelada': 'bg-red-100 text-red-700' };
    listaOrdenesProduccion.forEach(o => {
        const mpTexto = o.detalleMateriaPrima.map(d => `${d.cantidad_planificada} ${d.nombre}`).join(', ');
        const maqTexto = o.detalleMaquinaria.map(m => `${m.nombre_maquinaria} (${m.hora_inicio_planificada}-${m.hora_fin_planificada})`).join(', ');
        const div = document.createElement('div');
        div.className = 'border border-slate-200 rounded-xl p-4 space-y-2';
        div.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="font-semibold text-slate-800">OP-${o.id_orden_produccion} · ${o.detalleProducto.numero_lote} <span class="text-xs font-normal text-slate-400">· ${o.nombre_receta}</span></p>
                <span class="text-xs px-2 py-0.5 rounded-full ${colorEstado[o.estado]}">${o.estado}</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-500">
                <div><p class="font-semibold text-slate-700">Producto</p>${o.detalleProducto.nombre_producto} (${o.detalleProducto.cantidad_planificada} kg)</div>
                <div><p class="font-semibold text-slate-700">Responsable</p>${o.id_empleado}</div>
                <div><p class="font-semibold text-slate-700">Pedido asociado</p>${o.id_orden_pedido_cliente ? 'PED-' + o.id_orden_pedido_cliente : 'Para stock'}</div>
                <div><p class="font-semibold text-slate-700">Vencimiento</p>${o.fecha_vencimiento || '-'} ${o.hora_vencimiento || ''}</div>
            </div>
            <p class="text-xs text-slate-500"><span class="font-semibold text-slate-700">Materia prima:</span> ${mpTexto}</p>
            <p class="text-xs text-slate-500"><span class="font-semibold text-slate-700">Maquinaria:</span> ${maqTexto}</p>
            ${o.observaciones ? `<p class="text-xs italic text-slate-400">${o.observaciones}</p>` : ''}
        `;
        cont.appendChild(div);
    });
}

function initPaginaProduccion() {
    renderizarStockUI();
    inicializarCombosProduccion();
    renderizarHistorialProduccion();
}
