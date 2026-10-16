// ==========================================
// MÓDULO DE MANTENIMIENTO
// Contiene las Órdenes de Mantenimiento y Maquinarias.
// ==========================================
const SUBVISTAS_MANTENIMIENTO = [
    'historial', 
    'registrar', 
    'maquinaria', 
    'registrar-maquinaria', 
    'orden-mantenimiento', 
    'historial-maquina'
];

let itemsMantenimientoActual = [];
let ordenListadoMantenimiento = { campo: '', direccion: '' };
let ordenListadoMaquinaria = { campo: '', direccion: '' };
let filtroTipoMantenimientoListado = '';
let filtroEstadoMaquinariaListado = '';

function ordenarListadoMantenimiento(campo) {
    ordenListadoMantenimiento.direccion = ordenListadoMantenimiento.campo === campo && ordenListadoMantenimiento.direccion === 'asc' ? 'desc' : 'asc';
    ordenListadoMantenimiento.campo = campo;
    renderizarHistorialMantenimiento();
}

function ordenarListadoMaquinaria(campo) {
    ordenListadoMaquinaria.direccion = ordenListadoMaquinaria.campo === campo && ordenListadoMaquinaria.direccion === 'asc' ? 'desc' : 'asc';
    ordenListadoMaquinaria.campo = campo;
    renderizarTablaMaquinaria();
}

function elegirFiltroTipoMantenimiento(tipo) {
    filtroTipoMantenimientoListado = tipo;
    document.getElementById('pop-mant-tipo')?.classList.add('hidden');
    renderizarHistorialMantenimiento();
}

function elegirFiltroEstadoMaquinaria(estado) {
    filtroEstadoMaquinariaListado = estado;
    document.getElementById('pop-maq-estado')?.classList.add('hidden');
    renderizarTablaMaquinaria();
}

function filtrarListadoMaquinaria() { renderizarTablaMaquinaria(); }

// Carga inicial de datos de prueba asegurando fechas/horas de inicio y fin para todos
if (typeof listaOrdenesMantenimiento === 'undefined' || !listaOrdenesMantenimiento.length) {
    window.listaOrdenesMantenimiento = [
        {
            id_orden_mantenimiento: 7,
            id_tipo_mantenimiento: 'Correctivo',
            id_empleado: 'Josefina Silva',
            fecha_emision: '2026-10-15',
            hora_emision: '08:00',
            fecha_inicio: '2026-10-15',
            hora_inicio: '08:00',
            fecha_fin: '2026-10-15',
            hora_fin: '12:00',
            observaciones: 'Ajuste urgente de rodillo.',
            detalle: [{ id_maquinaria: 1, nombre_maquinaria: 'Sobadora Industrial', tareas_realizadas: 'Calibración de engranajes', fecha_proximo_mantenimiento: '2026-11-15' }]
        },
        {
            id_orden_mantenimiento: 6,
            id_tipo_mantenimiento: 'Correctivo',
            id_empleado: 'Josefina Silva',
            fecha_emision: '2026-10-12',
            hora_emision: '09:00',
            fecha_inicio: '2026-10-12',
            hora_inicio: '09:00',
            fecha_fin: '2026-10-12',
            hora_fin: '11:30',
            observaciones: 'Reparación de bomba de vacío.',
            detalle: [{ id_maquinaria: 2, nombre_maquinaria: 'Envasadora al Vacío', tareas_realizadas: 'Cambio de empaquetadura', fecha_proximo_mantenimiento: '2026-11-12' }]
        },
        {
            id_orden_mantenimiento: 5,
            id_tipo_mantenimiento: 'Preventivo',
            id_empleado: 'Laura Rodríguez',
            fecha_emision: '2026-10-08',
            hora_emision: '07:30',
            fecha_inicio: '2026-10-08',
            hora_inicio: '07:30',
            fecha_fin: '2026-10-08',
            hora_fin: '10:00',
            observaciones: 'Mantenimiento de rutina programado.',
            detalle: [{ id_maquinaria: 1, nombre_maquinaria: 'Sobadora Industrial', tareas_realizadas: 'Lubricación general', fecha_proximo_mantenimiento: '2026-11-08' }]
        },
        {
            id_orden_mantenimiento: 4,
            id_tipo_mantenimiento: 'Correctivo',
            id_empleado: 'Carlos Gómez',
            fecha_emision: '2026-10-02',
            hora_emision: '13:00',
            fecha_inicio: '2026-10-02',
            hora_inicio: '13:00',
            fecha_fin: '2026-10-02',
            hora_fin: '16:00',
            observaciones: 'Afilado de matriz y cuchillas.',
            detalle: [{ id_maquinaria: 3, nombre_maquinaria: 'Cortadora de Ravioles', tareas_realizadas: 'Reemplazo de cuchilla picada', fecha_proximo_mantenimiento: '2026-11-02' }]
        },
        {
            id_orden_mantenimiento: 3,
            id_tipo_mantenimiento: 'Preventivo',
            id_empleado: 'Laura Rodríguez',
            fecha_emision: '2026-09-25',
            hora_emision: '08:00',
            fecha_inicio: '2026-09-25',
            hora_inicio: '08:00',
            fecha_fin: '2026-09-25',
            hora_fin: '11:00',
            observaciones: 'Limpieza e inspección de filtros.',
            detalle: [{ id_maquinaria: 2, nombre_maquinaria: 'Envasadora al Vacío', tareas_realizadas: 'Limpieza y lubricación', fecha_proximo_mantenimiento: '2026-10-25' }]
        }
    ];
}

