// ==========================================
// MÓDULO DE MANTENIMIENTO
// ==========================================
let itemsMantenimientoActual = [];

function renderizarMaquinariaUI() {
    const selectDetMaq = document.getElementById('mant-det-maquinaria');
    const lista = document.getElementById('lista-maquinaria');
    if (!selectDetMaq) return;
    selectDetMaq.innerHTML = '';
    lista.innerHTML = '';
    let operativas = 0, baja = 0;
    listaMaquinaria.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id_maquinaria; opt.innerText = m.nombre;
        selectDetMaq.appendChild(opt);

        if (m.estado === 'Operativa') operativas++;
        if (m.estado === 'Fuera de servicio') baja++;

        const colorEstado = m.estado === 'Operativa' ? 'bg-emerald-100 text-emerald-800' : (m.estado === 'En reparación' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700');
        const div = document.createElement('div');
        div.className = 'text-sm p-3 bg-slate-50 rounded-lg space-y-1';
        div.innerHTML = `
            <div class="flex items-center justify-between">
                <p class="font-medium text-slate-800">${m.nombre}</p>
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${colorEstado}">${m.estado}</span>
            </div>
            <p class="text-xs text-slate-400">${m.descripcion}</p>
            <p class="text-[11px] text-slate-400">Adquirida: ${m.fecha_adquisicion || '-'} · Unidad de tiempo: ${m.id_unidad_tiempo}</p>
        `;
        lista.appendChild(div);
    });
    document.getElementById('kpi-maquinas-operativas').innerText = operativas;
    document.getElementById('kpi-maquinas-baja').innerText = baja;
    document.getElementById('kpi-ordenes-mant').innerText = listaOrdenesMantenimiento.length;
}

function mostrarFormMaquinaria() {
    document.getElementById('form-nueva-maquinaria').classList.toggle('hidden');
}

function guardarMaquinaria() {
    const nombre = document.getElementById('maq-nombre').value.trim();
    const descripcion = document.getElementById('maq-descripcion').value.trim();
    const fechaAdquisicion = document.getElementById('maq-fecha-adquisicion').value;
    const unidadTiempo = document.getElementById('maq-unidad-tiempo').value;
    const estado = document.getElementById('maq-estado').value;
    if (!nombre) return alert('Ingrese el nombre de la máquina.');
    listaMaquinaria.push(new Maquinaria(numMaquinariaContador++, nombre, descripcion || 'Sin descripción', fechaAdquisicion, unidadTiempo, estado));
    document.getElementById('maq-nombre').value = '';
    document.getElementById('maq-descripcion').value = '';
    document.getElementById('maq-fecha-adquisicion').value = '';
    document.getElementById('form-nueva-maquinaria').classList.add('hidden');
    guardarDatos();
    renderizarMaquinariaUI();
    lucide.createIcons();
}

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
        observaciones,
        detalle: itemsMantenimientoActual
    };
    listaOrdenesMantenimiento.unshift(orden);

    itemsMantenimientoActual = [];
    guardarDatos();
    renderizarTablaDetalleMantenimiento();
    document.getElementById('mant-observaciones').value = '';
    renderizarHistorialMantenimiento();
    renderizarMaquinariaUI();
    alert('¡Orden de mantenimiento registrada con éxito!');
}

function renderizarHistorialMantenimiento() {
    const cont = document.getElementById('lista-ordenes-mantenimiento');
    cont.innerHTML = '';
    if (listaOrdenesMantenimiento.length === 0) {
        cont.innerHTML = `<p class="text-sm text-slate-400 text-center py-6">Todavía no se registraron órdenes de mantenimiento.</p>`;
        return;
    }
    listaOrdenesMantenimiento.forEach(o => {
        const filasDetalle = o.detalle.map(d => `
            <tr class="border-b border-slate-100 last:border-0">
                <td class="py-1.5 pr-3">${d.nombre_maquinaria}</td>
                <td class="py-1.5 pr-3 text-slate-500">${d.fecha_inicio} ${d.hora_inicio || ''} → ${d.fecha_fin || '-'} ${d.hora_fin || ''}</td>
                <td class="py-1.5 text-slate-500">${d.tareas_realizadas}</td>
            </tr>`).join('');
        const div = document.createElement('div');
        div.className = 'border border-slate-200 rounded-xl p-4';
        div.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p class="font-semibold text-slate-800 font-mono">MANT-${String(o.id_orden_mantenimiento).padStart(3, '0')}</p>
                <span class="text-xs px-2 py-0.5 rounded-full ${o.id_tipo_mantenimiento === 'Preventivo' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}">${o.id_tipo_mantenimiento}</span>
                <span class="text-xs text-slate-400">Responsable: ${o.id_empleado} · Emisión: ${o.fecha_emision}</span>
            </div>
            <table class="w-full text-xs text-left">${filasDetalle}</table>
            ${o.observaciones ? `<p class="text-xs text-slate-400 mt-2 italic">${o.observaciones}</p>` : ''}
        `;
        cont.appendChild(div);
    });
}

function initPaginaMantenimiento() {
    renderizarEmpleadosUI();
    renderizarMaquinariaUI();
    renderizarHistorialMantenimiento();
}
