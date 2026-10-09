// ==========================================
// MÓDULO DE VENTAS
// ==========================================
let itemsPedidoActual = [];
let clienteSeleccionadoPedido = null;
let pedidoEnEdicionId = null;
let ordenHistorialCampo = null; // 'nombre' | 'apellido' | null
let ordenHistorialDireccion = null; // null | 'asc' | 'desc'
let filtroPedidoTipoSeleccionado = '';
let filtroPedidoTipoDocSeleccionado = '';
let filtroPedidoEstadoSeleccionado = '';
let segmentoPedidoSeleccionado = ''; // '' | 'Evento' | 'Donacion' — filtro externo a la tabla, fuera de la columna Tipo Cliente

const SUBVISTAS_VENTAS = ['dashboard', 'nuevo-pedido', 'presupuesto', 'detalle-pedido', 'comprobante-venta', 'presupuestos', 'registrar-presupuesto', 'comprobantes-venta', 'comprobante-venta-detalle'];
function mostrarSubvistaVentas(subvista) {
    SUBVISTAS_VENTAS.forEach(v => document.getElementById(`vista-${v}`).classList.add('hidden'));
    const vistaDestino = document.getElementById(`vista-${subvista}`);
    if (vistaDestino) vistaDestino.classList.remove('hidden');
}

// Navegación por hash: sincroniza el sub-menú del sidebar (#dashboard / #registrar / #presupuestos / #registrar-presupuesto) con la subvista mostrada.
function irASubvistaDesdeHash() {
    const hash = (window.location.hash || '').replace('#', '') || 'dashboard';
    if (hash === 'registrar') {
        if (!pedidoEnEdicionId && !presupuestoEnConversionId) resetFormularioPedido();
        mostrarSubvistaVentas('nuevo-pedido');
    } else if (hash === 'presupuestos') {
        renderizarTablaPresupuestos();
        mostrarSubvistaVentas('presupuestos');
    } else if (hash === 'registrar-presupuesto') {
        if (!presupuestoEnEdicionId) resetFormularioPresupuesto();
        mostrarSubvistaVentas('registrar-presupuesto');
    } else if (hash === 'comprobantes-venta') {
        renderizarTablaComprobantesVenta();
        mostrarSubvistaVentas('comprobantes-venta');
    } else {
        pedidoEnEdicionId = null;
        mostrarSubvistaVentas('dashboard');
    }
}

function irARegistrarPedido() {
    resetFormularioPedido();
    mostrarSubvistaVentas('nuevo-pedido');
    if (window.location.hash !== '#registrar') window.location.hash = 'registrar';
}

function volverAlListadoVentas() {
    resetFormularioPedido();
    renderizarTablaPedidosRegistrados();
    mostrarSubvistaVentas('dashboard');
    if (window.location.hash !== '#dashboard') window.location.hash = 'dashboard';
}

// ==========================================
// COMPROBANTES DE VENTA (listado histórico + detalle de solo lectura)
// ==========================================
let ordenCVCampo = null;
let ordenCVDireccion = null;
let filtroCVTipoSeleccionado = '';
let filtroCVTipoDocSeleccionado = '';
let filtroCVEstadoSeleccionado = '';
let segmentoCVSeleccionado = ''; // '' | 'Evento' | 'Donacion' — filtro externo a la tabla, fuera de la columna Tipo Cliente

function renderizarTablaComprobantesVenta() {
    const tbody = document.getElementById('tabla-comprobantes-venta');
    tbody.innerHTML = '';

    const comprobantesVenta = listaComprobantesVenta.map(cv => ({ cv, estado: estadoComprobanteVenta(cv) }));
    document.getElementById('kpi-cv-total').innerText = comprobantesVenta.length;
    document.getElementById('kpi-cv-pendientes').innerText = comprobantesVenta.filter(f => f.estado === 'Pendiente').length;
    document.getElementById('kpi-cv-cobrados').innerText = comprobantesVenta.filter(f => f.estado === 'Cobrada').length;
    document.getElementById('kpi-cv-anulados').innerText = comprobantesVenta.filter(f => f.estado === 'Anulada').length;
    document.getElementById('kpi-cv-total-monto').innerText = `$ ${comprobantesVenta.filter(f => !f.cv.es_anulado).reduce((a, f) => a + f.cv.total, 0).toLocaleString()}`;
    document.getElementById('kpi-cv-pendiente-monto').innerText = `$ ${comprobantesVenta.filter(f => f.estado === 'Pendiente').reduce((a, f) => a + f.cv.total, 0).toLocaleString()}`;

    const terminoNum = normalizarTexto(document.getElementById('buscar-num-cv')?.value || '').trim();
    const terminoNombre = normalizarTexto(document.getElementById('buscar-nombre-cv')?.value || '').trim();
    const terminoApellido = normalizarTexto(document.getElementById('buscar-apellido-cv')?.value || '').trim();
    const terminoDocumento = normalizarTexto(document.getElementById('buscar-documento-cv')?.value || '').trim();

    let filtradas = comprobantesVenta.filter(({ cv, estado }) => {
        const nombre = cv.clienteObj ? cv.clienteObj.nombre : '';
        const apellido = cv.clienteObj ? cv.clienteObj.apellido : '';
        const documento = cv.clienteObj ? cv.clienteObj.numero_documento : '';
        const tipoDocumento = cv.clienteObj ? cv.clienteObj.tipo_documento : '';
        const tipoCliente = cv.clienteObj ? cv.clienteObj.tipo_cliente : '';
        return (!terminoNum || String(cv.id_comprobante_venta_cliente).includes(terminoNum)) &&
            (!terminoNombre || normalizarTexto(nombre).includes(terminoNombre)) &&
            (!terminoApellido || normalizarTexto(apellido).includes(terminoApellido)) &&
            (!terminoDocumento || normalizarTexto(documento).includes(terminoDocumento)) &&
            (!filtroCVTipoDocSeleccionado || tipoDocumento === filtroCVTipoDocSeleccionado) &&
            (!filtroCVEstadoSeleccionado || estado === filtroCVEstadoSeleccionado) &&
            (!filtroCVTipoSeleccionado || tipoCliente === filtroCVTipoSeleccionado) &&
            (!segmentoCVSeleccionado || (segmentoCVSeleccionado === 'Evento' ? cv.esEvento : cv.esDonacion));
    });

    if (ordenCVCampo && ordenCVDireccion) {
        filtradas.sort((a, b) => {
            const va = (a.cv.clienteObj ? a.cv.clienteObj[ordenCVCampo] : '') || '';
            const vb = (b.cv.clienteObj ? b.cv.clienteObj[ordenCVCampo] : '') || '';
            const cmp = va.localeCompare(vb, 'es');
            return ordenCVDireccion === 'asc' ? cmp : -cmp;
        });
    }
    actualizarIconosOrdenComprobantesVenta();
    actualizarIconoFiltroTipoComprobantesVenta();
    actualizarIconoFiltroTipoDocComprobantesVenta();
    actualizarIconoFiltroEstadoComprobantesVenta();
    actualizarSegmentoComprobantesVenta();

    if (!filtradas.length) {
        tbody.innerHTML = `<tr><td colspan="10" class="px-6 py-10 text-center text-slate-400 text-sm">No se encontraron comprobantes con ese criterio.</td></tr>`;
    }
    const coloresEstadoCV = { 'Pendiente': 'bg-amber-100 text-amber-800', 'Cobrada': 'bg-emerald-100 text-emerald-800', 'Anulada': 'bg-slate-200 text-slate-600' };
    filtradas.forEach(({ cv, estado }) => {
        const fechaFormateada = cv.fecha_emision ? new Date(cv.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '-';
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="px-6 py-4 font-semibold text-slate-900">CV-${String(cv.id_comprobante_venta_cliente).padStart(5, '0')}</td>
            <td class="px-6 py-4">${cv.clienteObj ? cv.clienteObj.nombre : '-'}</td>
            <td class="px-6 py-4">${cv.clienteObj ? cv.clienteObj.apellido : '-'}</td>
            <td class="px-6 py-4 text-slate-500">${cv.clienteObj ? cv.clienteObj.tipo_documento : '-'}</td>
            <td class="px-6 py-4 text-slate-500">${cv.clienteObj ? cv.clienteObj.numero_documento : '-'}</td>
            <td class="px-6 py-4">${badgeTipoCliente(cv.clienteObj ? cv.clienteObj.tipo_cliente : '-')}</td>
            <td class="px-6 py-4 text-slate-500">${fechaFormateada}</td>
            <td class="px-6 py-4 text-right font-medium whitespace-nowrap">$ ${cv.total.toLocaleString()}</td>
            <td class="px-6 py-4 text-center"><span class="px-2.5 py-1 ${coloresEstadoCV[estado]} text-xs font-semibold rounded-full whitespace-nowrap">${estado}</span></td>
            <td class="px-6 py-4">
                <div class="flex items-center justify-start gap-1.5">
                    <button onclick="verComprobanteVentaDesdeListado(${cv.id_comprobante_venta_cliente})" title="Ver comprobante" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    ${comprobanteVentaEsCobrable(cv) ? `<button onclick="irARegistrarCobroDesdeVentas(${cv.id_comprobante_venta_cliente})" title="Registrar cobro" class="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"><i data-lucide="hand-coins" class="w-4 h-4"></i></button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function alternarOrdenComprobantesVenta(campo) {
    if (ordenCVCampo !== campo) { ordenCVCampo = campo; ordenCVDireccion = 'asc'; }
    else if (ordenCVDireccion === 'asc') { ordenCVDireccion = 'desc'; }
    else { ordenCVCampo = null; ordenCVDireccion = null; }
    renderizarTablaComprobantesVenta();
}

function actualizarIconosOrdenComprobantesVenta() {
    ['nombre', 'apellido'].forEach(campo => {
        const boton = document.getElementById(`btn-orden-${campo}-cv`);
        if (!boton) return;
        const activo = ordenCVCampo === campo;
        const icono = activo && ordenCVDireccion === 'asc' ? 'arrow-up' : activo && ordenCVDireccion === 'desc' ? 'arrow-down' : 'arrow-up-down';
        boton.className = `normal-case transition ${activo ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
        boton.innerHTML = `<i data-lucide="${icono}" class="w-3.5 h-3.5"></i>`;
    });
}

// Filtro externo a la tabla (chips "Todos / Eventos / Donaciones"), independiente de la columna Tipo Cliente.
function elegirSegmentoComprobantesVenta(valor) {
    segmentoCVSeleccionado = valor;
    renderizarTablaComprobantesVenta();
}

function actualizarSegmentoComprobantesVenta() {
    ['', 'Evento', 'Donacion'].forEach(valor => {
        const boton = document.getElementById(`segmento-cv-${valor}`);
        if (!boton) return;
        const activo = segmentoCVSeleccionado === valor;
        boton.className = `segmento-cv px-3 py-1.5 rounded-md font-semibold transition ${activo ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-white'}`;
    });
}

function elegirFiltroTipoComprobantesVenta(valor) {
    filtroCVTipoSeleccionado = valor;
    document.getElementById('pop-tipo-cv').classList.add('hidden');
    renderizarTablaComprobantesVenta();
}
function actualizarIconoFiltroTipoComprobantesVenta() {
    const boton = document.getElementById('btn-filtro-tipo-cv');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroCVTipoSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-tipo-cv').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroCVTipoSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroCVTipoSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroCVTipoSeleccionado);
    });
}

function elegirFiltroTipoDocComprobantesVenta(valor) {
    filtroCVTipoDocSeleccionado = valor;
    document.getElementById('pop-tipo-doc-cv').classList.add('hidden');
    renderizarTablaComprobantesVenta();
}
function actualizarIconoFiltroTipoDocComprobantesVenta() {
    const boton = document.getElementById('btn-filtro-tipo-doc-cv');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroCVTipoDocSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-tipo-doc-cv').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroCVTipoDocSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroCVTipoDocSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroCVTipoDocSeleccionado);
    });
}