function formatearFechaLatina(fechaStr) {
    if (!fechaStr) return '';
    const partes = fechaStr.split('-');
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return fechaStr;
}

function mostrarSubvistaMantenimiento(subvista) {
    SUBVISTAS_MANTENIMIENTO.forEach(v => {
        const el = document.getElementById(`vista-${v}`);
        if (el) el.classList.add('hidden');
    });
    const vistaDestino = document.getElementById(`vista-${subvista}`);
    if (vistaDestino) vistaDestino.classList.remove('hidden');
}

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
    if (window.location.hash !== '#registrar') window.location.hash = 'registrar'; 
    else irASubvistaDesdeHashMantenimiento();
}

function volverAlHistorialMantenimiento() {
    if (window.location.hash !== '#historial') window.location.hash = 'historial'; 
    else irASubvistaDesdeHashMantenimiento();
}

function irAMaquinaria() {
    if (window.location.hash !== '#maquinaria') window.location.hash = 'maquinaria'; 
    else irASubvistaDesdeHashMantenimiento();
}

function irARegistrarMaquinaria() {
    if (window.location.hash !== '#registrar-maquinaria') window.location.hash = 'registrar-maquinaria'; 
    else irASubvistaDesdeHashMantenimiento();
}

function volverAMaquinaria() {
    irAMaquinaria();
}

// EMPLEADO RESPONSABLE (Automático)
function inicializarEmpleadoLogueado() {
    const inputEmpleado = document.getElementById('mant-empleado');
    if (!inputEmpleado) return;

    let nombreEmpleado = 'Carlos Gómez (Maestro Pastero)';
    if (typeof usuarioInternoActual !== 'undefined' && usuarioInternoActual && usuarioInternoActual.nombre) {
        nombreEmpleado = usuarioInternoActual.nombre;
    } else if (typeof currentUser !== 'undefined' && currentUser && currentUser.nombre) {
        nombreEmpleado = currentUser.nombre;
    }
    inputEmpleado.value = nombreEmpleado;
}

function resetFormularioMantenimiento() {
    itemsMantenimientoActual = [];
    poblarSelectMaquinariaDetalle();
    inicializarEmpleadoLogueado();

    const hoyStr = new Date().toISOString().slice(0, 10);

    document.getElementById('mant-tipo').value = 'Preventivo';
    document.getElementById('mant-fecha-inicio').value = hoyStr;
    document.getElementById('mant-hora-inicio').value = '08:00';
    document.getElementById('mant-fecha-fin').value = hoyStr;
    document.getElementById('mant-hora-fin').value = '12:00';
    document.getElementById('mant-observaciones').value = '';
    
    if (document.getElementById('mant-det-fecha-proximo')) document.getElementById('mant-det-fecha-proximo').value = '';
    document.getElementById('mant-det-tareas').value = '';
    
    renderizarTablaDetalleMantenimiento();
}

