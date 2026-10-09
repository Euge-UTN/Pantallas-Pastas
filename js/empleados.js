// ==========================================
// MÓDULO DE EMPLEADOS
// ==========================================
const SUBVISTAS_EMPLEADOS = ['historial', 'registrar', 'detalle'];
let ordenEmpleadosCampo = null; // 'nombre' | 'apellido' | null
let ordenEmpleadosDireccion = null;
let filtroEmpCargoSeleccionado = '';
let filtroEmpTurnoSeleccionado = '';
let filtroEmpEstadoSeleccionado = '';
let empleadoEnEdicionIdx = null; // índice en listaEmpleados del empleado que se está editando, o null en alta

function mostrarSubvistaEmpleados(subvista) {
    SUBVISTAS_EMPLEADOS.forEach(v => document.getElementById(`vista-${v}`).classList.add('hidden'));
    const vistaDestino = document.getElementById(`vista-${subvista}`);
    if (vistaDestino) vistaDestino.classList.remove('hidden');
}

function irASubvistaDesdeHashEmpleados() {
    const hash = (window.location.hash || '').replace('#', '') || 'historial';
    if (hash === 'registrar') {
        if (empleadoEnEdicionIdx === null) {
            resetFormularioEmpleado();
            document.getElementById('titulo-form-empleado').innerText = 'Registrar Empleado';
            document.getElementById('texto-btn-guardar-empleado').innerText = 'Registrar Empleado';
        }
        mostrarSubvistaEmpleados('registrar');
    } else {
        poblarFiltroCargoEmpleados();
        aplicarFiltroEmpleados();
        renderizarStatsEmpleados();
        mostrarSubvistaEmpleados('historial');
    }
}

// Botón "Registrar Empleado" de la nómina: siempre arranca un alta nueva (limpia cualquier edición en curso).
function irARegistrarEmpleado() {
    empleadoEnEdicionIdx = null;
    resetFormularioEmpleado();
    document.getElementById('titulo-form-empleado').innerText = 'Registrar Empleado';
    document.getElementById('texto-btn-guardar-empleado').innerText = 'Registrar Empleado';
    if (window.location.hash !== '#registrar') window.location.hash = 'registrar'; else irASubvistaDesdeHashEmpleados();
}

function volverAlHistorialEmpleados() {
    empleadoEnEdicionIdx = null;
    if (window.location.hash !== '#historial') window.location.hash = 'historial'; else irASubvistaDesdeHashEmpleados();
}

// ==========================================
// VER DETALLE / EDITAR / ALTA-BAJA
// ==========================================
function construirFichaEmpleado(emp) {
    const fila = (etiqueta, valor) => `<div><p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">${etiqueta}</p><p class="text-slate-800">${valor ?? '-'}</p></div>`;
    return `
        <div class="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
                <h3 class="text-xl font-bold text-slate-900">${emp.nombreCompleto}</h3>
                <p class="text-xs text-slate-500 font-mono">${emp.legajo}</p>
            </div>
            <span class="${emp.estado_activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'} px-2.5 py-1 rounded-full text-xs font-semibold">${emp.estado_activo ? 'Activo' : 'Inactivo'}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${fila('Documento', emp.documentoCompleto)}
            ${fila('Fecha de Nacimiento', emp.fecha_nacimiento)}
            ${fila('Dirección', emp.calleObj ? `${emp.calleObj.nombre} ${emp.altura}` : '-')}
            ${fila('Teléfonos', emp.telefonosCompletos.join(', ') || '-')}
            ${fila('Correo Electrónico', emp.email)}
            ${fila('Puesto de Trabajo', emp.cargo)}
            ${fila('Turno', emp.turno)}
            ${fila('Fecha de Alta', emp.fecha_alta)}
            ${fila('Fecha de Ingreso', emp.fecha_ingreso)}
            ${fila('Sueldo Básico', `$ ${emp.sueldo.toLocaleString()}`)}
        </div>`;
}

function verEmpleadoDetalle(idx) {
    const emp = listaEmpleados[idx];
    if (!emp) return;
    document.getElementById('area-detalle-empleado').innerHTML = construirFichaEmpleado(emp);
    document.getElementById('btn-editar-desde-detalle-empleado').onclick = () => editarEmpleado(idx);
    mostrarSubvistaEmpleados('detalle');
    lucide.createIcons();
}