function elegirFiltroEstadoComprobantesVenta(valor) {
    filtroCVEstadoSeleccionado = valor;
    document.getElementById('pop-estado-cv').classList.add('hidden');
    renderizarTablaComprobantesVenta();
}
function actualizarIconoFiltroEstadoComprobantesVenta() {
    const boton = document.getElementById('btn-filtro-estado-cv');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroCVEstadoSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-estado-cv').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroCVEstadoSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroCVEstadoSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroCVEstadoSeleccionado);
    });
}

// Ver el detalle impreso de un comprobante de venta desde el listado (mismo formato que el que se
// imprime al confirmar un pedido, armado con el helper compartido de js/data.js para no duplicar el documento).
function verComprobanteVentaDesdeListado(idComprobante) {
    const cv = listaComprobantesVenta.find(c => c.id_comprobante_venta_cliente === idComprobante);
    if (!cv) return;
    document.getElementById('area-comprobante-venta-detalle').innerHTML = construirHTMLComprobanteVenta(cv);
    mostrarSubvistaVentas('comprobante-venta-detalle');
}

function volverAComprobantesVenta() {
    renderizarTablaComprobantesVenta();
    mostrarSubvistaVentas('comprobantes-venta');
    if (window.location.hash !== '#comprobantes-venta') window.location.hash = 'comprobantes-venta';
}

// Handoff a Cobranzas > Registrar Cobro: pasa el id elegido por sessionStorage porque es una navegación
// entre páginas distintas (ventas.html -> cobranzas.html), no un cambio de subvista dentro de la misma página.
function irARegistrarCobroDesdeVentas(idComprobanteVenta) {
    sessionStorage.setItem('cobro_prefill_cv', idComprobanteVenta);
    window.location.href = 'cobranzas.html#registrar-cobro';
}

function filtrarClientesAutocompletado() {
    const input = document.getElementById('cliente-autocompletar');
    const cont = document.getElementById('cliente-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    // Cualquier edición del texto invalida la selección previa hasta que se elija una sugerencia.
    document.getElementById('select-cliente-pedido').value = '';
    clienteSeleccionadoPedido = null;
    document.getElementById('ficha-cliente-pedido').classList.add('hidden');
    calcularTotalPedido();

    if (!termino) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }

    const filtrados = listaClientes.filter(c => normalizarTexto(`${c.nombre} ${c.apellido}`).includes(termino) || normalizarTexto(c.numero_documento).includes(termino));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(c => {
        const idx = listaClientes.indexOf(c);
        return `<button type="button" onmousedown="event.preventDefault(); elegirClientePedido(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${c.nombre} ${c.apellido}</span>
            <span class="block text-[11px] text-slate-400">${c.tipo_cliente} · ${c.documentoCompleto}</span>
        </button>`;
    }).join('');
    cont.classList.remove('hidden');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#cliente-autocompletar') && !e.target.closest('#cliente-autocompletar-opciones')) {
        document.getElementById('cliente-autocompletar-opciones')?.classList.add('hidden');
    }
});

function elegirClientePedido(idx) {
    clienteSeleccionadoPedido = listaClientes[idx];
    document.getElementById('cliente-autocompletar').value = clienteSeleccionadoPedido.nombreMostrado;
    document.getElementById('select-cliente-pedido').value = idx;
    document.getElementById('cliente-autocompletar-opciones').classList.add('hidden');
    mostrarFichaClientePedido();
    calcularTotalPedido();
}

