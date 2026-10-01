// ==========================================
// MÓDULO DE EMPLEADOS
// ==========================================
function mostrarSubvistaEmpleados(subvista) {
    document.getElementById('vista-listado-empleados').classList.add('hidden');
    document.getElementById('vista-cargar-empleado').classList.add('hidden');
    if (subvista === 'listado') document.getElementById('vista-listado-empleados').classList.remove('hidden');
    if (subvista === 'cargar-empleado') document.getElementById('vista-cargar-empleado').classList.remove('hidden');
}

function renderizarTablaEmpleados(lista) {
    const tbody = document.getElementById('tabla-lista-empleados');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-400">No se encontraron empleados con ese criterio.</td></tr>`;
        return;
    }

    lista.forEach(emp => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-slate-900">${emp.legajo}</td>
            <td class="p-3 font-semibold text-slate-800">${emp.nombreCompleto}</td>
            <td class="p-3 font-mono">${emp.documentoCompleto}</td>
            <td class="p-3"><span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">${emp.cargo}</span></td>
            <td class="p-3">${emp.direccionCompleta}</td>
            <td class="p-3">${emp.telefono || '-'}</td>
            <td class="p-3 text-slate-600">${emp.email || '-'}</td>
            <td class="p-3">${emp.fecha_nacimiento || '-'}</td>
            <td class="p-3">${emp.fecha_ingreso || '-'}</td>
            <td class="p-3 text-right font-medium text-slate-900">$ ${emp.sueldo.toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
    });
}

function poblarFiltroCargoEmpleados() {
    const select = document.getElementById('filtro-empleado-cargo');
    if (!select) return;
    const seleccionActual = select.value;
    const cargosUnicos = [...new Set(listaEmpleados.map(emp => emp.cargo).filter(Boolean))].sort();

    select.innerHTML = '<option value="">Todos los cargos</option>' +
        cargosUnicos.map(c => `<option value="${c}">${c}</option>`).join('');
    select.value = cargosUnicos.includes(seleccionActual) ? seleccionActual : '';
}

function aplicarFiltroEmpleados() {
    const termino = normalizarTexto(document.getElementById('buscar-empleado')?.value || '').trim();
    const cargo = document.getElementById('filtro-empleado-cargo')?.value || '';

    const filtrados = listaEmpleados.filter(emp =>
        (!termino || normalizarTexto(emp.nombreCompleto).includes(termino) || normalizarTexto(emp.legajo).includes(termino) || normalizarTexto(emp.numero_documento).includes(termino)) &&
        (!cargo || emp.cargo === cargo)
    );
    renderizarTablaEmpleados(filtrados);
}

function guardarNuevoEmpleado() {
    const nombre = document.getElementById('emp-nombre').value.trim();
    const apellido = document.getElementById('emp-apellido').value.trim();
    const tipoDocumento = document.getElementById('emp-tipo-documento').value;
    const numeroDocumento = document.getElementById('emp-numero-documento').value.trim();
    const fechaNacimiento = document.getElementById('emp-fecha-nacimiento').value;
    const calleObj = obtenerCalleSeleccionada('emp');
    const altura = document.getElementById('emp-altura').value.trim();
    const telefono = document.getElementById('emp-telefono').value.trim();
    const email = document.getElementById('emp-email').value.trim();
    const cargo = document.getElementById('emp-cargo').value;
    const fecha = document.getElementById('emp-fecha').value || '2026-09-10';
    const sueldo = parseFloat(document.getElementById('emp-sueldo').value) || 0;

    if (!nombre || !apellido || !numeroDocumento || !fechaNacimiento) {
        alert('Por favor complete Nombre, Apellido, Documento y Fecha de Nacimiento del empleado.');
        return;
    }

    const legajo = `EMP-00${numEmpleadoContador++}`;
    const nuevoEmpleado = new Empleado(nombre, apellido, tipoDocumento, numeroDocumento, fechaNacimiento, calleObj, altura, telefono, email, legajo, cargo, fecha, sueldo);
    listaEmpleados.unshift(nuevoEmpleado);
    guardarDatos();

    renderizarEmpleadosUI();
    poblarFiltroCargoEmpleados();
    aplicarFiltroEmpleados();
    alert(`¡Empleado "${nombre} ${apellido}" registrado con éxito bajo legajo ${legajo}!`);
    mostrarSubvistaEmpleados('listado');
}

function initPaginaEmpleados() {
    inicializarCombosUbicacion();
    renderizarEmpleadosUI();
    poblarFiltroCargoEmpleados();
    aplicarFiltroEmpleados();
}
