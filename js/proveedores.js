// ==========================================
// MÓDULO DE PROVEEDORES
// ==========================================
function mostrarSubvistaProveedores(subvista) {
    document.getElementById('vista-listado-proveedores').classList.add('hidden');
    document.getElementById('vista-cargar-proveedor').classList.add('hidden');
    if (subvista === 'listado') document.getElementById('vista-listado-proveedores').classList.remove('hidden');
    if (subvista === 'cargar-proveedor') document.getElementById('vista-cargar-proveedor').classList.remove('hidden');
}

function renderizarTablaProveedores(lista) {
    const tbody = document.getElementById('tabla-lista-proveedores');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400">No se encontraron proveedores con ese criterio.</td></tr>`;
        return;
    }

    lista.forEach(prov => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="p-3 font-semibold text-slate-800">${prov.nombreMostrado}</td>
            <td class="p-3 font-mono">${prov.documentoCompleto}</td>
            <td class="p-3">${prov.rubro || '-'}</td>
            <td class="p-3">${prov.direccionCompleta}</td>
            <td class="p-3">${prov.telefono || '-'}</td>
            <td class="p-3 text-slate-600">${prov.email || '-'}</td>
            <td class="p-3">${prov.condicion_iva}</td>
            <td class="p-3 text-center"><span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">Activo</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function aplicarFiltroProveedores() {
    const termino = normalizarTexto(document.getElementById('buscar-proveedor')?.value || '').trim();
    const iva = document.getElementById('filtro-proveedor-iva')?.value || '';

    const filtrados = listaProveedores.filter(prov =>
        (!termino || normalizarTexto(prov.nombreMostrado).includes(termino) || normalizarTexto(prov.numero_documento).includes(termino) || normalizarTexto(prov.rubro).includes(termino)) &&
        (!iva || prov.condicion_iva === iva)
    );
    renderizarTablaProveedores(filtrados);
}

function guardarNuevoProveedor() {
    const razonSocial = document.getElementById('prov-razon-social').value.trim();
    const nombre = document.getElementById('prov-nombre').value.trim();
    const apellido = document.getElementById('prov-apellido').value.trim();
    const tipoDocumento = document.getElementById('prov-tipo-documento').value;
    const numeroDocumento = document.getElementById('prov-numero-documento').value.trim();
    const calleObj = obtenerCalleSeleccionada('prov');
    const altura = document.getElementById('prov-altura').value.trim();
    const telefono = document.getElementById('prov-telefono').value.trim();
    const email = document.getElementById('prov-email').value.trim();
    const iva = document.getElementById('prov-iva').value;
    const rubro = document.getElementById('prov-rubro').value.trim();

    if (!razonSocial || !numeroDocumento) {
        alert('Por favor complete la Razón Social y el Número de Documento del proveedor.');
        return;
    }

    const nuevoProveedor = new Proveedor(nombre, apellido, tipoDocumento, numeroDocumento, calleObj, altura, telefono, email, iva, rubro, razonSocial);
    listaProveedores.unshift(nuevoProveedor);
    guardarDatos();

    renderizarProveedoresUI();
    aplicarFiltroProveedores();
    alert(`¡Proveedor "${nuevoProveedor.nombreMostrado}" guardado con éxito!`);
    mostrarSubvistaProveedores('listado');
}

function initPaginaProveedores() {
    inicializarCombosUbicacion();
    renderizarProveedoresUI();
    aplicarFiltroProveedores();
}