function mostrarFichaClientePedido() {
    const ficha = document.getElementById('ficha-cliente-pedido');
    const c = clienteSeleccionadoPedido;
    if (!c) { ficha.classList.add('hidden'); return; }
    ficha.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            <p><b class="text-slate-700">Categoría:</b> <span class="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">${c.tipo_cliente}</span></p>
            <p><b class="text-slate-700">Documento:</b> ${c.documentoCompleto}</p>
            <p><b class="text-slate-700">Condición IVA:</b> ${c.condicion_iva}</p>
            <p><b class="text-slate-700">Dirección:</b> ${c.direccionCompleta}</p>
            <p><b class="text-slate-700">Límite de crédito:</b> $ ${c.limite_credito.toLocaleString()}</p>
        </div>`;
    ficha.classList.remove('hidden');
}

let destinoModalNuevoCliente = 'pedido'; // 'pedido' | 'presupuesto' — a qué formulario vuelve el cliente recién creado

function abrirModalNuevoCliente(destino = 'pedido') {
    destinoModalNuevoCliente = destino;
    document.getElementById('mcli-tipo-cliente').selectedIndex = 0;
    ['mcli-nombre', 'mcli-apellido', 'mcli-razon-social', 'mcli-numero-documento', 'mcli-telefono', 'mcli-email', 'mcli-altura'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('mcli-limite').value = 0;
    document.getElementById('mcli-provincia').selectedIndex = 0;
    cargarLocalidadesCascada('mcli');
    document.getElementById('modal-nuevo-cliente-pedido').classList.remove('hidden');
}

function cerrarModalNuevoCliente() {
    document.getElementById('modal-nuevo-cliente-pedido').classList.add('hidden');
}

function guardarClienteDesdePedido() {
    const tipoCliente = document.getElementById('mcli-tipo-cliente').value;
    const nombre = document.getElementById('mcli-nombre').value.trim();
    const apellido = document.getElementById('mcli-apellido').value.trim();
    const razonSocial = document.getElementById('mcli-razon-social').value.trim();
    const tipoDocumento = document.getElementById('mcli-tipo-documento').value;
    const numeroDocumento = document.getElementById('mcli-numero-documento').value.trim();
    const calleObj = obtenerCalleSeleccionada('mcli');
    const altura = document.getElementById('mcli-altura').value.trim();
    const telefono = document.getElementById('mcli-telefono').value.trim();
    const email = document.getElementById('mcli-email').value.trim();
    const iva = document.getElementById('mcli-iva').value;
    const limite = parseFloat(document.getElementById('mcli-limite').value) || 0;

    if (!tipoCliente) return alert('Seleccioná el tipo de cliente.');
    if (!nombre || !apellido || !numeroDocumento) return alert('Completá Nombre, Apellido y Número de Documento.');

    const nuevo = new Cliente(nombre, apellido, tipoDocumento, numeroDocumento, calleObj, altura, telefono, email, iva, tipoCliente, limite, razonSocial);
    listaClientes.unshift(nuevo);
    renderizarClientesUI();
    guardarDatos();

    if (destinoModalNuevoCliente === 'presupuesto') {
        elegirClientePresupuesto(listaClientes.indexOf(nuevo));
    } else {
        elegirClientePedido(listaClientes.indexOf(nuevo));
    }
    cerrarModalNuevoCliente();
}

const CATALOGO_PRODUCTOS_VENTA = {
    'Pasta': {
        'Fresca': [
            { nombre: 'Fideos Frescos al Huevo', precio: 2600 },
            { nombre: 'Tagliatelle Fresco', precio: 2900 }
        ],
        'Seca': [
            { nombre: 'Tallarines al Huevo', precio: 2800 },
            { nombre: 'Ñoquis de Papa', precio: 3000 }
        ],
        'Rellena': [
            { nombre: 'Ravioles de Ricotta y Verdura', precio: 3500 },
            { nombre: 'Sorrentinos de Jamón y Queso', precio: 4200 }
        ]
    },
    'Salsa': {
        'Clásica': [
            { nombre: 'Salsa Fileto en Pote', precio: 1200 },
            { nombre: 'Salsa Bolognesa en Pote', precio: 1800 }
        ]
    }
};

// Catálogo aplanado para el autocompletado del campo único "Producto" (cada ítem conserva su tipo/subtipo original).
const PRODUCTOS_VENTA_FLAT = Object.entries(CATALOGO_PRODUCTOS_VENTA).flatMap(([tipo, subtipos]) =>
    Object.entries(subtipos).flatMap(([subtipo, productos]) =>
        productos.map(p => ({ nombre: p.nombre, precio: p.precio, tipo, subtipo }))
    )
);

function filtrarProductosAutocompletado() {
    const input = document.getElementById('prod-autocompletar');
    const cont = document.getElementById('prod-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    // Cualquier edición del texto invalida la selección previa hasta que se elija una sugerencia.
    document.getElementById('prod-select').value = '';
    document.getElementById('prod-subtipo-detectado').textContent = '';

    if (!termino) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }

    const filtrados = PRODUCTOS_VENTA_FLAT.filter(p => normalizarTexto(p.nombre).includes(termino));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(p => {
        const idx = PRODUCTOS_VENTA_FLAT.indexOf(p);
        return `<button type="button" onmousedown="event.preventDefault(); elegirProductoAutocompletado(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${p.nombre}</span>
            <span class="block text-[11px] text-slate-400">${p.tipo} · ${p.subtipo}</span>
        </button>`;
    }).join('');
    cont.classList.remove('hidden');
}

function elegirProductoAutocompletado(idx) {
    const p = PRODUCTOS_VENTA_FLAT[idx];
    document.getElementById('prod-autocompletar').value = p.nombre;
    document.getElementById('prod-select').value = `${p.nombre}|${p.precio}|${p.tipo}|${p.subtipo}`;
    document.getElementById('prod-autocompletar-opciones').classList.add('hidden');
    document.getElementById('prod-subtipo-detectado').textContent = `${p.tipo} ${p.subtipo}`;
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#prod-autocompletar') && !e.target.closest('#prod-autocompletar-opciones')) {
        document.getElementById('prod-autocompletar-opciones')?.classList.add('hidden');
    }
});

function agregarProductoPedido() {
    const prodSelect = document.getElementById('prod-select').value;
    const cantidad = parseInt(document.getElementById('prod-cant').value);

    if (!prodSelect) return alert('Elegí un producto de la lista de sugerencias.');
    if (!cantidad || cantidad <= 0) return alert('Ingrese una cantidad válida.');

    const [nombre, precioStr, tipo, subtipo] = prodSelect.split('|');
    const precioUnitario = parseFloat(precioStr);

    const itemExistente = itemsPedidoActual.find(item => item.nombre === nombre && item.tipo === tipo && item.subtipo === subtipo);
    if (itemExistente) {
        itemExistente.cantidad += cantidad;
        itemExistente.subtotal = itemExistente.cantidad * itemExistente.precioUnitario;
    } else {
        itemsPedidoActual.push({ id: Date.now(), nombre, tipo, subtipo, cantidad, precioUnitario, subtotal: precioUnitario * cantidad });
    }
    document.getElementById('prod-autocompletar').value = '';
    document.getElementById('prod-select').value = '';
    document.getElementById('prod-subtipo-detectado').textContent = '';
    document.getElementById('prod-cant').value = 1;
    renderizarTablaPedido();
}

function eliminarItemPedido(id) {
    itemsPedidoActual = itemsPedidoActual.filter(item => item.id !== id);
    renderizarTablaPedido();
}

function renderizarTablaPedido() {
    const tbody = document.getElementById('tabla-items-pedido');
    tbody.innerHTML = '';

    itemsPedidoActual.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="p-3 text-slate-500">${item.tipo || '-'}</td>
            <td class="p-3 text-slate-500">${item.subtipo || '-'}</td>
            <td class="p-3 font-medium text-slate-800">${item.nombre}</td>
            <td class="p-3 text-center">
                <input type="number" min="1" value="${item.cantidad}" onchange="actualizarCantidadItemPedido(${item.id}, this.value)" class="w-16 text-center border border-slate-300 rounded-md p-1 text-sm outline-none focus:ring-2 focus:ring-red-500">
            </td>
            <td class="p-3 text-right">$ ${item.precioUnitario.toLocaleString()}</td>
            <td class="p-3 text-right font-semibold">$ ${item.subtotal.toLocaleString()}</td>
            <td class="p-3 text-center">
                <button type="button" onclick="eliminarItemPedido(${item.id})" class="text-red-500 hover:text-red-700">
                    <i data-lucide="trash-2" class="w-4 h-4 inline"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
    calcularTotalPedido();
}

function actualizarCantidadItemPedido(id, nuevaCantidad) {
    const cantidad = parseInt(nuevaCantidad);
    const item = itemsPedidoActual.find(i => i.id === id);
    if (!item) return;
    if (!cantidad || cantidad <= 0) { renderizarTablaPedido(); return; }
    item.cantidad = cantidad;
    item.subtotal = item.cantidad * item.precioUnitario;
    renderizarTablaPedido();
}

function calcularTotalPedido() {
    const subtotal = itemsPedidoActual.reduce((acc, i) => acc + i.subtotal, 0);
    const esDonacion = document.getElementById('pedido-es-donacion').checked;

    // Los descuentos (bonificación) se habilitan para clientes Mayoristas, y también para
    // Mostrador cuando el pedido es para un Evento.
    const esEventoPedido = document.getElementById('pedido-es-evento').checked;
    const descuentoHabilitado = !!clienteSeleccionadoPedido && (clienteSeleccionadoPedido.tipo_cliente === 'Mayorista' || esEventoPedido);

    const inputBonificacion = document.getElementById('pedido-bonificacion');
    inputBonificacion.disabled = esDonacion || !descuentoHabilitado;
    if (esDonacion || !descuentoHabilitado) inputBonificacion.value = 0;
    document.getElementById('nota-bonificacion-donacion').classList.toggle('hidden', !esDonacion);
    document.getElementById('nota-bonificacion-restringida').classList.toggle('hidden', esDonacion || descuentoHabilitado);

    const bonifPct = parseFloat(inputBonificacion.value) || 0;
    const bonifMonto = esDonacion ? subtotal : subtotal * (bonifPct / 100);
    const total = esDonacion ? 0 : Math.max(0, subtotal - bonifMonto);

    document.getElementById('cant-items-num').innerText = itemsPedidoActual.length;
    document.getElementById('subtotal-pedido-monto').innerText = `$ ${subtotal.toLocaleString()}`;
    document.getElementById('label-bonificacion-pedido').innerText = esDonacion ? 'Donación (sin cargo)' : `Bonificación (${bonifPct}%)`;
    document.getElementById('bonificacion-pedido-monto').innerText = `-$ ${bonifMonto.toLocaleString()}`;
    document.getElementById('total-pedido-monto').innerText = `$ ${total.toLocaleString()}`;
    return total;
}

// El empleado que registra el pedido ya no se elige manualmente: se autoasigna el usuario que inició sesión.
function mostrarEmpleadoAutoasignado() {
    document.getElementById('pedido-empleado').value = usuarioInternoActual.nombre;
    document.getElementById('pedido-empleado-nombre').textContent = `${usuarioInternoActual.nombre} (${usuarioInternoActual.rol})`;
}

function resetFormularioPedido() {
    itemsPedidoActual = [];
    pedidoEnEdicionId = null;
    presupuestoEnConversionId = null;
    clienteSeleccionadoPedido = null;
    document.getElementById('titulo-form-pedido').innerText = 'Registrar Nuevo Pedido';
    document.getElementById('btn-confirmar-pedido').innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i><span>Confirmar Pedido</span>';
    document.getElementById('cliente-autocompletar').value = '';
    document.getElementById('select-cliente-pedido').value = '';
    document.getElementById('ficha-cliente-pedido').classList.add('hidden');
    mostrarEmpleadoAutoasignado();
    document.getElementById('pedido-es-evento').checked = false;
    document.getElementById('pedido-es-donacion').checked = false;
    document.getElementById('pedido-bonificacion').value = 0;
    document.getElementById('pedido-observaciones').value = '';
    document.getElementById('pedido-fecha-entrega-estimada').value = '';
    document.getElementById('prod-autocompletar').value = '';
    document.getElementById('prod-select').value = '';
    document.getElementById('prod-subtipo-detectado').textContent = '';
    document.getElementById('prod-cant').value = 1;
    renderizarTablaPedido();
    lucide.createIcons();
}

function validarDatosObligatoriosPedido() {
    if (!clienteSeleccionadoPedido) { alert('Buscá y seleccioná el cliente del pedido.'); return false; }
    if (itemsPedidoActual.length === 0) { alert('Añadí al menos un producto al pedido.'); return false; }
    return true;
}

function confirmarPedido() {
    if (!validarDatosObligatoriosPedido()) return;
    const empleado = usuarioInternoActual.nombre;

    const total = calcularTotalPedido();
    const tipo = clienteSeleccionadoPedido.tipo_cliente;
    const esEvento = document.getElementById('pedido-es-evento').checked;
    const esDonacion = document.getElementById('pedido-es-donacion').checked;
    const bonificacion = parseFloat(document.getElementById('pedido-bonificacion').value) || 0;
    const observaciones = document.getElementById('pedido-observaciones').value.trim();
    const fechaEntregaEstimada = document.getElementById('pedido-fecha-entrega-estimada').value || null;
    const detalle = itemsPedidoActual.map(i => ({ ...i }));

    if (pedidoEnEdicionId) {
        const pedido = listaPedidos.find(p => p.id === pedidoEnEdicionId);
        Object.assign(pedido, { clienteObj: clienteSeleccionadoPedido, cliente: clienteSeleccionadoPedido.nombreMostrado, empleado, tipo, esEvento, esDonacion, bonificacion, observaciones, fechaEntregaEstimada, detalle, total });
        actualizarComprobanteVenta(pedido);
        alert(`¡Pedido PED-${pedido.id} actualizado con éxito! El comprobante de venta asociado se actualizó.`);
    } else {
        const ahora = new Date();
        const nuevoPedido = {
            id: numPedidoContador++, clienteObj: clienteSeleccionadoPedido, cliente: clienteSeleccionadoPedido.nombreMostrado,
            empleado, tipo, esEvento, esDonacion, bonificacion, observaciones, fechaEntregaEstimada, detalle, total, estado: 'Pendiente',
            fecha: ahora.toISOString().slice(0, 10), hora: ahora.toTimeString().slice(0, 5)
        };
        listaPedidos.unshift(nuevoPedido);
        generarComprobanteVenta(nuevoPedido);
        alert(`¡Pedido para "${clienteSeleccionadoPedido.nombreMostrado}" registrado! Se emitió el comprobante de venta correspondiente.`);

        // Si este pedido se generó a partir de un presupuesto, recién ahora (confirmado el pedido) se marca como Convertido.
        if (presupuestoEnConversionId) {
            const presupuesto = listaPresupuestos.find(p => p.id === presupuestoEnConversionId);
            if (presupuesto) { presupuesto.estado = 'Convertido'; presupuesto.idPedidoGenerado = nuevoPedido.id; }
            presupuestoEnConversionId = null;
        }
    }

    guardarDatos();
    volverAlListadoVentas();
}

// Lleva a Producción > Nueva Orden con este pedido precargado como Origen (ver recibirHandoffDesdePedido en produccion.js).
function generarOrdenProduccionDesdePedido(idPedido) {
    sessionStorage.setItem('opDesdePedidoPendiente', JSON.stringify({ idPedido }));
    window.location.href = 'produccion.html#nueva-orden';
}

function renderizarTablaPedidosRegistrados() {
    const tbody = document.getElementById('tabla-pedidos-registrados');
    tbody.innerHTML = '';

    const pedidosFacturables = listaPedidos.filter(p => p.estado !== 'Cancelado');
    document.getElementById('kpi-pedidos-pendientes').innerText = listaPedidos.filter(p => p.estado === 'Pendiente').length;
    document.getElementById('kpi-pedidos-preparacion').innerText = listaPedidos.filter(p => p.estado === 'En preparación' || p.estado === 'Listo').length;
    document.getElementById('kpi-pedidos-entregados').innerText = listaPedidos.filter(p => p.estado === 'Entregado').length;
    document.getElementById('kpi-pedidos-cancelados').innerText = listaPedidos.filter(p => p.estado === 'Cancelado').length;
    document.getElementById('kpi-pedidos-total').innerText = `$ ${pedidosFacturables.reduce((a, p) => a + p.total, 0).toLocaleString()}`;
    const ticketPromedio = pedidosFacturables.length ? pedidosFacturables.reduce((a, p) => a + p.total, 0) / pedidosFacturables.length : 0;
    document.getElementById('kpi-pedidos-ticket-promedio').innerText = `$ ${Math.round(ticketPromedio).toLocaleString()}`;

    const terminoNumPedido = normalizarTexto(document.getElementById('buscar-num-pedido')?.value || '').trim();
    const terminoNombre = normalizarTexto(document.getElementById('buscar-nombre')?.value || '').trim();
    const terminoApellido = normalizarTexto(document.getElementById('buscar-apellido')?.value || '').trim();
    const terminoDocumento = normalizarTexto(document.getElementById('buscar-documento')?.value || '').trim();

    const pedidosFiltrados = listaPedidos.filter(p => {
        const nombre = p.clienteObj ? p.clienteObj.nombre : '';
        const apellido = p.clienteObj ? p.clienteObj.apellido : '';
        const documento = p.clienteObj ? p.clienteObj.numero_documento : '';
        const tipoDocumento = p.clienteObj ? p.clienteObj.tipo_documento : '';
        return (!terminoNumPedido || String(p.id).includes(terminoNumPedido)) &&
            (!terminoNombre || normalizarTexto(nombre).includes(terminoNombre)) &&
            (!terminoApellido || normalizarTexto(apellido).includes(terminoApellido)) &&
            (!terminoDocumento || normalizarTexto(documento).includes(terminoDocumento)) &&
            (!filtroPedidoTipoDocSeleccionado || tipoDocumento === filtroPedidoTipoDocSeleccionado) &&
            (!filtroPedidoEstadoSeleccionado || p.estado === filtroPedidoEstadoSeleccionado) &&
            (!filtroPedidoTipoSeleccionado || p.tipo === filtroPedidoTipoSeleccionado) &&
            (!segmentoPedidoSeleccionado || (segmentoPedidoSeleccionado === 'Evento' ? p.esEvento : p.esDonacion));
    });

    if (ordenHistorialCampo && ordenHistorialDireccion) {
        pedidosFiltrados.sort((a, b) => {
            const va = (a.clienteObj ? a.clienteObj[ordenHistorialCampo] : '') || '';
            const vb = (b.clienteObj ? b.clienteObj[ordenHistorialCampo] : '') || '';
            const cmp = va.localeCompare(vb, 'es');
            return ordenHistorialDireccion === 'asc' ? cmp : -cmp;
        });
    }
    actualizarIconosOrdenHistorial();
    actualizarIconoFiltroTipo();
    actualizarIconoFiltroTipoDoc();
    actualizarIconoFiltroEstado();
    actualizarSegmentoPedidos();

    if (!pedidosFiltrados.length) {
        tbody.innerHTML = `<tr><td colspan="10" class="px-6 py-10 text-center text-slate-400 text-sm">No se encontraron pedidos con ese criterio.</td></tr>`;
    }
    pedidosFiltrados.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        const activo = p.estado !== 'Cancelado' && p.estado !== 'Entregado' && p.estado !== 'Devuelto';
        const siguiente = activo ? ESTADOS_PEDIDO[ESTADOS_PEDIDO.indexOf(p.estado) + 1] : null;
        const fechaFormateada = p.fecha ? new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-AR') : '-';

        // El comprobante de venta solo puede verse cuando la orden de pedido llegó a "Listo", "Entregado" o "Devuelto".
        const comprobante = obtenerComprobanteVentaPorPedido(p.id);
        const comprobanteVisible = comprobante && !comprobante.es_anulado && (p.estado === 'Listo' || p.estado === 'Entregado' || p.estado === 'Devuelto');

        tr.innerHTML = `
            <td class="px-6 py-4 font-semibold text-slate-900">PED-${p.id}</td>
            <td class="px-6 py-4">${p.clienteObj ? p.clienteObj.nombre : '-'}</td>
            <td class="px-6 py-4">${p.clienteObj ? p.clienteObj.apellido : '-'}</td>
            <td class="px-6 py-4 text-slate-500">${p.clienteObj ? p.clienteObj.tipo_documento : '-'}</td>
            <td class="px-6 py-4 text-slate-500">${p.clienteObj ? p.clienteObj.numero_documento : '-'}</td>
            <td class="px-6 py-4">${badgeTipoCliente(p.tipo)}</td>
            <td class="px-6 py-4 text-slate-500">${fechaFormateada}</td>
            <td class="px-6 py-4 text-right font-medium whitespace-nowrap">$ ${p.total.toLocaleString()}</td>
            <td class="px-6 py-4 text-center"><span class="px-2.5 py-1 ${COLOR_ESTADO_PEDIDO[p.estado]} text-xs font-semibold rounded-full whitespace-nowrap">${p.estado}</span></td>
            <td class="px-6 py-4">
                <div class="flex items-center justify-start gap-1.5">
                    <button onclick="verDetallePedido(${p.id})" title="Ver detalle" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    ${comprobanteVisible ? `<button onclick="verComprobanteVenta(${p.id})" title="Ver comprobante de venta" class="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition"><i data-lucide="file-check-2" class="w-4 h-4"></i></button>` : ''}
                    ${p.estado === 'Pendiente' ? `<button onclick="editarPedido(${p.id})" title="Editar pedido" class="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>` : ''}
                    ${(p.estado === 'Pendiente' && !p.idOrdenProduccionGenerada) ? `<button onclick="generarOrdenProduccionDesdePedido(${p.id})" title="Generar orden de producción" class="p-2 rounded-lg text-teal-600 hover:bg-teal-50 transition"><i data-lucide="factory" class="w-4 h-4"></i></button>` : ''}
                    ${siguiente ? `<button onclick="avanzarEstadoPedido(${p.id})" title="Marcar ${siguiente}" class="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"><i data-lucide="arrow-right-circle" class="w-4 h-4"></i></button>` : ''}
                    ${(p.estado === 'Entregado' || p.estado === 'Devuelto') ? `<button onclick="abrirModalDevolucion(${p.id})" title="Devolver pedido" class="p-2 rounded-lg text-orange-600 hover:bg-orange-50 transition"><i data-lucide="undo-2" class="w-4 h-4"></i></button>` : ''}
                    ${activo ? `<button onclick="cancelarPedidoListado(${p.id})" title="Cancelar pedido" class="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"><i data-lucide="x-circle" class="w-4 h-4"></i></button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function alternarOrdenHistorial(campo) {
    if (ordenHistorialCampo !== campo) {
        ordenHistorialCampo = campo;
        ordenHistorialDireccion = 'asc';
    } else if (ordenHistorialDireccion === 'asc') {
        ordenHistorialDireccion = 'desc';
    } else {
        ordenHistorialCampo = null;
        ordenHistorialDireccion = null;
    }
    renderizarTablaPedidosRegistrados();
}

function actualizarIconosOrdenHistorial() {
    ['nombre', 'apellido'].forEach(campo => {
        const boton = document.getElementById(`btn-orden-${campo}`);
        if (!boton) return;
        const activo = ordenHistorialCampo === campo;
        const icono = activo && ordenHistorialDireccion === 'asc' ? 'arrow-up' : activo && ordenHistorialDireccion === 'desc' ? 'arrow-down' : 'arrow-up-down';
        boton.title = activo ? (ordenHistorialDireccion === 'asc' ? 'Ordenado de la A a la Z' : 'Ordenado de la Z a la A') : 'Ordenar de la A a la Z';
        boton.className = `normal-case transition ${activo ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
        boton.innerHTML = `<i data-lucide="${icono}" class="w-3.5 h-3.5"></i>`;
    });
}

