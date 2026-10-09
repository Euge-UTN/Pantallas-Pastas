// ==========================================
// MÓDULO DE PROVEEDORES
// ==========================================
const SUBVISTAS_PROVEEDORES = ['historial', 'registrar'];
let ordenProveedoresCampo = null; // 'razon_social' | null
let ordenProveedoresDireccion = null;
let filtroProvIvaSeleccionado = '';
let filtroProvEstadoSeleccionado = '';

function mostrarSubvistaProveedores(subvista) {
    SUBVISTAS_PROVEEDORES.forEach(v => document.getElementById(`vista-${v}`).classList.add('hidden'));
    const vistaDestino = document.getElementById(`vista-${subvista}`);
    if (vistaDestino) vistaDestino.classList.remove('hidden');
}

function irASubvistaDesdeHashProveedores() {
    const hash = (window.location.hash || '').replace('#', '') || 'historial';
    if (hash === 'registrar') {
        mostrarSubvistaProveedores('registrar');
    } else {
        aplicarFiltroProveedores();
        renderizarStatsProveedores();
        mostrarSubvistaProveedores('historial');
    }
}

function irARegistrarProveedor() {
    if (window.location.hash !== '#registrar') window.location.hash = 'registrar'; else irASubvistaDesdeHashProveedores();
}

function volverAlHistorialProveedores() {
    if (window.location.hash !== '#historial') window.location.hash = 'historial'; else irASubvistaDesdeHashProveedores();
}