// Puebla el <select> de Marca (catálogo compartido dbMarcas) en el alta de maquinaria.
function poblarSelectMarcaMaquinaria() {
    const select = document.getElementById('maq-marca');
    if (!select || typeof dbMarcas === 'undefined') return;
    select.innerHTML = dbMarcas.map(m => `<option value="${m.id_marca}">${m.nombre}</option>`).join('');
}

function resetFormularioMaquinaria() {
    document.getElementById('maq-nombre').value = '';
    poblarSelectMarcaMaquinaria();
    document.getElementById('maq-modelo').value = '';
    document.getElementById('maq-descripcion').value = '';
    document.getElementById('maq-fecha-adquisicion').value = '';
    document.getElementById('maq-estado').value = 'Operativa';
}

// MAQUINARIA
function poblarSelectMaquinariaDetalle() {
    const selectDetMaq = document.getElementById('mant-det-maquinaria');
    if (!selectDetMaq) return;
    selectDetMaq.innerHTML = '';
    if (typeof listaMaquinaria !== 'undefined') {
        listaMaquinaria.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id_maquinaria;
            opt.innerText = `${nombreMarca(m.id_marca)} - ${m.modelo} (${m.estado})`;
            selectDetMaq.appendChild(opt);
        });
    }
}

function renderizarTablaMaquinaria() {
    const tbody = document.getElementById('tabla-maquinaria');
    if (!tbody) return;

    tbody.innerHTML = '';
    renderizarStatsMaquinaria();
    if (typeof listaMaquinaria === 'undefined' || !listaMaquinaria.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400">No hay maquinarias registradas.</td></tr>`;
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
    const estadosMaquinaria = ['Operativa', 'En reparación', 'Fuera de servicio'];
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
            <td class="px-6 py-3 whitespace-nowrap text-slate-600">${formatearFechaLatina(m.fecha_adquisicion)}</td>
            <td class="px-6 py-3 text-center">
                <span class="text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${m.estado === 'Operativa' ? 'bg-emerald-100 text-emerald-800' : m.estado === 'En reparación' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}">${m.estado || 'Sin estado'}</span>
            </td>
            <td class="px-6 py-3 text-center">
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

function cambiarEstadoMaquinaria(idx, nuevoEstado) {
    const maquina = listaMaquinaria[idx];
    if (!maquina) return;
    maquina.estado = nuevoEstado;
    if (typeof guardarDatos === 'function') guardarDatos();
    renderizarTablaMaquinaria();
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
    mostrarSubvistaMantenimiento('historial-maquina');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function volverDesdeHistorialMaquina() {
    irAMaquinaria();
}

function guardarMaquinaria() {
    const nombre = document.getElementById('maq-nombre').value.trim();
    const idMarca = parseInt(document.getElementById('maq-marca').value);
    const modelo = document.getElementById('maq-modelo').value.trim();
    const descripcion = document.getElementById('maq-descripcion').value.trim();
    const fechaAdquisicion = document.getElementById('maq-fecha-adquisicion').value;
    const estado = document.getElementById('maq-estado').value;

    if (!nombre) return alert('Ingrese el nombre de la máquina.');
    if (!idMarca) return alert('Seleccione la marca.');
    if (!modelo) return alert('Ingrese el modelo.');
    if (!fechaAdquisicion) return alert('Seleccione la fecha de adquisición.');
    if (!estado) return alert('Seleccione el estado de la maquinaria.');

    const idNueva = typeof numMaquinariaContador !== 'undefined' ? numMaquinariaContador++ : Date.now();

    if (typeof Maquinaria === 'function') {
        listaMaquinaria.push(new Maquinaria(idNueva, nombre, descripcion || 'Sin descripción', fechaAdquisicion, 'Horas', estado, idMarca, modelo));
    } else {
        listaMaquinaria.push({ id_maquinaria: idNueva, nombre, descripcion, fecha_adquisicion: fechaAdquisicion, id_unidad_tiempo: 'Horas', estado, id_marca: idMarca, modelo });
    }
    
    if (typeof guardarDatos === 'function') guardarDatos();
    alert(`¡Máquina "${nombre}" registrada con éxito!`);
    irAMaquinaria();
}

// REGISTRAR MANTENIMIENTO REALIZADO
function agregarDetalleMantenimiento() {
    const idMaquinaria = parseInt(document.getElementById('mant-det-maquinaria').value);
    const maquina = listaMaquinaria.find(m => m.id_maquinaria === idMaquinaria);
    const fechaProximo = document.getElementById('mant-det-fecha-proximo')?.value || '';
    const tareas = document.getElementById('mant-det-tareas').value.trim();

    if (!maquina) return alert('Seleccione una maquinaria.');
    if (!fechaProximo) return alert('Seleccione la fecha del próximo mantenimiento.');
    if (!tareas) return alert('Ingrese las tareas o intervenciones realizadas.');

    itemsMantenimientoActual.push({
        id_maquinaria: idMaquinaria,
        nombre_maquinaria: `${nombreMarca(maquina.id_marca)} - ${maquina.modelo}`,
        fecha_proximo_mantenimiento: fechaProximo,
        tareas_realizadas: tareas
    });

    document.getElementById('mant-det-tareas').value = '';
    renderizarTablaDetalleMantenimiento();
}

function eliminarDetalleMantenimiento(idx) {
    itemsMantenimientoActual.splice(idx, 1);
    renderizarTablaDetalleMantenimiento();
}

function renderizarTablaDetalleMantenimiento() {
    const tbody = document.getElementById('tabla-detalle-mantenimiento');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (itemsMantenimientoActual.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 text-xs">No hay maquinarias en el detalle de este mantenimiento.</td></tr>`;
        return;
    }

    itemsMantenimientoActual.forEach((d, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-100';
        tr.innerHTML = `
            <td class="p-3 font-medium text-slate-800">${d.nombre_maquinaria}</td>
            <td class="p-3 text-slate-600">${d.tareas_realizadas}</td>
            <td class="p-3 text-center text-slate-600">${formatearFechaLatina(d.fecha_proximo_mantenimiento)}</td>
            <td class="p-3 text-center"><button type="button" onclick="eliminarDetalleMantenimiento(${idx})" class="text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-4 h-4 inline"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function registrarOrdenMantenimiento() {
    const tipo = document.getElementById('mant-tipo').value;
    const empleado = document.getElementById('mant-empleado').value;
    
    const fechaInicio = document.getElementById('mant-fecha-inicio')?.value;
    const horaInicio = document.getElementById('mant-hora-inicio')?.value;
    const fechaFin = document.getElementById('mant-fecha-fin')?.value;
    const horaFin = document.getElementById('mant-hora-fin')?.value;
    const observaciones = document.getElementById('mant-observaciones').value.trim();

    if (!empleado) return alert('El responsable debe estar identificado.');
    if (!fechaInicio || !horaInicio || !fechaFin || !horaFin) return alert('Complete las fechas y horas de inicio y fin.');
    if (itemsMantenimientoActual.length === 0) return alert('Agregue al menos una maquinaria intervenida.');

    const idMant = typeof numOrdenMantContador !== 'undefined' ? numOrdenMantContador++ : Date.now();
    const ahora = new Date();

    const orden = {
        id_orden_mantenimiento: idMant,
        id_tipo_mantenimiento: tipo,
        id_empleado: empleado,
        
        fecha_emision: ahora.toISOString().slice(0, 10),
        hora_emision: ahora.toTimeString().slice(0, 5),
        fecha_inicio: fechaInicio,
        hora_inicio: horaInicio,
        fecha_fin: fechaFin,
        hora_fin: horaFin,

        observaciones: observaciones,
        detalle: itemsMantenimientoActual
    };

    itemsMantenimientoActual.forEach(d => {
        const maq = listaMaquinaria.find(m => m.id_maquinaria === d.id_maquinaria);
        if (maq) maq.estado = 'Operativa';
    });

    listaOrdenesMantenimiento.unshift(orden);
    if (typeof guardarDatos === 'function') guardarDatos();

    alert(`¡Registro de mantenimiento ${formatearIdentificador("MANT", String(orden.id_orden_mantenimiento).padStart(4, '0'))} guardado exitosamente!`);
    volverAlHistorialMantenimiento();
}

// HISTORIAL Y BUSCADOR (CON SOPORTE DE FALLBACK DE FECHAS)
function renderizarHistorialMantenimiento() {
    const tbody = document.getElementById('tabla-ordenes-mantenimiento');
    if (!tbody) return;

    const filtroTipo = filtroTipoMantenimientoListado;
    const inicioDesde = document.getElementById('historial-inicio-desde')?.value || '';
    const inicioHasta = document.getElementById('historial-inicio-hasta')?.value || '';
    const finDesde = document.getElementById('historial-fin-desde')?.value || '';
    const finHasta = document.getElementById('historial-fin-hasta')?.value || '';
    const terminoNumero = normalizarTexto(document.getElementById('buscar-mant-numero')?.value || '').trim();
    const terminoEmpleado = normalizarTexto(document.getElementById('buscar-mant-empleado')?.value || '').trim();
    const terminoMaquina = normalizarTexto(document.getElementById('buscar-mant-maquina')?.value || '').trim();

    const ordenes = listaOrdenesMantenimiento.filter(o => {
        if (filtroTipo && o.id_tipo_mantenimiento !== filtroTipo) return false;
        const numero = `${formatearIdentificador("MANT", String(o.id_orden_mantenimiento).padStart(4, '0'))}`;
        const maquinas = o.detalle.map(d => `${d.nombre_maquinaria} ${d.tareas_realizadas}`).join(' ');
        if (terminoNumero && !normalizarTexto(numero).includes(terminoNumero)) return false;
        if (terminoEmpleado && !normalizarTexto(o.id_empleado).includes(terminoEmpleado)) return false;
        if (terminoMaquina && !normalizarTexto(maquinas).includes(terminoMaquina)) return false;
        const fInicio = o.fecha_inicio || o.fecha_emision || o.fecha || '';
        const fFin = o.fecha_fin || o.fecha_emision || o.fecha || '';
        if (!coincideRangoFecha(inicioDesde, inicioHasta, fInicio) || !coincideRangoFecha(finDesde, finHasta, fFin)) return false;
        return true;
    });
    if (ordenListadoMantenimiento.campo === 'empleado') {
        const campo = ordenListadoMantenimiento.campo;
        ordenes.sort((a, b) => {
            const valor = o => o.id_empleado;
            const va = valor(a), vb = valor(b);
            const cmp = typeof va === 'number' ? va - vb : String(va || '').localeCompare(String(vb || ''), 'es');
            return ordenListadoMantenimiento.direccion === 'asc' ? cmp : -cmp;
        });
    }

    tbody.innerHTML = '';
    if (!ordenes.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">No se encontraron registros de mantenimiento.</td></tr>`;
        return;
    }

    ordenes.forEach(o => {
        const maquinas = o.detalle.map(d => d.nombre_maquinaria).join(', ');

        // Fallbacks automáticos si el objeto guardado en localStorage o data.js carecía de inicio/fin
        const fInicio = o.fecha_inicio || o.fecha_emision || o.fecha || '2026-10-15';
        const hInicio = o.hora_inicio || o.hora_emision || '08:00';
        const fFin = o.fecha_fin || o.fecha_emision || o.fecha || '2026-10-15';
        const hFin = o.hora_fin || '12:00';

        const periodoStr = `${formatearFechaLatina(fInicio)} ${hInicio} - ${formatearFechaLatina(fFin)} ${hFin}`;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 border-b border-slate-100';
        tr.innerHTML = `
            <td class="px-6 py-3 font-semibold text-slate-800 whitespace-nowrap">${formatearIdentificador("MANT", String(o.id_orden_mantenimiento).padStart(4, '0'))}</td>
            <td class="px-6 py-3"><span class="text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap font-medium ${o.id_tipo_mantenimiento === 'Preventivo' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}">${o.id_tipo_mantenimiento}</span></td>
            <td class="px-6 py-3 text-slate-600 whitespace-nowrap">${o.id_empleado}</td>
            <td class="px-6 py-3 text-slate-600">${maquinas}</td>
            <td class="px-6 py-3 text-slate-500 whitespace-nowrap text-xs">${formatearFechaLatina(fInicio)}</td>
            <td class="px-6 py-3 text-slate-500 whitespace-nowrap text-xs">${formatearFechaLatina(fFin)}</td>
            <td class="px-6 py-3 text-center">
                <button type="button" onclick="verOrdenMantenimiento(${o.id_orden_mantenimiento})" title="Ver detalle" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderizarStatsMantenimiento() {
    const totalMantenimientos = listaOrdenesMantenimiento.length;
    const preventivos = listaOrdenesMantenimiento.filter(o => o.id_tipo_mantenimiento === 'Preventivo').length;
    const correctivos = listaOrdenesMantenimiento.filter(o => o.id_tipo_mantenimiento === 'Correctivo').length;
    const operativas = typeof listaMaquinaria !== 'undefined' ? listaMaquinaria.filter(m => m.estado === 'Operativa').length : 0;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('kpi-mant-total-ordenes', totalMantenimientos);
    set('kpi-mant-preventivos', preventivos);
    set('kpi-mant-correctivos', correctivos);
    set('kpi-mant-maq-operativas', operativas);
}

// VISTA DETALLE DE MANTENIMIENTO
function verOrdenMantenimiento(id) {
    const o = listaOrdenesMantenimiento.find(x => x.id_orden_mantenimiento === id);
    if (!o) return;
    document.getElementById('area-orden-mantenimiento').innerHTML = construirHTMLOrdenMantenimiento(o);
    mostrarSubvistaMantenimiento('orden-mantenimiento');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function construirHTMLOrdenMantenimiento(o) {
    const filas = o.detalle.map(d => `
        <tr class="border-b border-slate-100 text-xs">
            <td class="py-2.5 font-medium text-slate-800">${d.nombre_maquinaria}</td>
            <td class="py-2.5 text-slate-600">${d.tareas_realizadas}</td>
            <td class="py-2.5 text-center text-slate-600">${formatearFechaLatina(d.fecha_proximo_mantenimiento)}</td>
        </tr>`).join('');

    const fIni = o.fecha_inicio || o.fecha_emision || o.fecha || '2026-10-15';
    const fFin = o.fecha_fin || o.fecha_emision || o.fecha || '2026-10-15';

    return `
        <div class="flex justify-between items-start border-b border-slate-200 pb-4">
            <div>
                <h1 class="text-2xl font-bold text-red-600">FÁBRICA DE PASTAS</h1>
                <p class="text-xs text-slate-500">Registro de Mantenimiento Realizado</p>
                <div class="flex items-center gap-2 mt-2">
                    <p class="text-sm font-bold text-slate-800">${formatearIdentificador("MANT", String(o.id_orden_mantenimiento).padStart(4, '0'))}</p>
                    <span class="px-2.5 py-0.5 ${o.id_tipo_mantenimiento === 'Preventivo' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'} text-xs font-semibold rounded-full whitespace-nowrap">${o.id_tipo_mantenimiento}</span>
                </div>
            </div>
            <div class="text-right text-xs text-slate-500 space-y-0.5">
                <p><b class="text-slate-700">Emisión:</b> ${formatearFechaLatina(o.fecha_emision)} ${o.hora_emision ? o.hora_emision + ' hs' : ''}</p>
                <p><b class="text-slate-700">Inicio:</b> ${formatearFechaLatina(fIni)} ${o.hora_inicio || '08:00'} hs</p>
                <p><b class="text-slate-700">Fin:</b> ${formatearFechaLatina(fFin)} ${o.hora_fin || '12:00'} hs</p>
                <p><b class="text-slate-700">Responsable:</b> ${o.id_empleado}</p>
            </div>
        </div>
        <div>
            <h3 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Máquinas Intervenidas</h3>
            <table class="w-full text-xs text-left">
                <thead class="border-b border-slate-300 uppercase text-slate-500">
                    <tr>
                        <th class="py-2">Maquinaria</th>
                        <th class="py-2">Tareas Realizadas / Repuestos</th>
                        <th class="py-2 text-center">Próximo Mantenimiento</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>
        ${o.observaciones ? `
        <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
            <b>Observaciones:</b> ${o.observaciones}
        </div>` : ''}
    `;
}

function volverDesdeOrdenMantenimiento() {
    volverAlHistorialMantenimiento();
}

function initPaginaMantenimiento() {
    inicializarEmpleadoLogueado();
    poblarSelectMaquinariaDetalle();
    irASubvistaDesdeHashMantenimiento();
    window.addEventListener('hashchange', irASubvistaDesdeHashMantenimiento);
}