function elegirFiltroTipoHistorial(valor) {
    filtroPedidoTipoSeleccionado = valor;
    document.getElementById('pop-tipo').classList.add('hidden');
    renderizarTablaPedidosRegistrados();
}

// Filtro externo a la tabla (chips "Todos / Eventos / Donaciones"), independiente de la columna Tipo Cliente.
function elegirSegmentoPedidos(valor) {
    segmentoPedidoSeleccionado = valor;
    renderizarTablaPedidosRegistrados();
}

function actualizarSegmentoPedidos() {
    ['', 'Evento', 'Donacion'].forEach(valor => {
        const boton = document.getElementById(`segmento-pedidos-${valor}`);
        if (!boton) return;
        const activo = segmentoPedidoSeleccionado === valor;
        boton.className = `segmento-pedidos px-3 py-1.5 rounded-md font-semibold transition ${activo ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-white'}`;
    });
}

function actualizarIconoFiltroTipo() {
    const boton = document.getElementById('btn-filtro-tipo');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroPedidoTipoSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-tipo').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroPedidoTipoSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroPedidoTipoSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroPedidoTipoSeleccionado);
    });
}

function elegirFiltroTipoDocHistorial(valor) {
    filtroPedidoTipoDocSeleccionado = valor;
    document.getElementById('pop-tipo-doc').classList.add('hidden');
    renderizarTablaPedidosRegistrados();
}