function renderizarTablaProveedores(lista) {
    const tbody = document.getElementById('tabla-lista-proveedores');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-slate-400">No se encontraron proveedores con ese criterio.</td></tr>`;
        return;
    }

    lista.forEach(prov => {
        const idx = listaProveedores.indexOf(prov);
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="px-6 py-3 font-semibold text-slate-800">${prov.nombreMostrado}</td>
            <td class="px-6 py-3 font-mono">${prov.documentoCompleto}</td>
            <td class="px-6 py-3">${prov.rubro || '-'}</td>
            <td class="px-6 py-3 whitespace-nowrap">${prov.condicion_iva}</td>
            <td class="px-6 py-3 whitespace-nowrap">${prov.fecha_alta || '-'}</td>
            <td class="px-6 py-3 whitespace-nowrap">${prov.tiempo_entrega_estimado || '-'}</td>
            <td class="px-6 py-3">${badgeTelefonos(prov)}</td>
            <td class="px-6 py-3 text-slate-600">${prov.email || '-'}</td>
            <td class="px-6 py-3 text-center"><span class="${prov.estado_activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'} px-2 py-0.5 rounded-full font-medium whitespace-nowrap">${prov.estado_activo ? 'Activo' : 'Inactivo'}</span></td>
            <td class="px-6 py-3">
                <button onclick="toggleEstadoProveedor(${idx})" title="${prov.estado_activo ? 'Desactivar proveedor' : 'Activar proveedor'}" class="p-2 rounded-lg ${prov.estado_activo ? 'text-slate-500 hover:bg-red-50 hover:text-red-600' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'} transition"><i data-lucide="${prov.estado_activo ? 'power-off' : 'power'}" class="w-4 h-4"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

// Activar/Desactivar queda únicamente como acción del Historial (el checkbox se quitó del formulario de alta).
function toggleEstadoProveedor(idx) {
    const prov = listaProveedores[idx];
    if (!prov) return;
    prov.estado_activo = !prov.estado_activo;
    guardarDatos();
    aplicarFiltroProveedores();
}

function renderizarStatsProveedores() {
    const total = listaProveedores.length;
    const responsableInscripto = listaProveedores.filter(p => p.condicion_iva === 'Responsable Inscripto').length;
    const monotributo = listaProveedores.filter(p => p.condicion_iva === 'Monotributo').length;
    const exento = listaProveedores.filter(p => p.condicion_iva === 'Exento').length;
    const rubrosDistintos = new Set(listaProveedores.filter(p => p.rubro && p.rubro.trim()).map(p => p.rubro.trim().toLowerCase())).size;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('kpi-prov-total', total);
    set('kpi-prov-responsable-inscripto', responsableInscripto);
    set('kpi-prov-monotributo', monotributo);
    set('kpi-prov-exento', exento);
    set('kpi-prov-rubros', rubrosDistintos);
}

function aplicarFiltroProveedores() {
    const terminoRazon = normalizarTexto(document.getElementById('buscar-prov-razon')?.value || '').trim();
    const terminoDocumento = normalizarTexto(document.getElementById('buscar-prov-documento')?.value || '').trim();

    let filtrados = listaProveedores.filter(prov =>
        (!terminoRazon || normalizarTexto(prov.nombreMostrado).includes(terminoRazon)) &&
        (!terminoDocumento || normalizarTexto(prov.numero_documento).includes(terminoDocumento)) &&
        (!filtroProvIvaSeleccionado || prov.condicion_iva === filtroProvIvaSeleccionado) &&
        (!filtroProvEstadoSeleccionado || (filtroProvEstadoSeleccionado === 'activo' ? prov.estado_activo : !prov.estado_activo))
    );

    if (ordenProveedoresCampo && ordenProveedoresDireccion) {
        filtrados = [...filtrados].sort((a, b) => {
            const va = a.nombreMostrado || '';
            const vb = b.nombreMostrado || '';
            const cmp = va.localeCompare(vb, 'es');
            return ordenProveedoresDireccion === 'asc' ? cmp : -cmp;
        });
    }

    actualizarIconoOrdenProveedores();
    actualizarIconoFiltroProv('btn-filtro-prov-iva', 'opcion-filtro-prov-iva', filtroProvIvaSeleccionado);
    actualizarIconoFiltroProv('btn-filtro-prov-estado', 'opcion-filtro-prov-estado', filtroProvEstadoSeleccionado);
    renderizarTablaProveedores(filtrados);
}

function alternarOrdenProveedores(campo) {
    if (ordenProveedoresCampo !== campo) { ordenProveedoresCampo = campo; ordenProveedoresDireccion = 'asc'; }
    else if (ordenProveedoresDireccion === 'asc') { ordenProveedoresDireccion = 'desc'; }
    else { ordenProveedoresCampo = null; ordenProveedoresDireccion = null; }
    aplicarFiltroProveedores();
}

function actualizarIconoOrdenProveedores() {
    const boton = document.getElementById('btn-orden-prov-razon');
    if (!boton) return;
    const activo = !!ordenProveedoresCampo;
    const icono = activo && ordenProveedoresDireccion === 'asc' ? 'arrow-up' : activo && ordenProveedoresDireccion === 'desc' ? 'arrow-down' : 'arrow-up-down';
    boton.className = `normal-case transition ${activo ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    boton.innerHTML = `<i data-lucide="${icono}" class="w-3.5 h-3.5"></i>`;
    lucide.createIcons();
}

function actualizarIconoFiltroProv(idBoton, claseOpciones, valorSeleccionado) {
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

function elegirFiltroProvIva(valor) { filtroProvIvaSeleccionado = valor; document.getElementById('pop-prov-iva').classList.add('hidden'); aplicarFiltroProveedores(); }
function elegirFiltroProvEstado(valor) { filtroProvEstadoSeleccionado = valor; document.getElementById('pop-prov-estado').classList.add('hidden'); aplicarFiltroProveedores(); }

function guardarNuevoProveedor() {
    const razonSocial = document.getElementById('prov-razon-social').value.trim();
    const nombre = document.getElementById('prov-nombre').value.trim();
    const apellido = document.getElementById('prov-apellido').value.trim();
    const tipoDocumento = document.getElementById('prov-tipo-documento').value;
    const numeroDocumento = document.getElementById('prov-numero-documento').value.trim();
    const calleObj = obtenerCalleSeleccionada('prov');
    const provincia = document.getElementById('prov-provincia').value;
    const localidad = document.getElementById('prov-localidad').value;
    const altura = document.getElementById('prov-altura').value.trim();
    const telefono = document.getElementById('prov-telefono').value.trim();
    const telefonosAdicionales = obtenerTelefonosAdicionales('prov');
    const email = document.getElementById('prov-email').value.trim();
    const iva = document.getElementById('prov-iva').value;
    const rubro = document.getElementById('prov-rubro').value.trim();
    const fechaAlta = document.getElementById('prov-fecha-alta').value;
    const tiempoEntrega = document.getElementById('prov-tiempo-entrega').value.trim();

    if (!razonSocial || !numeroDocumento) {
        alert('Por favor complete el Nombre y el Número de Documento del proveedor.');
        return;
    }
    if (!provincia || !localidad || !calleObj || !altura) {
        alert('Por favor complete Provincia, Localidad, Calle y Altura.');
        return;
    }
    if (!telefono) { alert('Por favor complete el Teléfono.'); return; }
    if (!email) { alert('Por favor complete el Correo Electrónico.'); return; }
    if (!rubro) { alert('Por favor complete el Rubro.'); return; }
    if (!fechaAlta) { alert('Por favor seleccione la Fecha de Alta.'); return; }
    if (!tiempoEntrega) { alert('Por favor complete el Tiempo de Entrega Estimado.'); return; }

    // Un proveedor siempre se crea Activo; desactivarlo es una acción exclusiva del Historial.
    const nuevoProveedor = new Proveedor(nombre, apellido, tipoDocumento, numeroDocumento, calleObj, altura, telefono, email, iva, rubro, razonSocial, fechaAlta, tiempoEntrega, true, telefonosAdicionales);
    listaProveedores.unshift(nuevoProveedor);
    guardarDatos();

    renderizarProveedoresUI();
    alert(`¡Proveedor "${nuevoProveedor.nombreMostrado}" guardado con éxito!`);
    volverAlHistorialProveedores();
}

function resetFormularioProveedor() {
    document.getElementById('prov-razon-social').value = '';
    document.getElementById('prov-nombre').value = '';
    document.getElementById('prov-apellido').value = '';
    document.getElementById('prov-numero-documento').value = '';
    document.getElementById('prov-altura').value = '';
    document.getElementById('prov-telefono').value = '';
    limpiarCamposTelefono('prov');
    document.getElementById('prov-email').value = '';
    document.getElementById('prov-rubro').value = '';
    document.getElementById('prov-fecha-alta').value = new Date().toISOString().slice(0, 10);
    document.getElementById('prov-tiempo-entrega').value = '';
}

function initPaginaProveedores() {
    inicializarCombosUbicacion();
    resetFormularioProveedor();
    renderizarProveedoresUI();
    irASubvistaDesdeHashProveedores();
    window.addEventListener('hashchange', irASubvistaDesdeHashProveedores);
}