function editarEmpleado(idx) {
    const emp = listaEmpleados[idx];
    if (!emp) return;
    empleadoEnEdicionIdx = idx;

    document.getElementById('emp-nombre').value = emp.nombre || '';
    document.getElementById('emp-apellido').value = emp.apellido || '';
    document.getElementById('emp-tipo-documento').value = emp.tipo_documento;
    document.getElementById('emp-numero-documento').value = emp.numero_documento || '';
    document.getElementById('emp-fecha-nacimiento').value = emp.fecha_nacimiento || '';
    precargarUbicacionCascada('emp', emp.calleObj);
    document.getElementById('emp-altura').value = emp.altura || '';
    document.getElementById('emp-telefono').value = emp.telefono || '';
    precargarTelefonosAdicionales('emp', emp.telefonos_adicionales);
    document.getElementById('emp-email').value = emp.email || '';
    document.getElementById('emp-cargo').value = emp.cargo;
    document.getElementById('emp-turno').value = emp.turno;
    document.getElementById('emp-fecha-alta').value = emp.fecha_alta || '';
    document.getElementById('emp-fecha').value = emp.fecha_ingreso || '';
    document.getElementById('emp-sueldo').value = emp.sueldo || 0;

    document.getElementById('titulo-form-empleado').innerText = 'Editar Empleado';
    document.getElementById('texto-btn-guardar-empleado').innerText = 'Guardar Cambios';
    if (window.location.hash !== '#registrar') window.location.hash = 'registrar'; else mostrarSubvistaEmpleados('registrar');
}

// Alta/Baja: acción exclusiva del listado y del detalle, igual patrón que Proveedores.
function toggleEstadoEmpleado(idx) {
    const emp = listaEmpleados[idx];
    if (!emp) return;
    emp.estado_activo = !emp.estado_activo;
    guardarDatos();
    aplicarFiltroEmpleados();
}

function renderizarStatsEmpleados() {
    const total = listaEmpleados.length;
    const masaSalarial = listaEmpleados.reduce((acc, emp) => acc + (emp.sueldo || 0), 0);
    const sueldoPromedio = total ? masaSalarial / total : 0;
    const cargosDistintos = new Set(listaEmpleados.map(emp => emp.cargo).filter(Boolean)).size;
    const anioActual = new Date().getFullYear();
    const altasEsteAnio = listaEmpleados.filter(emp => emp.fecha_ingreso && new Date(emp.fecha_ingreso).getFullYear() === anioActual).length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('kpi-empleados-total', total);
    set('kpi-empleados-masa-salarial', `$ ${masaSalarial.toLocaleString()}`);
    set('kpi-empleados-sueldo-promedio', `$ ${Math.round(sueldoPromedio).toLocaleString()}`);
    set('kpi-empleados-cargos', cargosDistintos);
    set('kpi-empleados-altas-anio', altasEsteAnio);
}