function actualizarIconoFiltroTipoDoc() {
    const boton = document.getElementById('btn-filtro-tipo-doc');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroPedidoTipoDocSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-tipo-doc').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroPedidoTipoDocSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroPedidoTipoDocSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroPedidoTipoDocSeleccionado);
    });
}

function elegirFiltroEstadoHistorial(valor) {
    filtroPedidoEstadoSeleccionado = valor;
    document.getElementById('pop-estado').classList.add('hidden');
    renderizarTablaPedidosRegistrados();
}

function actualizarIconoFiltroEstado() {
    const boton = document.getElementById('btn-filtro-estado');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroPedidoEstadoSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-estado').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroPedidoEstadoSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroPedidoEstadoSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroPedidoEstadoSeleccionado);
    });
}

function avanzarEstadoPedido(id) {
    const pedido = listaPedidos.find(p => p.id === id);
    if (pedido.estado === 'Cancelado' || pedido.estado === 'Entregado') return;
    const siguiente = ESTADOS_PEDIDO[ESTADOS_PEDIDO.indexOf(pedido.estado) + 1];
    if (siguiente) {
        pedido.estado = siguiente;
        if (siguiente === 'Entregado') {
            const ahora = new Date();
            pedido.fechaEntrega = ahora.toISOString().slice(0, 10);
            pedido.horaEntrega = ahora.toTimeString().slice(0, 5);
        }
    }
    guardarDatos();
    renderizarTablaPedidosRegistrados();
}

function cancelarPedidoListado(id) {
    if (!confirm(`¿Confirma la cancelación del pedido PED-${id}? Se dejará constancia en el sistema.`)) return;
    const pedido = listaPedidos.find(p => p.id === id);
    pedido.estado = 'Cancelado';
    anularComprobanteVentaDePedido(id);
    guardarDatos();
    renderizarTablaPedidosRegistrados();
}

function editarPedido(id) {
    const pedido = listaPedidos.find(p => p.id === id);
    if (!pedido || pedido.estado !== 'Pendiente') return;

    pedidoEnEdicionId = id;
    itemsPedidoActual = pedido.detalle.map(i => ({ ...i }));

    document.getElementById('titulo-form-pedido').innerText = `Editar Pedido PED-${id}`;
    document.getElementById('btn-confirmar-pedido').innerHTML = '<i data-lucide="save" class="w-4 h-4"></i><span>Guardar Cambios</span>';

    elegirClientePedido(listaClientes.indexOf(pedido.clienteObj));

    mostrarEmpleadoAutoasignado();
    document.getElementById('pedido-es-evento').checked = !!pedido.esEvento;
    document.getElementById('pedido-es-donacion').checked = !!pedido.esDonacion;
    document.getElementById('pedido-bonificacion').value = pedido.bonificacion || 0;
    document.getElementById('pedido-observaciones').value = pedido.observaciones || '';
    document.getElementById('pedido-fecha-entrega-estimada').value = pedido.fechaEntregaEstimada || '';
    document.getElementById('prod-autocompletar').value = '';
    document.getElementById('prod-select').value = '';
    document.getElementById('prod-subtipo-detectado').textContent = '';
    document.getElementById('prod-cant').value = 1;

    renderizarTablaPedido();
    mostrarSubvistaVentas('nuevo-pedido');
    if (window.location.hash !== '#registrar') window.location.hash = 'registrar';
    lucide.createIcons();
}

function verDetallePedido(id) {
    const p = listaPedidos.find(x => x.id === id);
    const c = p.clienteObj;
    const fechaPedidoFormateada = p.fecha ? new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-AR') : '-';
    const fechaEntregaFormateada = p.fechaEntrega
        ? new Date(p.fechaEntrega + 'T00:00:00').toLocaleDateString('es-AR')
        : (p.fechaEntregaEstimada ? `${new Date(p.fechaEntregaEstimada + 'T00:00:00').toLocaleDateString('es-AR')} (estimativa)` : 'A confirmar');

    const subtotalPedido = (p.detalle || []).reduce((acc, i) => acc + i.subtotal, 0);
    const descuentoPct = p.esDonacion ? 100 : (p.bonificacion || 0);
    const descuentoMonto = p.esDonacion ? subtotalPedido : subtotalPedido * ((p.bonificacion || 0) / 100);
    // El comprobante de venta solo puede verse cuando la orden de pedido llegó a "Listo" o "Entregado".
    const comprobanteVenta = obtenerComprobanteVentaPorPedido(p.id);
    const comprobanteVisible = comprobanteVenta && !comprobanteVenta.es_anulado && (p.estado === 'Listo' || p.estado === 'Entregado');

    const filas = (p.detalle || []).map(i => `
        <tr class="border-b border-slate-100">
            <td class="py-2 text-slate-500">${i.tipo || '-'}</td>
            <td class="py-2 text-slate-500">${i.subtipo || '-'}</td>
            <td class="py-2">${i.nombre}</td>
            <td class="py-2 text-center">${i.cantidad}</td>
            <td class="py-2 text-right">$ ${i.precioUnitario.toLocaleString()}</td>
            <td class="py-2 text-right font-medium">$ ${i.subtotal.toLocaleString()}</td>
        </tr>`).join('');

    document.getElementById('area-detalle-pedido').innerHTML = `
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 border-b border-slate-200 pb-4">
            <div>
                <h1 class="text-2xl font-bold text-red-600">FÁBRICA DE PASTAS</h1>
                <p class="text-xs text-slate-500">Orden de Pedido de Cliente</p>
                <div class="flex items-center gap-2 mt-2">
                    <p class="text-sm font-bold text-slate-800">PED-${p.id}</p>
                    <span class="px-2.5 py-1 ${COLOR_ESTADO_PEDIDO[p.estado]} text-xs font-semibold rounded-full whitespace-nowrap">${p.estado}</span>
                </div>
            </div>
            <div class="text-left sm:text-right text-xs text-slate-500 space-y-0.5">
                <p><b class="text-slate-700">Fecha de Pedido:</b> ${fechaPedidoFormateada}</p>
                <p><b class="text-slate-700">Hora de Pedido:</b> ${p.hora || '-'}</p>
                <p class="pt-1"><b class="text-slate-700">Fecha de Entrega:</b> ${fechaEntregaFormateada}</p>
                <p><b class="text-slate-700">Hora de Entrega:</b> ${p.horaEntrega || '-'}</p>
                <p><b class="text-slate-700">Responsable:</b> ${p.empleado}</p>
            </div>
        </div>

        <div class="grid grid-cols-1 gap-4">
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1 text-xs">
                <h3 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><i data-lucide="user" class="w-3.5 h-3.5"></i>Cliente</h3>
                ${c ? `
                <p><b class="text-slate-700">Nombre y Apellido:</b> ${c.nombre} ${c.apellido}</p>
                <p><b class="text-slate-700">Domicilio:</b> ${c.direccionCompleta}</p>
                <p><b class="text-slate-700">Teléfono:</b> ${c.telefono || '-'}</p>
                ` : `<p>${p.cliente}</p>`}
            </div>
        </div>

        ${p.observaciones ? `
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <b>Observaciones:</b> ${p.observaciones}
        </div>` : ''}

        <div>
            <h3 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Detalle de Productos</h3>
            <table class="w-full text-xs text-left">
                <thead class="border-b border-slate-300 uppercase text-slate-500">
                    <tr><th class="py-2">Tipo</th><th class="py-2">Subtipo</th><th class="py-2">Producto</th><th class="py-2 text-center">Cant.</th><th class="py-2 text-right">P. Unitario</th><th class="py-2 text-right">Subtotal</th></tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>

        <div class="border-t border-slate-200 pt-4 space-y-1 text-right">
            <p class="text-xs text-slate-500">Subtotal: $ ${subtotalPedido.toLocaleString()}</p>
            <p class="text-xs text-emerald-600">${p.esDonacion ? 'Donación' : 'Descuento'} (${descuentoPct}%): -$ ${descuentoMonto.toLocaleString()}</p>
            <p class="text-lg font-bold text-slate-900">Total: $ ${p.total.toLocaleString()}</p>
        </div>

        ${(p.devoluciones || []).length ? `
        <div>
            <h3 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Devoluciones Registradas</h3>
            <div class="space-y-1.5 text-xs text-slate-600">
                ${p.devoluciones.map(d => `
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <p class="font-semibold text-slate-700">${new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-AR')} ${d.hora} — registrado por ${d.registradoPor}</p>
                    <p>${d.items.map(i => `${i.cantidad} × ${i.nombre}`).join(', ')}</p>
                    ${d.motivo ? `<p class="italic text-slate-400">"${d.motivo}"</p>` : ''}
                </div>`).join('')}
            </div>
        </div>` : ''}

        ${comprobanteVisible ? `
        <div class="no-print flex justify-end">
            <button type="button" onclick="verComprobanteVenta(${p.id})" class="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5">
                <i data-lucide="file-check-2" class="w-3.5 h-3.5"></i><span>Ver Comprobante de Venta</span>
            </button>
        </div>` : ''}
    `;
    lucide.createIcons();
    mostrarSubvistaVentas('detalle-pedido');
}

function verComprobanteVenta(idPedido) {
    const cv = obtenerComprobanteVentaPorPedido(idPedido);
    if (!cv) return alert('Este pedido todavía no tiene un comprobante de venta asociado.');

    document.getElementById('area-comprobante-venta').innerHTML = construirHTMLComprobanteVenta(cv);
    mostrarSubvistaVentas('comprobante-venta');
}

// ==========================================
// MÓDULO DE PRESUPUESTOS
// ==========================================
let clienteSeleccionadoPresupuesto = null;
let itemsPresupuestoActual = [];
let presupuestoEnConversionId = null; // id del presupuesto que se está convirtiendo en pedido (se confirma recién al guardar el pedido)
let presupuestoEnEdicionId = null;
let ordenPresupuestoCampo = null;
let ordenPresupuestoDireccion = null;
let filtroPresupuestoTipoSeleccionado = '';
let filtroPresupuestoTipoDocSeleccionado = '';
let segmentoPresupuestoSeleccionado = ''; // '' | 'Evento' — filtro externo a la tabla, fuera de la columna Tipo Cliente
let filtroPresupuestoEstadoSeleccionado = '';

