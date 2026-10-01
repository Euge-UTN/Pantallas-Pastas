// ==========================================
// MÓDULO DE GESTIÓN DE CLIENTES
// ==========================================
function mostrarSubvistaClientes(subvista) {
    document.getElementById('vista-listado-clientes').classList.add('hidden');
    document.getElementById('vista-cargar-cliente').classList.add('hidden');
    if (subvista === 'listado') document.getElementById('vista-listado-clientes').classList.remove('hidden');
    if (subvista === 'cargar-cliente') document.getElementById('vista-cargar-cliente').classList.remove('hidden');
}

function renderizarTablaClientes(lista) {
    const tbody = document.getElementById('tabla-lista-clientes');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400">No se encontraron clientes con ese criterio.</td></tr>`;
        return;
    }

    lista.forEach(cli => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="p-3 font-semibold text-slate-800">${cli.nombreMostrado}</td>
            <td class="p-3 font-mono">${cli.documentoCompleto}</td>
            <td class="p-3"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">${cli.tipo_cliente}</span></td>
            <td class="p-3">${cli.direccionCompleta}</td>
            <td class="p-3">${cli.telefono || '-'}</td>
            <td class="p-3 text-slate-600">${cli.email || '-'}</td>
            <td class="p-3">${cli.condicion_iva}</td>
            <td class="p-3 text-right font-medium text-slate-900">$ ${cli.limite_credito.toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
    });
}

function aplicarFiltroClientes() {
    const termino = normalizarTexto(document.getElementById('buscar-cliente')?.value || '').trim();
    const tipo = document.getElementById('filtro-cliente-tipo')?.value || '';

    const filtrados = listaClientes.filter(cli =>
        (!termino || normalizarTexto(cli.nombreMostrado).includes(termino) || normalizarTexto(cli.numero_documento).includes(termino)) &&
        (!tipo || cli.tipo_cliente === tipo)
    );
    renderizarTablaClientes(filtrados);
}

function guardarNuevoCliente() {
    const nombre = document.getElementById('cli-nombre').value.trim();
    const apellido = document.getElementById('cli-apellido').value.trim();
    const razonSocial = document.getElementById('cli-razon-social').value.trim();
    const tipoDocumento = document.getElementById('cli-tipo-documento').value;
    const numeroDocumento = document.getElementById('cli-numero-documento').value.trim();
    const calleObj = obtenerCalleSeleccionada('cli');
    const altura = document.getElementById('cli-altura').value.trim();
    const telefono = document.getElementById('cli-telefono').value.trim();
    const email = document.getElementById('cli-email').value.trim();
    const iva = document.getElementById('cli-iva').value;
    const tipo = document.getElementById('cli-tipo').value;
    const limite = parseFloat(document.getElementById('cli-limite').value) || 0;

    if (!nombre || !apellido || !numeroDocumento) {
        alert('Por favor complete Nombre, Apellido y Número de Documento del cliente.');
        return;
    }

    const nuevoCliente = new Cliente(nombre, apellido, tipoDocumento, numeroDocumento, calleObj, altura, telefono, email, iva, tipo, limite, razonSocial);
    listaClientes.unshift(nuevoCliente);
    guardarDatos();

    renderizarClientesUI();
    aplicarFiltroClientes();
    alert(`¡Cliente "${nuevoCliente.nombreMostrado}" guardado con éxito!`);
    mostrarSubvistaClientes('listado');
}

function initPaginaClientes() {
    inicializarCombosUbicacion();
    renderizarClientesUI();
    aplicarFiltroClientes();
}