function renderizarTablaEmpleados(lista) {
    const tbody = document.getElementById('tabla-lista-empleados');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-slate-400">No se encontraron empleados con ese criterio.</td></tr>`;
        return;
    }

    lista.forEach(emp => {
        const idx = listaEmpleados.indexOf(emp);
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="px-6 py-3 font-mono text-slate-500">${emp.legajo}</td>
            <td class="px-6 py-3 font-semibold text-slate-800">${emp.nombre}</td>
            <td class="px-6 py-3">${emp.apellido}</td>
            <td class="px-6 py-3 font-mono">${emp.documentoCompleto}</td>
            <td class="px-6 py-3"><span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium whitespace-nowrap">${emp.cargo}</span></td>
            <td class="px-6 py-3 whitespace-nowrap">${emp.turno || '-'}</td>
            <td class="px-6 py-3">${badgeTelefonos(emp)}</td>
            <td class="px-6 py-3 text-slate-600">${emp.email || '-'}</td>
            <td class="px-6 py-3 whitespace-nowrap">${emp.fecha_nacimiento || '-'}</td>
            <td class="px-6 py-3 whitespace-nowrap">${emp.fecha_alta || '-'}</td>
            <td class="px-6 py-3 whitespace-nowrap">${emp.fecha_ingreso || '-'}</td>
            <td class="px-6 py-3 text-right font-medium text-slate-900 whitespace-nowrap">$ ${emp.sueldo.toLocaleString()}</td>
            <td class="px-6 py-3 text-center"><span class="${emp.estado_activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'} px-2 py-0.5 rounded-full font-medium whitespace-nowrap">${emp.estado_activo ? 'Activo' : 'Inactivo'}</span></td>
            <td class="px-6 py-3">
                <div class="flex items-center gap-1.5">
                    <button type="button" onclick="verEmpleadoDetalle(${idx})" title="Ver detalle" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    <button type="button" onclick="editarEmpleado(${idx})" title="Editar empleado" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    <button type="button" onclick="toggleEstadoEmpleado(${idx})" title="${emp.estado_activo ? 'Dar de baja' : 'Dar de alta'}" class="p-2 rounded-lg ${emp.estado_activo ? 'text-slate-500 hover:bg-red-50 hover:text-red-600' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'} transition"><i data-lucide="${emp.estado_activo ? 'power-off' : 'power'}" class="w-4 h-4"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function poblarFiltroCargoEmpleados() {
    const cont = document.getElementById('pop-emp-cargo');
    if (!cont) return;
    const cargosUnicos = [...new Set(listaEmpleados.map(emp => emp.cargo).filter(Boolean))].sort();
    cont.innerHTML = `<button type="button" onclick="elegirFiltroEmpCargo('')" class="opcion-filtro-emp-cargo block w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-slate-100" data-valor="">Todos los cargos</button>` +
        cargosUnicos.map(c => `<button type="button" onclick="elegirFiltroEmpCargo('${c.replace(/'/g, "\\'")}')" class="opcion-filtro-emp-cargo block w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-slate-100" data-valor="${c}">${c}</button>`).join('');
}

function aplicarFiltroEmpleados() {
    const terminoLegajo = normalizarTexto(document.getElementById('buscar-emp-legajo')?.value || '').trim();
    const terminoNombre = normalizarTexto(document.getElementById('buscar-emp-nombre')?.value || '').trim();
    const terminoApellido = normalizarTexto(document.getElementById('buscar-emp-apellido')?.value || '').trim();

    let filtrados = listaEmpleados.filter(emp =>
        (!terminoLegajo || normalizarTexto(emp.legajo).includes(terminoLegajo)) &&
        (!terminoNombre || normalizarTexto(emp.nombre).includes(terminoNombre)) &&
        (!terminoApellido || normalizarTexto(emp.apellido).includes(terminoApellido)) &&
        (!filtroEmpCargoSeleccionado || emp.cargo === filtroEmpCargoSeleccionado) &&
        (!filtroEmpTurnoSeleccionado || emp.turno === filtroEmpTurnoSeleccionado) &&
        (!filtroEmpEstadoSeleccionado || (filtroEmpEstadoSeleccionado === 'activo' ? emp.estado_activo : !emp.estado_activo))
    );

    if (ordenEmpleadosCampo && ordenEmpleadosDireccion) {
        filtrados = [...filtrados].sort((a, b) => {
            const va = a[ordenEmpleadosCampo] || '';
            const vb = b[ordenEmpleadosCampo] || '';
            const cmp = va.localeCompare(vb, 'es');
            return ordenEmpleadosDireccion === 'asc' ? cmp : -cmp;
        });
    }

    actualizarIconosOrdenEmpleados();
    actualizarIconoFiltroEmp('btn-filtro-emp-cargo', 'opcion-filtro-emp-cargo', filtroEmpCargoSeleccionado);
    actualizarIconoFiltroEmp('btn-filtro-emp-turno', 'opcion-filtro-emp-turno', filtroEmpTurnoSeleccionado);
    actualizarIconoFiltroEmp('btn-filtro-emp-estado', 'opcion-filtro-emp-estado', filtroEmpEstadoSeleccionado);
    renderizarTablaEmpleados(filtrados);
}

function alternarOrdenEmpleados(campo) {
    if (ordenEmpleadosCampo !== campo) { ordenEmpleadosCampo = campo; ordenEmpleadosDireccion = 'asc'; }
    else if (ordenEmpleadosDireccion === 'asc') { ordenEmpleadosDireccion = 'desc'; }
    else { ordenEmpleadosCampo = null; ordenEmpleadosDireccion = null; }
    aplicarFiltroEmpleados();
}

function actualizarIconosOrdenEmpleados() {
    ['nombre', 'apellido'].forEach(campo => {
        const boton = document.getElementById(`btn-orden-emp-${campo}`);
        if (!boton) return;
        const activo = ordenEmpleadosCampo === campo;
        const icono = activo && ordenEmpleadosDireccion === 'asc' ? 'arrow-up' : activo && ordenEmpleadosDireccion === 'desc' ? 'arrow-down' : 'arrow-up-down';
        boton.className = `normal-case transition ${activo ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
        boton.innerHTML = `<i data-lucide="${icono}" class="w-3.5 h-3.5"></i>`;
    });
    lucide.createIcons();
}

function actualizarIconoFiltroEmp(idBoton, claseOpciones, valorSeleccionado) {
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

function elegirFiltroEmpCargo(valor) { filtroEmpCargoSeleccionado = valor; document.getElementById('pop-emp-cargo').classList.add('hidden'); aplicarFiltroEmpleados(); }
function elegirFiltroEmpTurno(valor) { filtroEmpTurnoSeleccionado = valor; document.getElementById('pop-emp-turno').classList.add('hidden'); aplicarFiltroEmpleados(); }
function elegirFiltroEmpEstado(valor) { filtroEmpEstadoSeleccionado = valor; document.getElementById('pop-emp-estado').classList.add('hidden'); aplicarFiltroEmpleados(); }

function guardarNuevoEmpleado() {
    const nombre = document.getElementById('emp-nombre').value.trim();
    const apellido = document.getElementById('emp-apellido').value.trim();
    const tipoDocumento = document.getElementById('emp-tipo-documento').value;
    const numeroDocumento = document.getElementById('emp-numero-documento').value.trim();
    const fechaNacimiento = document.getElementById('emp-fecha-nacimiento').value;
    const calleObj = obtenerCalleSeleccionada('emp');
    const provincia = document.getElementById('emp-provincia').value;
    const localidad = document.getElementById('emp-localidad').value;
    const altura = document.getElementById('emp-altura').value.trim();
    const telefono = document.getElementById('emp-telefono').value.trim();
    const telefonosAdicionales = obtenerTelefonosAdicionales('emp');
    const email = document.getElementById('emp-email').value.trim();
    const cargo = document.getElementById('emp-cargo').value;
    const turno = document.getElementById('emp-turno').value;
    const fecha = document.getElementById('emp-fecha').value;
    const fechaAlta = document.getElementById('emp-fecha-alta').value;
    const sueldo = parseFloat(document.getElementById('emp-sueldo').value) || 0;

    // Todos los campos del empleado son estrictamente obligatorios.
    if (!nombre || !apellido || !numeroDocumento || !fechaNacimiento) {
        alert('Por favor complete Nombre, Apellido, Documento y Fecha de Nacimiento del empleado.');
        return;
    }
    if (!provincia || !localidad || !calleObj || !altura) {
        alert('Por favor complete Provincia, Localidad, Calle y Altura.');
        return;
    }
    if (!telefono) { alert('Por favor complete el Teléfono.'); return; }
    if (!email) { alert('Por favor complete el Correo Electrónico.'); return; }
    if (!turno) { alert('Por favor seleccione el Turno.'); return; }
    if (!fechaAlta) { alert('Por favor seleccione la Fecha de Alta.'); return; }
    if (!fecha) { alert('Por favor seleccione la Fecha de Ingreso.'); return; }
    if (!sueldo) { alert('Por favor complete el Sueldo Básico.'); return; }

    if (empleadoEnEdicionIdx !== null) {
        const emp = listaEmpleados[empleadoEnEdicionIdx];
        Object.assign(emp, { nombre, apellido, tipo_documento: tipoDocumento, numero_documento: numeroDocumento, fecha_nacimiento: fechaNacimiento, calleObj, altura, telefono, telefonos_adicionales: telefonosAdicionales, email, cargo, turno, fecha_ingreso: fecha, sueldo, fecha_alta: fechaAlta });
        guardarDatos();
        empleadoEnEdicionIdx = null;
        renderizarEmpleadosUI();
        alert(`¡Empleado "${emp.nombreCompleto}" actualizado con éxito!`);
        volverAlHistorialEmpleados();
        return;
    }

    const legajo = `EMP-00${numEmpleadoContador++}`;
    const nuevoEmpleado = new Empleado(nombre, apellido, tipoDocumento, numeroDocumento, fechaNacimiento, calleObj, altura, telefono, email, legajo, cargo, fecha, sueldo, fechaAlta, turno, telefonosAdicionales);
    listaEmpleados.unshift(nuevoEmpleado);
    guardarDatos();

    renderizarEmpleadosUI();
    alert(`¡Empleado "${nombre} ${apellido}" registrado con éxito bajo legajo ${legajo}!`);
    volverAlHistorialEmpleados();
}

function resetFormularioEmpleado() {
    document.getElementById('emp-nombre').value = '';
    document.getElementById('emp-apellido').value = '';
    document.getElementById('emp-numero-documento').value = '';
    document.getElementById('emp-fecha-nacimiento').value = '';
    document.getElementById('emp-altura').value = '';
    document.getElementById('emp-telefono').value = '';
    limpiarCamposTelefono('emp');
    document.getElementById('emp-email').value = '';
    document.getElementById('emp-fecha').value = '';
    document.getElementById('emp-fecha-alta').value = new Date().toISOString().slice(0, 10);
    document.getElementById('emp-sueldo').value = 400000;
}

function initPaginaEmpleados() {
    inicializarCombosUbicacion();
    resetFormularioEmpleado();
    renderizarEmpleadosUI();
    irASubvistaDesdeHashEmpleados();
    window.addEventListener('hashchange', irASubvistaDesdeHashEmpleados);
}