function filtrarClientesAutocompletadoPresupuesto() {
    const input = document.getElementById('presup-cliente-autocompletar');
    const cont = document.getElementById('presup-cliente-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    document.getElementById('select-presup-cliente').value = '';
    clienteSeleccionadoPresupuesto = null;
    document.getElementById('ficha-cliente-presupuesto').classList.add('hidden');

    if (!termino) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }

    const filtrados = listaClientes.filter(c => normalizarTexto(`${c.nombre} ${c.apellido}`).includes(termino) || normalizarTexto(c.numero_documento).includes(termino));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(c => {
        const idx = listaClientes.indexOf(c);
        return `<button type="button" onmousedown="event.preventDefault(); elegirClientePresupuesto(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${c.nombre} ${c.apellido}</span>
            <span class="block text-[11px] text-slate-400">${c.tipo_cliente} · ${c.documentoCompleto}</span>
        </button>`;
    }).join('');
    cont.classList.remove('hidden');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#presup-cliente-autocompletar') && !e.target.closest('#presup-cliente-autocompletar-opciones')) {
        document.getElementById('presup-cliente-autocompletar-opciones')?.classList.add('hidden');
    }
});

function elegirClientePresupuesto(idx) {
    clienteSeleccionadoPresupuesto = listaClientes[idx];
    document.getElementById('presup-cliente-autocompletar').value = clienteSeleccionadoPresupuesto.nombreMostrado;
    document.getElementById('select-presup-cliente').value = idx;
    document.getElementById('presup-cliente-autocompletar-opciones').classList.add('hidden');

    const ficha = document.getElementById('ficha-cliente-presupuesto');
    const c = clienteSeleccionadoPresupuesto;
    ficha.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            <p><b class="text-slate-700">Categoría:</b> <span class="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">${c.tipo_cliente}</span></p>
            <p><b class="text-slate-700">Documento:</b> ${c.documentoCompleto}</p>
            <p><b class="text-slate-700">Dirección:</b> ${c.direccionCompleta}</p>
        </div>`;
    ficha.classList.remove('hidden');
    calcularTotalPresupuesto();
}

function filtrarProductosAutocompletadoPresupuesto() {
    const input = document.getElementById('presup-prod-autocompletar');
    const cont = document.getElementById('presup-prod-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    document.getElementById('presup-prod-select').value = '';
    document.getElementById('presup-prod-subtipo-detectado').textContent = '';

    if (!termino) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }

    const filtrados = PRODUCTOS_VENTA_FLAT.filter(p => normalizarTexto(p.nombre).includes(termino));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(p => {
        const idx = PRODUCTOS_VENTA_FLAT.indexOf(p);
        return `<button type="button" onmousedown="event.preventDefault(); elegirProductoAutocompletadoPresupuesto(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${p.nombre}</span>
            <span class="block text-[11px] text-slate-400">${p.tipo} · ${p.subtipo}</span>
        </button>`;
    }).join('');
    cont.classList.remove('hidden');
}

function elegirProductoAutocompletadoPresupuesto(idx) {
    const p = PRODUCTOS_VENTA_FLAT[idx];
    document.getElementById('presup-prod-autocompletar').value = p.nombre;
    document.getElementById('presup-prod-select').value = `${p.nombre}|${p.precio}|${p.tipo}|${p.subtipo}`;
    document.getElementById('presup-prod-autocompletar-opciones').classList.add('hidden');
    document.getElementById('presup-prod-subtipo-detectado').textContent = `${p.tipo} ${p.subtipo}`;
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#presup-prod-autocompletar') && !e.target.closest('#presup-prod-autocompletar-opciones')) {
        document.getElementById('presup-prod-autocompletar-opciones')?.classList.add('hidden');
    }
});

function agregarProductoPresupuesto() {
    const prodSelect = document.getElementById('presup-prod-select').value;
    const cantidad = parseInt(document.getElementById('presup-prod-cant').value);

    if (!prodSelect) return alert('Elegí un producto de la lista de sugerencias.');
    if (!cantidad || cantidad <= 0) return alert('Ingrese una cantidad válida.');

    const [nombre, precioStr, tipo, subtipo] = prodSelect.split('|');
    const precioUnitario = parseFloat(precioStr);

    const itemExistente = itemsPresupuestoActual.find(item => item.nombre === nombre && item.tipo === tipo && item.subtipo === subtipo);
    if (itemExistente) {
        itemExistente.cantidad += cantidad;
        itemExistente.subtotal = itemExistente.cantidad * itemExistente.precioUnitario;
    } else {
        itemsPresupuestoActual.push({ id: Date.now(), nombre, tipo, subtipo, cantidad, precioUnitario, subtotal: precioUnitario * cantidad });
    }
    document.getElementById('presup-prod-autocompletar').value = '';
    document.getElementById('presup-prod-select').value = '';
    document.getElementById('presup-prod-subtipo-detectado').textContent = '';
    document.getElementById('presup-prod-cant').value = 1;
    renderizarTablaItemsPresupuesto();
}

function eliminarItemPresupuesto(id) {
    itemsPresupuestoActual = itemsPresupuestoActual.filter(item => item.id !== id);
    renderizarTablaItemsPresupuesto();
}

function renderizarTablaItemsPresupuesto() {
    const tbody = document.getElementById('tabla-items-presupuesto');
    tbody.innerHTML = '';
    itemsPresupuestoActual.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 text-slate-500">${item.tipo}</td>
            <td class="p-3 text-slate-500">${item.subtipo}</td>
            <td class="p-3 font-medium text-slate-800">${item.nombre}</td>
            <td class="p-3 text-center">${item.cantidad}</td>
            <td class="p-3 text-right">$ ${item.precioUnitario.toLocaleString()}</td>
            <td class="p-3 text-right font-semibold">$ ${item.subtotal.toLocaleString()}</td>
            <td class="p-3 text-center">
                <button type="button" onclick="eliminarItemPresupuesto(${item.id})" class="text-red-500 hover:text-red-700">
                    <i data-lucide="trash-2" class="w-4 h-4 inline"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
    calcularTotalPresupuesto();
}

function calcularTotalPresupuesto() {
    const subtotal = itemsPresupuestoActual.reduce((acc, i) => acc + i.subtotal, 0);

    // Igual que en Registrar Pedido: la bonificación se habilita para clientes Mayoristas,
    // y también para Mostrador cuando el presupuesto es para un Evento.
    const esEventoPresupuesto = document.getElementById('presup-es-evento').checked;
    const descuentoHabilitado = !!clienteSeleccionadoPresupuesto && (clienteSeleccionadoPresupuesto.tipo_cliente === 'Mayorista' || esEventoPresupuesto);
    const inputBonificacion = document.getElementById('presup-bonificacion');
    inputBonificacion.disabled = !descuentoHabilitado;
    if (!descuentoHabilitado) inputBonificacion.value = 0;
    document.getElementById('nota-bonificacion-presupuesto-restringida').classList.toggle('hidden', descuentoHabilitado);

    const bonifPct = parseFloat(inputBonificacion.value) || 0;
    const bonifMonto = subtotal * (bonifPct / 100);
    const total = Math.max(0, subtotal - bonifMonto);

    document.getElementById('cant-items-presupuesto').innerText = itemsPresupuestoActual.length;
    document.getElementById('subtotal-presupuesto-monto').innerText = `$ ${subtotal.toLocaleString()}`;
    document.getElementById('label-bonificacion-presupuesto').innerText = `Bonificación (${bonifPct}%)`;
    document.getElementById('bonificacion-presupuesto-monto').innerText = `-$ ${bonifMonto.toLocaleString()}`;
    document.getElementById('total-presupuesto-monto').innerText = `$ ${total.toLocaleString()}`;
    return total;
}

function resetFormularioPresupuesto() {
    itemsPresupuestoActual = [];
    clienteSeleccionadoPresupuesto = null;
    presupuestoEnEdicionId = null;
    document.getElementById('titulo-form-presupuesto').innerText = 'Registrar Presupuesto';
    document.getElementById('btn-guardar-presupuesto').innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i><span>Guardar Presupuesto</span>';
    document.getElementById('presup-cliente-autocompletar').value = '';
    document.getElementById('select-presup-cliente').value = '';
    document.getElementById('ficha-cliente-presupuesto').classList.add('hidden');
    document.getElementById('presup-es-evento').checked = false;
    document.getElementById('presup-bonificacion').value = 0;
    document.getElementById('presup-observaciones').value = '';
    document.getElementById('presup-prod-autocompletar').value = '';
    document.getElementById('presup-prod-select').value = '';
    document.getElementById('presup-prod-subtipo-detectado').textContent = '';
    document.getElementById('presup-prod-cant').value = 1;
    renderizarTablaItemsPresupuesto();
    lucide.createIcons();
}

function irARegistrarPresupuesto() {
    resetFormularioPresupuesto();
    mostrarSubvistaVentas('registrar-presupuesto');
    if (window.location.hash !== '#registrar-presupuesto') window.location.hash = 'registrar-presupuesto';
}

function volverAPresupuestos() {
    renderizarTablaPresupuestos();
    mostrarSubvistaVentas('presupuestos');
    if (window.location.hash !== '#presupuestos') window.location.hash = 'presupuestos';
}

function editarPresupuesto(id) {
    const presupuesto = listaPresupuestos.find(p => p.id === id);
    if (!presupuesto || presupuesto.estado !== 'Pendiente') return;

    presupuestoEnEdicionId = id;
    itemsPresupuestoActual = presupuesto.detalle.map(i => ({ ...i }));

    document.getElementById('titulo-form-presupuesto').innerText = `Editar Presupuesto PRES-${id}`;
    document.getElementById('btn-guardar-presupuesto').innerHTML = '<i data-lucide="save" class="w-4 h-4"></i><span>Guardar Cambios</span>';

    elegirClientePresupuesto(listaClientes.indexOf(presupuesto.clienteObj));
    document.getElementById('presup-es-evento').checked = !!presupuesto.esEvento;
    document.getElementById('presup-bonificacion').value = presupuesto.bonificacion || 0;
    document.getElementById('presup-observaciones').value = presupuesto.observaciones || '';
    document.getElementById('presup-prod-autocompletar').value = '';
    document.getElementById('presup-prod-select').value = '';
    document.getElementById('presup-prod-subtipo-detectado').textContent = '';
    document.getElementById('presup-prod-cant').value = 1;

    renderizarTablaItemsPresupuesto();
    mostrarSubvistaVentas('registrar-presupuesto');
    if (window.location.hash !== '#registrar-presupuesto') window.location.hash = 'registrar-presupuesto';
    lucide.createIcons();
}

function guardarPresupuesto() {
    if (!clienteSeleccionadoPresupuesto) return alert('Buscá y seleccioná el cliente del presupuesto.');
    if (itemsPresupuestoActual.length === 0) return alert('Añadí al menos un producto al presupuesto.');

    const tipo = clienteSeleccionadoPresupuesto.tipo_cliente;
    const esEvento = document.getElementById('presup-es-evento').checked;
    const bonificacion = parseFloat(document.getElementById('presup-bonificacion').value) || 0;
    const observaciones = document.getElementById('presup-observaciones').value.trim();
    const detalle = itemsPresupuestoActual.map(i => ({ ...i }));
    const total = calcularTotalPresupuesto();

    if (presupuestoEnEdicionId) {
        const presupuesto = listaPresupuestos.find(p => p.id === presupuestoEnEdicionId);
        Object.assign(presupuesto, { clienteObj: clienteSeleccionadoPresupuesto, cliente: clienteSeleccionadoPresupuesto.nombreMostrado, tipo, esEvento, bonificacion, observaciones, detalle, total });
        guardarDatos();
        alert(`¡Presupuesto PRES-${presupuesto.id} actualizado con éxito!`);
    } else {
        const ahora = new Date();
        const nuevoPresupuesto = {
            id: numPresupuestoContador++,
            clienteObj: clienteSeleccionadoPresupuesto,
            cliente: clienteSeleccionadoPresupuesto.nombreMostrado,
            tipo, esEvento, bonificacion, observaciones, detalle, total,
            estado: 'Pendiente',
            idPedidoGenerado: null,
            creadoPor: usuarioInternoActual.nombre,
            fecha: ahora.toISOString().slice(0, 10), hora: ahora.toTimeString().slice(0, 5)
        };
        listaPresupuestos.unshift(nuevoPresupuesto);
        guardarDatos();
        alert(`¡Presupuesto PRES-${nuevoPresupuesto.id} guardado para "${nuevoPresupuesto.cliente}"!`);
    }
    volverAPresupuestos();
}

function renderizarTablaPresupuestos() {
    const tbody = document.getElementById('tabla-presupuestos');
    tbody.innerHTML = '';

    const terminoNumPresupuesto = normalizarTexto(document.getElementById('buscar-num-presupuesto')?.value || '').trim();
    const terminoNombre = normalizarTexto(document.getElementById('buscar-nombre-presupuesto')?.value || '').trim();
    const terminoApellido = normalizarTexto(document.getElementById('buscar-apellido-presupuesto')?.value || '').trim();
    const terminoDocumento = normalizarTexto(document.getElementById('buscar-documento-presupuesto')?.value || '').trim();

    const presupuestosFiltrados = listaPresupuestos.filter(pr => {
        const nombre = pr.clienteObj ? pr.clienteObj.nombre : '';
        const apellido = pr.clienteObj ? pr.clienteObj.apellido : '';
        const documento = pr.clienteObj ? pr.clienteObj.numero_documento : '';
        const tipoDocumento = pr.clienteObj ? pr.clienteObj.tipo_documento : '';
        return (!terminoNumPresupuesto || String(pr.id).includes(terminoNumPresupuesto)) &&
            (!terminoNombre || normalizarTexto(nombre).includes(terminoNombre)) &&
            (!terminoApellido || normalizarTexto(apellido).includes(terminoApellido)) &&
            (!terminoDocumento || normalizarTexto(documento).includes(terminoDocumento)) &&
            (!filtroPresupuestoTipoDocSeleccionado || tipoDocumento === filtroPresupuestoTipoDocSeleccionado) &&
            (!filtroPresupuestoEstadoSeleccionado || pr.estado === filtroPresupuestoEstadoSeleccionado) &&
            (!filtroPresupuestoTipoSeleccionado || pr.tipo === filtroPresupuestoTipoSeleccionado) &&
            (!segmentoPresupuestoSeleccionado || pr.esEvento);
    });

    if (ordenPresupuestoCampo && ordenPresupuestoDireccion) {
        presupuestosFiltrados.sort((a, b) => {
            const va = (a.clienteObj ? a.clienteObj[ordenPresupuestoCampo] : '') || '';
            const vb = (b.clienteObj ? b.clienteObj[ordenPresupuestoCampo] : '') || '';
            const cmp = va.localeCompare(vb, 'es');
            return ordenPresupuestoDireccion === 'asc' ? cmp : -cmp;
        });
    }
    actualizarIconosOrdenPresupuestos();
    actualizarIconoFiltroTipoPresupuestos();
    actualizarIconoFiltroTipoDocPresupuestos();
    actualizarIconoFiltroEstadoPresupuestos();
    actualizarSegmentoPresupuestos();

    if (!presupuestosFiltrados.length) {
        tbody.innerHTML = `<tr><td colspan="10" class="px-6 py-10 text-center text-slate-400 text-sm">No se encontraron presupuestos con ese criterio.</td></tr>`;
    }
    presupuestosFiltrados.forEach(pr => {
        const fechaFormateada = pr.fecha ? new Date(pr.fecha + 'T00:00:00').toLocaleDateString('es-AR') : '-';
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="px-6 py-4 font-semibold text-slate-900">PRES-${pr.id}</td>
            <td class="px-6 py-4">${pr.clienteObj ? pr.clienteObj.nombre : '-'}</td>
            <td class="px-6 py-4">${pr.clienteObj ? pr.clienteObj.apellido : '-'}</td>
            <td class="px-6 py-4 text-slate-500">${pr.clienteObj ? pr.clienteObj.tipo_documento : '-'}</td>
            <td class="px-6 py-4 text-slate-500">${pr.clienteObj ? pr.clienteObj.numero_documento : '-'}</td>
            <td class="px-6 py-4">${badgeTipoCliente(pr.tipo)}</td>
            <td class="px-6 py-4 text-slate-500">${fechaFormateada}</td>
            <td class="px-6 py-4 text-right font-medium whitespace-nowrap">$ ${pr.total.toLocaleString()}</td>
            <td class="px-6 py-4 text-center"><span class="px-2.5 py-1 ${pr.estado === 'Convertido' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} text-xs font-semibold rounded-full whitespace-nowrap">${pr.estado}</span></td>
            <td class="px-6 py-4">
                <div class="flex items-center justify-start gap-1.5">
                    <button onclick="verPresupuesto(${pr.id})" title="Ver presupuesto" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    ${pr.estado === 'Pendiente' ? `<button onclick="editarPresupuesto(${pr.id})" title="Editar presupuesto" class="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>` : ''}
                    ${pr.estado === 'Pendiente' ? `<button onclick="generarPedidoDesdePresupuesto(${pr.id})" title="Generar pedido a partir de este presupuesto" class="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"><i data-lucide="arrow-right-circle" class="w-4 h-4"></i></button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function alternarOrdenPresupuestos(campo) {
    if (ordenPresupuestoCampo !== campo) {
        ordenPresupuestoCampo = campo;
        ordenPresupuestoDireccion = 'asc';
    } else if (ordenPresupuestoDireccion === 'asc') {
        ordenPresupuestoDireccion = 'desc';
    } else {
        ordenPresupuestoCampo = null;
        ordenPresupuestoDireccion = null;
    }
    renderizarTablaPresupuestos();
}

function actualizarIconosOrdenPresupuestos() {
    ['nombre', 'apellido'].forEach(campo => {
        const boton = document.getElementById(`btn-orden-${campo}-presupuesto`);
        if (!boton) return;
        const activo = ordenPresupuestoCampo === campo;
        const icono = activo && ordenPresupuestoDireccion === 'asc' ? 'arrow-up' : activo && ordenPresupuestoDireccion === 'desc' ? 'arrow-down' : 'arrow-up-down';
        boton.title = activo ? (ordenPresupuestoDireccion === 'asc' ? 'Ordenado de la A a la Z' : 'Ordenado de la Z a la A') : 'Ordenar de la A a la Z';
        boton.className = `normal-case transition ${activo ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
        boton.innerHTML = `<i data-lucide="${icono}" class="w-3.5 h-3.5"></i>`;
    });
}

function elegirFiltroTipoPresupuestos(valor) {
    filtroPresupuestoTipoSeleccionado = valor;
    document.getElementById('pop-tipo-presupuesto').classList.add('hidden');
    renderizarTablaPresupuestos();
}

function elegirSegmentoPresupuestos(valor) {
    segmentoPresupuestoSeleccionado = valor;
    renderizarTablaPresupuestos();
}

function actualizarSegmentoPresupuestos() {
    ['', 'Evento'].forEach(valor => {
        const boton = document.getElementById(`segmento-presupuestos-${valor}`);
        if (!boton) return;
        const activo = segmentoPresupuestoSeleccionado === valor;
        boton.className = `segmento-presupuestos px-3 py-1.5 rounded-md font-semibold transition ${activo ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-white'}`;
    });
}

function actualizarIconoFiltroTipoPresupuestos() {
    const boton = document.getElementById('btn-filtro-tipo-presupuesto');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroPresupuestoTipoSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-tipo-presupuesto').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroPresupuestoTipoSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroPresupuestoTipoSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroPresupuestoTipoSeleccionado);
    });
}

function elegirFiltroTipoDocPresupuestos(valor) {
    filtroPresupuestoTipoDocSeleccionado = valor;
    document.getElementById('pop-tipo-doc-presupuesto').classList.add('hidden');
    renderizarTablaPresupuestos();
}

function actualizarIconoFiltroTipoDocPresupuestos() {
    const boton = document.getElementById('btn-filtro-tipo-doc-presupuesto');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroPresupuestoTipoDocSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-tipo-doc-presupuesto').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroPresupuestoTipoDocSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroPresupuestoTipoDocSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroPresupuestoTipoDocSeleccionado);
    });
}

function elegirFiltroEstadoPresupuestos(valor) {
    filtroPresupuestoEstadoSeleccionado = valor;
    document.getElementById('pop-estado-presupuesto').classList.add('hidden');
    renderizarTablaPresupuestos();
}

function actualizarIconoFiltroEstadoPresupuestos() {
    const boton = document.getElementById('btn-filtro-estado-presupuesto');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroPresupuestoEstadoSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-estado-presupuesto').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroPresupuestoEstadoSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroPresupuestoEstadoSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroPresupuestoEstadoSeleccionado);
    });
}

function verPresupuesto(id) {
    const pr = listaPresupuestos.find(p => p.id === id);
    if (!pr) return;
    const fechaFormateada = pr.fecha ? new Date(pr.fecha + 'T00:00:00').toLocaleDateString('es-AR') : '-';

    const c = pr.clienteObj;
    // Datos básicos del cliente en una sola línea: Nombre/Razón social, DNI/CUIT, domicilio, tipo de cliente y teléfono.
    document.getElementById('presupuesto-cliente-linea').innerHTML = c
        ? `Cliente: ${c.nombreMostrado} · ${c.documentoCompleto} · ${c.direccionCompleta} · ${c.tipo_cliente} · Tel: ${c.telefono || '-'}`
        : `Cliente: ${pr.cliente}`;
    document.getElementById('presupuesto-numero').innerText = `PRES-${String(pr.id).padStart(5, '0')}`;
    document.getElementById('presupuesto-fecha').innerText = `Fecha: ${fechaFormateada}`;
    const badge = document.getElementById('presupuesto-estado-badge');
    badge.textContent = pr.estado;
    badge.className = `inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${pr.estado === 'Convertido' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`;

    // Para Mayoristas o presupuestos de Evento, el % de bonificación se exhibe de forma destacada junto al estado.
    const badgeBonif = document.getElementById('presupuesto-bonificacion-badge');
    if (pr.bonificacion && (pr.tipo === 'Mayorista' || pr.esEvento)) {
        badgeBonif.textContent = `Bonificación ${pr.bonificacion}%`;
        badgeBonif.classList.remove('hidden');
    } else {
        badgeBonif.classList.add('hidden');
    }

    document.getElementById('presupuesto-detalle-body').innerHTML = pr.detalle.map(i => `
        <tr>
            <td class="py-2 text-slate-500">${i.tipo}</td>
            <td class="py-2 text-slate-500">${i.subtipo}</td>
            <td class="py-2">${i.nombre}</td>
            <td class="py-2 text-center">${i.cantidad}</td>
            <td class="py-2 text-right">$ ${i.precioUnitario.toLocaleString()}</td>
            <td class="py-2 text-right">$ ${i.subtotal.toLocaleString()}</td>
        </tr>`).join('');
    const subtotalPresupuesto = pr.detalle.reduce((acc, i) => acc + i.subtotal, 0);
    const bonifMonto = subtotalPresupuesto * ((pr.bonificacion || 0) / 100);
    document.getElementById('presupuesto-total-monto').innerHTML = (pr.bonificacion
        ? `<span class="block text-xs font-normal text-slate-500">Subtotal: $ ${subtotalPresupuesto.toLocaleString()}</span>
           <span class="block text-xs font-normal text-emerald-600">Bonificación (${pr.bonificacion}%): -$ ${bonifMonto.toLocaleString()}</span>`
        : '') + `Total Presupuestado: $ ${pr.total.toLocaleString()}`;

    const wrapGenerar = document.getElementById('presupuesto-generar-pedido-wrap');
    wrapGenerar.innerHTML = pr.estado === 'Pendiente'
        ? `<button type="button" onclick="editarPresupuesto(${pr.id})" class="bg-slate-100 border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-200 flex items-center space-x-2"><i data-lucide="pencil" class="w-4 h-4"></i><span>Editar</span></button>
           <button type="button" onclick="generarPedidoDesdePresupuesto(${pr.id})" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center space-x-2"><i data-lucide="arrow-right-circle" class="w-4 h-4"></i><span>Generar Pedido</span></button>`
        : pr.idPedidoGenerado ? `<p class="text-xs text-slate-500">Convertido en el pedido PED-${pr.idPedidoGenerado}.</p>` : '';
    lucide.createIcons();
    mostrarSubvistaVentas('presupuesto');
}

// Precarga el formulario de Registrar Pedido con los datos del presupuesto. La conversión se confirma
// recién cuando el pedido efectivamente se guarda (ver el final de confirmarPedido).
function generarPedidoDesdePresupuesto(id) {
    const pr = listaPresupuestos.find(p => p.id === id);
    if (!pr || pr.estado !== 'Pendiente') return;

    resetFormularioPedido();
    presupuestoEnConversionId = id;

    elegirClientePedido(listaClientes.indexOf(pr.clienteObj));
    document.getElementById('pedido-es-evento').checked = !!pr.esEvento;
    document.getElementById('pedido-bonificacion').value = pr.bonificacion || 0;
    document.getElementById('pedido-observaciones').value = pr.observaciones || '';
    itemsPedidoActual = pr.detalle.map(i => ({ ...i }));
    renderizarTablaPedido();

    mostrarSubvistaVentas('nuevo-pedido');
    if (window.location.hash !== '#registrar') window.location.hash = 'registrar';
    lucide.createIcons();
}

// ==========================================
// MÓDULO DE DEVOLUCIÓN DE PEDIDOS
// ==========================================
let pedidoParaDevolucion = null;

function cantidadYaDevuelta(pedido, item) {
    return (pedido.devoluciones || []).reduce((acc, d) =>
        acc + d.items.filter(i => i.nombre === item.nombre && i.tipo === item.tipo && i.subtipo === item.subtipo).reduce((a, i) => a + i.cantidad, 0), 0);
}

function abrirModalDevolucion(id) {
    const pedido = listaPedidos.find(p => p.id === id);
    if (!pedido || (pedido.estado !== 'Entregado' && pedido.estado !== 'Devuelto')) return;

    pedidoParaDevolucion = pedido;
    document.getElementById('devolucion-pedido-id').innerText = `PED-${pedido.id}`;
    document.getElementById('devolucion-pedido-cliente').innerText = pedido.clienteObj ? pedido.clienteObj.nombreMostrado : pedido.cliente;
    document.getElementById('devolucion-motivo').value = '';
    renderizarTablaItemsDevolucion();
    renderizarHistorialDevoluciones();
    document.getElementById('modal-devolucion').classList.remove('hidden');
    lucide.createIcons();
}

function cerrarModalDevolucion() {
    pedidoParaDevolucion = null;
    document.getElementById('modal-devolucion').classList.add('hidden');
}

function renderizarTablaItemsDevolucion() {
    const tbody = document.getElementById('tabla-items-devolucion');
    tbody.innerHTML = pedidoParaDevolucion.detalle.map((item, idx) => {
        const yaDevuelto = cantidadYaDevuelta(pedidoParaDevolucion, item);
        const disponible = item.cantidad - yaDevuelto;
        return `
        <tr>
            <td class="p-3 font-medium text-slate-800">${item.nombre}</td>
            <td class="p-3 text-center">${item.cantidad}</td>
            <td class="p-3 text-center text-slate-500">${yaDevuelto}</td>
            <td class="p-3 text-center">
                <input type="number" id="devolver-cant-${idx}" min="0" max="${disponible}" value="0" ${disponible <= 0 ? 'disabled' : ''} class="w-20 text-center border border-slate-300 rounded-md p-1 text-sm outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-100">
            </td>
        </tr>`;
    }).join('');
}

function renderizarHistorialDevoluciones() {
    const wrap = document.getElementById('devolucion-historial');
    const lista = document.getElementById('devolucion-historial-lista');
    const devoluciones = pedidoParaDevolucion.devoluciones || [];
    if (!devoluciones.length) { wrap.classList.add('hidden'); return; }
    lista.innerHTML = devoluciones.map(d => `
        <div class="border border-slate-200 rounded-lg p-2.5">
            <p class="font-semibold text-slate-700">${new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-AR')} ${d.hora} — registrado por ${d.registradoPor}</p>
            <p class="text-slate-500">${d.items.map(i => `${i.cantidad} × ${i.nombre}`).join(', ')}</p>
            ${d.motivo ? `<p class="text-slate-400 italic">"${d.motivo}"</p>` : ''}
        </div>`).join('');
    wrap.classList.remove('hidden');
}

function registrarDevolucion() {
    if (!pedidoParaDevolucion) return;
    const motivo = document.getElementById('devolucion-motivo').value.trim();
    if (!motivo) return alert('Indicá el motivo de la devolución.');

    const itemsADevolver = [];
    for (let idx = 0; idx < pedidoParaDevolucion.detalle.length; idx++) {
        const item = pedidoParaDevolucion.detalle[idx];
        const cantidad = parseInt(document.getElementById(`devolver-cant-${idx}`).value) || 0;
        const yaDevuelto = cantidadYaDevuelta(pedidoParaDevolucion, item);
        const disponible = item.cantidad - yaDevuelto;
        if (cantidad > disponible) return alert(`No se puede devolver más de lo disponible para "${item.nombre}".`);
        if (cantidad > 0) itemsADevolver.push({ nombre: item.nombre, tipo: item.tipo, subtipo: item.subtipo, cantidad });
    }

    if (!itemsADevolver.length) return alert('Indicá al menos una cantidad a devolver.');

    const ahora = new Date();
    if (!pedidoParaDevolucion.devoluciones) pedidoParaDevolucion.devoluciones = [];
    pedidoParaDevolucion.devoluciones.push({
        id: Date.now(), registradoPor: usuarioInternoActual.nombre, motivo,
        items: itemsADevolver, fecha: ahora.toISOString().slice(0, 10), hora: ahora.toTimeString().slice(0, 5)
    });
    // Cualquier devolución, aunque sea parcial, marca el pedido como "Devuelto".
    pedidoParaDevolucion.estado = 'Devuelto';
    guardarDatos();
    alert(`¡Devolución registrada para el pedido PED-${pedidoParaDevolucion.id}!`);
    document.getElementById('devolucion-motivo').value = '';
    renderizarTablaItemsDevolucion();
    renderizarHistorialDevoluciones();
    renderizarTablaPedidosRegistrados();
}

function initPaginaVentas() {
    inicializarCombosUbicacion();
    renderizarClientesUI();
    renderizarEmpleadosUI();
    renderizarTablaPedidosRegistrados();
    resetFormularioPedido();
    irASubvistaDesdeHash();
    window.addEventListener('hashchange', irASubvistaDesdeHash);
}
