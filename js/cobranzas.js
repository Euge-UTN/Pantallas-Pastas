// ==========================================
// MÓDULO DE COBRANZAS
// Registrar Cobro -> Pagos (Comprobantes de Pago) -> Reporte de Caja.
// El listado de Comprobantes de Venta vive en el módulo de Ventas (js/ventas.js); desde ahí, el ícono
// "Registrar cobro" llega hasta acá pasando el id elegido por sessionStorage (ver irASubvistaDesdeHashCobranzas).
// ==========================================

const SUBVISTAS_COBRANZAS = ['registrar-cobro', 'pagos', 'comprobante-pago', 'reporte-caja'];
function mostrarSubvistaCobranzas(subvista) {
    SUBVISTAS_COBRANZAS.forEach(v => document.getElementById(`vista-${v}`).classList.add('hidden'));
    const vistaDestino = document.getElementById(`vista-${subvista}`);
    if (vistaDestino) vistaDestino.classList.remove('hidden');
}

// Navegación por hash: sincroniza el sub-menú del sidebar (#pagos / #registrar-cobro) con la subvista mostrada.
function irASubvistaDesdeHashCobranzas() {
    const hash = (window.location.hash || '').replace('#', '') || 'pagos';
    if (hash === 'registrar-cobro') {
        const idPrefill = sessionStorage.getItem('cobro_prefill_cv');
        if (idPrefill) {
            sessionStorage.removeItem('cobro_prefill_cv');
            registrarCobroDesdeComprobanteVenta(parseInt(idPrefill));
        } else if (!comprobanteVentaSeleccionadoCobro) {
            resetFormularioCobro();
        }
        mostrarSubvistaCobranzas('registrar-cobro');
    } else {
        renderizarTablaPagos();
        mostrarSubvistaCobranzas('pagos');
    }
}

// ==========================================
// REGISTRAR COBRO
// ==========================================
let clienteSeleccionadoCobro = null;
let comprobanteVentaSeleccionadoCobro = null;
let comprobantesClienteCobroActual = []; // comprobantes cobrables del cliente elegido, para el modal de selección
let origenComprobantePago = 'registrar-cobro'; // a qué vista vuelve el botón "atrás" del comprobante de pago

function resetFormularioCobro() {
    clienteSeleccionadoCobro = null;
    comprobanteVentaSeleccionadoCobro = null;
    comprobantesClienteCobroActual = [];
    document.getElementById('cobro-cliente-autocompletar').value = '';
    document.getElementById('select-cobro-cliente').value = '';
    document.getElementById('cobro-comprobante-venta').innerHTML = '<option value="" disabled selected>Elegí primero el cliente</option>';
    document.getElementById('btn-elegir-comprobante-cobro').disabled = true;
    document.getElementById('btn-elegir-comprobante-cobro-texto').textContent = 'Elegí primero el cliente';
    document.getElementById('ficha-cv-cobro').classList.add('hidden');
    document.getElementById('cobro-monto').value = '';
    document.getElementById('cobro-monto').disabled = true;
    document.getElementById('nota-saldo-cobro').classList.add('hidden');
    document.getElementById('cobro-medio').selectedIndex = 0;
    document.getElementById('cobro-condicion').selectedIndex = 0;
    const ahora = new Date();
    document.getElementById('cobro-fecha').value = ahora.toISOString().slice(0, 10);
    document.getElementById('cobro-hora').value = ahora.toTimeString().slice(0, 5);
    document.getElementById('cobro-observaciones').value = '';
    aplicarRestriccionCondicionPagoCobro();
    mostrarEmpleadoAutoasignadoCobro();
}

function mostrarEmpleadoAutoasignadoCobro() {
    document.getElementById('cobro-empleado').value = usuarioInternoActual.nombre;
    document.getElementById('cobro-empleado-nombre').textContent = `${usuarioInternoActual.nombre} (${usuarioInternoActual.rol})`;
}

function irARegistrarCobro() {
    resetFormularioCobro();
    mostrarSubvistaCobranzas('registrar-cobro');
    if (window.location.hash !== '#registrar-cobro') window.location.hash = 'registrar-cobro';
}

function filtrarClientesAutocompletadoCobro() {
    const input = document.getElementById('cobro-cliente-autocompletar');
    const cont = document.getElementById('cobro-cliente-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    document.getElementById('select-cobro-cliente').value = '';
    clienteSeleccionadoCobro = null;
    comprobanteVentaSeleccionadoCobro = null;
    comprobantesClienteCobroActual = [];
    document.getElementById('cobro-comprobante-venta').innerHTML = '<option value="" disabled selected>Elegí primero el cliente</option>';
    document.getElementById('btn-elegir-comprobante-cobro').disabled = true;
    document.getElementById('btn-elegir-comprobante-cobro-texto').textContent = 'Elegí primero el cliente';
    document.getElementById('ficha-cv-cobro').classList.add('hidden');
    document.getElementById('cobro-monto').value = '';

    if (!termino) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }

    const filtrados = listaClientes.filter(c => normalizarTexto(`${c.nombre} ${c.apellido}`).includes(termino) || normalizarTexto(c.numero_documento).includes(termino));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(c => {
        const idx = listaClientes.indexOf(c);
        return `<button type="button" onmousedown="event.preventDefault(); elegirClienteCobro(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${c.nombre} ${c.apellido}</span>
            <span class="block text-[11px] text-slate-400">${c.tipo_cliente} · ${c.documentoCompleto}</span>
        </button>`;
    }).join('');
    cont.classList.remove('hidden');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#cobro-cliente-autocompletar') && !e.target.closest('#cobro-cliente-autocompletar-opciones')) {
        document.getElementById('cobro-cliente-autocompletar-opciones')?.classList.add('hidden');
    }
});

function elegirClienteCobro(idx) {
    clienteSeleccionadoCobro = listaClientes[idx];
    document.getElementById('cobro-cliente-autocompletar').value = clienteSeleccionadoCobro.nombreMostrado;
    document.getElementById('select-cobro-cliente').value = idx;
    document.getElementById('cobro-cliente-autocompletar-opciones').classList.add('hidden');

    comprobantesClienteCobroActual = listaComprobantesVenta.filter(cv => cv.clienteObj === clienteSeleccionadoCobro && comprobanteVentaEsCobrable(cv));
    const selectComprobante = document.getElementById('cobro-comprobante-venta');
    selectComprobante.innerHTML = `<option value="" disabled selected>${comprobantesClienteCobroActual.length ? 'Elegí un comprobante' : 'Este cliente no tiene comprobantes pendientes'}</option>` +
        comprobantesClienteCobroActual.map(cv => `<option value="${cv.id_comprobante_venta_cliente}">${formatearIdentificador("CV", String(cv.id_comprobante_venta_cliente).padStart(4, '0'))} - $ ${cv.total.toLocaleString()}</option>`).join('');

    const btn = document.getElementById('btn-elegir-comprobante-cobro');
    btn.disabled = !comprobantesClienteCobroActual.length;
    document.getElementById('btn-elegir-comprobante-cobro-texto').textContent = comprobantesClienteCobroActual.length ? 'Elegí un comprobante' : 'Este cliente no tiene comprobantes pendientes';

    aplicarRestriccionCondicionPagoCobro();

    document.getElementById('ficha-cv-cobro').classList.add('hidden');
    document.getElementById('cobro-monto').value = '';
    comprobanteVentaSeleccionadoCobro = null;
}

// Los clientes Mostrador solo pueden pagar al Contado: se oculta "Cuenta Corriente" y, si estaba elegida, se fuerza a "Contado".
function aplicarRestriccionCondicionPagoCobro() {
    const opcionCtaCte = document.getElementById('cobro-condicion-cuenta-corriente');
    const selectCondicion = document.getElementById('cobro-condicion');
    const nota = document.getElementById('nota-condicion-pago-mostrador');
    const esMostrador = !!clienteSeleccionadoCobro && clienteSeleccionadoCobro.tipo_cliente === 'Mostrador';

    opcionCtaCte.classList.toggle('hidden', esMostrador);
    opcionCtaCte.disabled = esMostrador;
    nota.classList.toggle('hidden', !esMostrador);
    if (esMostrador && selectCondicion.value === 'Cuenta Corriente') selectCondicion.value = 'Contado';
}

// Abre el modal con la previsualización de cada comprobante cobrable del cliente elegido - muestra cliente,
// fecha, pedido asociado y detalle de productos, para distinguir comprobantes con el mismo monto sin
// depender de memorizar el N° de comprobante.
function abrirModalComprobantesCobro() {
    if (!comprobantesClienteCobroActual.length) return;
    const cont = document.getElementById('lista-comprobantes-cobro-modal');
    cont.innerHTML = comprobantesClienteCobroActual.map(cv => {
        const fechaFormateada = cv.fecha_emision ? new Date(cv.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '-';
        const detalle = (cv.detalle || []).map(i => `${i.cantidad} × ${i.nombre}`).join(', ');
        return `
        <button type="button" onclick="elegirComprobanteCobroDesdeModal(${cv.id_comprobante_venta_cliente})" class="block w-full text-left border border-slate-200 rounded-lg p-3 hover:border-red-400 hover:bg-red-50/40 transition">
            <div class="flex items-center justify-between">
                <span class="font-semibold text-slate-900 text-sm">${formatearIdentificador("CV", String(cv.id_comprobante_venta_cliente).padStart(4, '0'))}</span>
                <span class="font-bold text-slate-900 text-sm">$ ${cv.total.toLocaleString()}</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">Pedido ${formatearIdentificador("PED", cv.id_orden_pedido_cliente)} · ${fechaFormateada} · ${cv.condicion_venta}</p>
            ${detalle ? `<p class="text-xs text-slate-400 mt-1">${detalle}</p>` : ''}
        </button>`;
    }).join('');
    document.getElementById('modal-elegir-comprobante-cobro').classList.remove('hidden');
    lucide.createIcons();
}

function cerrarModalComprobantesCobro() {
    document.getElementById('modal-elegir-comprobante-cobro').classList.add('hidden');
}

function elegirComprobanteCobroDesdeModal(idComprobante) {
    document.getElementById('cobro-comprobante-venta').value = idComprobante;
    seleccionarComprobanteVentaCobro();
    cerrarModalComprobantesCobro();
}

function seleccionarComprobanteVentaCobro() {
    const idComprobante = parseInt(document.getElementById('cobro-comprobante-venta').value);
    const ficha = document.getElementById('ficha-cv-cobro');
    const inputMonto = document.getElementById('cobro-monto');
    const textoBoton = document.getElementById('btn-elegir-comprobante-cobro-texto');

    const notaSaldo = document.getElementById('nota-saldo-cobro');
    if (isNaN(idComprobante)) {
        ficha.classList.add('hidden'); inputMonto.value = ''; inputMonto.disabled = true; comprobanteVentaSeleccionadoCobro = null;
        notaSaldo.classList.add('hidden');
        if (textoBoton) textoBoton.textContent = comprobantesClienteCobroActual.length ? 'Elegí un comprobante' : 'Elegí primero el cliente';
        return;
    }

    const cv = listaComprobantesVenta.find(c => c.id_comprobante_venta_cliente === idComprobante);
    comprobanteVentaSeleccionadoCobro = cv;
    const fechaFormateada = cv.fecha_emision ? new Date(cv.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '-';
    const yaCobrado = totalCobradoComprobanteVenta(cv.id_comprobante_venta_cliente);
    const saldoPendiente = cv.total - yaCobrado;

    if (textoBoton) textoBoton.textContent = `${formatearIdentificador("CV", String(cv.id_comprobante_venta_cliente).padStart(4, '0'))} - $ ${cv.total.toLocaleString()}`;

    ficha.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            <p><b class="text-slate-700">Fecha de Emisión:</b> ${fechaFormateada}</p>
            <p><b class="text-slate-700">Condición de Venta:</b> ${cv.condicion_venta}</p>
            <p><b class="text-slate-700">Pedido Asociado:</b> ${formatearIdentificador("PED", cv.id_orden_pedido_cliente)}</p>
            <p><b class="text-slate-700">Total del Comprobante:</b> $ ${cv.total.toLocaleString()}</p>
            ${yaCobrado > 0 ? `<p class="sm:col-span-2"><b class="text-slate-700">Ya cobrado (seña/pagos parciales):</b> $ ${yaCobrado.toLocaleString()}</p>` : ''}
        </div>`;
    ficha.classList.remove('hidden');
    inputMonto.disabled = false;
    inputMonto.max = saldoPendiente;
    inputMonto.value = saldoPendiente;
    notaSaldo.textContent = `Saldo pendiente: $ ${saldoPendiente.toLocaleString()}. Podés cobrar un monto parcial (ej. una seña) si no se paga el total.`;
    notaSaldo.classList.remove('hidden');
}

// Precarga cliente + comprobante de venta cuando se llega desde el ícono "Registrar cobro" de la fila de Comprobantes de Venta.
function registrarCobroDesdeComprobanteVenta(idComprobanteVenta) {
    const cv = listaComprobantesVenta.find(c => c.id_comprobante_venta_cliente === idComprobanteVenta);
    if (!cv || !comprobanteVentaEsCobrable(cv)) return;

    resetFormularioCobro();
    elegirClienteCobro(listaClientes.indexOf(cv.clienteObj));
    document.getElementById('cobro-comprobante-venta').value = idComprobanteVenta;
    seleccionarComprobanteVentaCobro();

    mostrarSubvistaCobranzas('registrar-cobro');
    if (window.location.hash !== '#registrar-cobro') window.location.hash = 'registrar-cobro';
}

function procesarCobroYComprobante() {
    const idMedioPago = parseInt(document.getElementById('cobro-medio').value);
    const condicionPago = document.getElementById('cobro-condicion').value;
    const monto = parseFloat(document.getElementById('cobro-monto').value) || 0;
    const fechaPago = document.getElementById('cobro-fecha').value;
    const horaPago = document.getElementById('cobro-hora').value;
    const observaciones = document.getElementById('cobro-observaciones').value.trim();

    if (!clienteSeleccionadoCobro) return alert('Buscá y seleccioná el cliente.');
    if (!comprobanteVentaSeleccionadoCobro) return alert('Seleccioná el comprobante de venta a cobrar.');
    if (!idMedioPago) return alert('Seleccioná el medio de pago.');
    if (!condicionPago) return alert('Seleccioná la condición de pago.');
    if (!fechaPago) return alert('Seleccioná la Fecha de Pago.');
    if (!horaPago) return alert('Seleccioná la Hora de Pago.');
    const saldoPendiente = comprobanteVentaSeleccionadoCobro.total - totalCobradoComprobanteVenta(comprobanteVentaSeleccionadoCobro.id_comprobante_venta_cliente);
    if (monto <= 0) return alert('Ingresá el monto a cobrar.');
    if (monto > saldoPendiente) return alert(`El monto no puede superar el saldo pendiente ($ ${saldoPendiente.toLocaleString()}).`);

    const comprobantePago = registrarComprobantePago({
        comprobanteVenta: comprobanteVentaSeleccionadoCobro, idMedioPago, condicionPago, importe: monto, observaciones, fechaPago, horaPago, empleado: usuarioInternoActual.nombre
    });

    guardarDatos();
    origenComprobantePago = 'registrar-cobro';
    mostrarComprobantePago(comprobantePago.id_comprobante_pago_cliente);
}

// ==========================================
// PAGOS (Comprobantes de Pago)
// ==========================================
let ordenPagosCampo = null;
let ordenPagosDireccion = null;
let filtroPagosMedioSeleccionado = '';
let filtroPagosEstadoSeleccionado = '';
let filtroPagosTipoDocSeleccionado = '';
let filtroPagosTipoClienteSeleccionado = '';
let filtroPagosTipoPedidoSeleccionado = '';
let filtroPagosCondicionSeleccionado = '';

function renderizarTablaPagos() {
    const tbody = document.getElementById('tabla-pagos');
    tbody.innerHTML = '';

    document.getElementById('kpi-pagos-total').innerText = listaComprobantesPago.length;
    document.getElementById('kpi-pagos-vigentes').innerText = listaComprobantesPago.filter(cp => !cp.es_anulado).length;
    document.getElementById('kpi-pagos-anulados').innerText = listaComprobantesPago.filter(cp => cp.es_anulado).length;
    document.getElementById('kpi-pagos-total-monto').innerText = `$ ${listaComprobantesPago.filter(cp => !cp.es_anulado).reduce((a, cp) => a + cp.importe, 0).toLocaleString()}`;

    const terminoNum = normalizarTexto(document.getElementById('buscar-num-pago')?.value || '').trim();
    const terminoVenta = normalizarTexto(document.getElementById('buscar-venta-pago')?.value || '').trim();
    const terminoCliente = normalizarTexto(document.getElementById('buscar-cliente-pago')?.value || '').trim();
    const terminoDocumento = normalizarTexto(document.getElementById('buscar-documento-pago')?.value || '').trim();
    const fechaPagoExacta = document.getElementById('buscar-fecha-pago')?.value || '';
    const montoDesde = document.getElementById('buscar-monto-desde-pago')?.value || '';
    const montoHasta = document.getElementById('buscar-monto-hasta-pago')?.value || '';

    let filtrados = listaComprobantesPago.filter(cp => {
        const cliente = cp.clienteObj ? cp.clienteObj.nombreMostrado : (cp.cliente || '');
        const documento = cp.clienteObj ? cp.clienteObj.numero_documento : '';
        const tipoDocumento = cp.clienteObj ? cp.clienteObj.tipo_documento : '';
        const tipoCliente = cp.clienteObj ? cp.clienteObj.tipo_cliente : '';
        const estado = cp.es_anulado ? 'Anulado' : 'Vigente';
        return (!terminoNum || String(cp.id_comprobante_pago_cliente).includes(terminoNum)) &&
            (!terminoVenta || String(cp.id_comprobante_venta_cliente).includes(terminoVenta)) &&
            (!terminoCliente || normalizarTexto(cliente).includes(terminoCliente)) &&
            (!terminoDocumento || normalizarTexto(documento).includes(terminoDocumento)) &&
            (!filtroPagosTipoDocSeleccionado || tipoDocumento === filtroPagosTipoDocSeleccionado) &&
            (!filtroPagosTipoClienteSeleccionado || tipoCliente === filtroPagosTipoClienteSeleccionado) &&
            (!filtroPagosTipoPedidoSeleccionado || tipoPedidoTexto(cp) === filtroPagosTipoPedidoSeleccionado) &&
            (!filtroPagosCondicionSeleccionado || cp.condicion_pago === filtroPagosCondicionSeleccionado) &&
            (!filtroPagosMedioSeleccionado || String(cp.id_medio_pago) === filtroPagosMedioSeleccionado) &&
            (!filtroPagosEstadoSeleccionado || estado === filtroPagosEstadoSeleccionado) &&
            coincideFechaExacta(fechaPagoExacta, cp.fecha_pago) &&
            coincideRangoMonto(montoDesde, montoHasta, cp.importe);
    });

    if (ordenPagosCampo && ordenPagosDireccion) {
        filtrados.sort((a, b) => {
            const va = (a.clienteObj ? a.clienteObj.nombreMostrado : (a.cliente || '')) || '';
            const vb = (b.clienteObj ? b.clienteObj.nombreMostrado : (b.cliente || '')) || '';
            const cmp = va.localeCompare(vb, 'es');
            return ordenPagosDireccion === 'asc' ? cmp : -cmp;
        });
    }
    actualizarIconosOrdenPagos();
    actualizarIconoFiltroMedioPago();
    actualizarIconoFiltroEstadoPagos();
    actualizarIconoFiltroTipoDocPagos();
    actualizarIconoFiltroTipoClientePagos();
    actualizarIconoFiltroTipoPedidoPagos();
    actualizarIconoFiltroCondicionPagos();

    if (!filtrados.length) {
        tbody.innerHTML = `<tr><td colspan="13" class="px-6 py-10 text-center text-slate-400 text-sm">No se encontraron pagos con ese criterio.</td></tr>`;
    }
    filtrados.forEach(cp => {
        const fechaFormateada = cp.fecha_pago ? new Date(cp.fecha_pago + 'T00:00:00').toLocaleDateString('es-AR') : '-';
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="px-6 py-4 font-semibold text-slate-900">${formatearIdentificador("CP", String(cp.id_comprobante_pago_cliente).padStart(4, '0'))}</td>
            <td class="px-6 py-4 text-slate-500 whitespace-nowrap">${formatearIdentificador("CV", String(cp.id_comprobante_venta_cliente).padStart(4, '0'))}</td>
            <td class="px-6 py-4">${cp.clienteObj ? cp.clienteObj.nombreMostrado : (cp.cliente || '-')}</td>
            <td class="px-6 py-4 text-slate-500">${cp.clienteObj ? cp.clienteObj.tipo_documento : '-'}</td>
            <td class="px-6 py-4 text-slate-500">${cp.clienteObj ? cp.clienteObj.numero_documento : '-'}</td>
            <td class="px-6 py-4">${cp.clienteObj ? badgeTipoCliente(cp.clienteObj.tipo_cliente) : '-'}</td>
            <td class="px-6 py-4">${badgeTipoPedido(cp)}</td>
            <td class="px-6 py-4 text-slate-500">${cp.condicion_pago || '-'}</td>
            <td class="px-6 py-4">${nombreMedioPago(cp.id_medio_pago)}</td>
            <td class="px-6 py-4 text-slate-500">${fechaFormateada}</td>
            <td class="px-6 py-4 text-right font-medium whitespace-nowrap">$ ${cp.importe.toLocaleString()}</td>
            <td class="px-6 py-4 text-center">${cp.es_anulado
                ? `<span class="px-2.5 py-1 bg-slate-200 text-slate-600 text-xs font-semibold rounded-full">Anulado</span>`
                : `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">Vigente</span>`}</td>
            <td class="px-6 py-4">
                <div class="flex items-center justify-start gap-1.5">
                    <button onclick="verComprobantePago(${cp.id_comprobante_pago_cliente})" title="Ver comprobante" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    ${!cp.es_anulado ? `<button onclick="anularComprobantePagoListado(${cp.id_comprobante_pago_cliente})" title="Anular comprobante" class="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"><i data-lucide="ban" class="w-4 h-4"></i></button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function elegirFiltroTipoDocPagos(valor) {
    filtroPagosTipoDocSeleccionado = valor;
    document.getElementById('pop-tipo-doc-pago').classList.add('hidden');
    renderizarTablaPagos();
}
function actualizarIconoFiltroTipoDocPagos() {
    const boton = document.getElementById('btn-filtro-tipo-doc-pago');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroPagosTipoDocSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-tipo-doc-pago').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroPagosTipoDocSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroPagosTipoDocSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroPagosTipoDocSeleccionado);
    });
}

function elegirFiltroTipoClientePagos(valor) {
    filtroPagosTipoClienteSeleccionado = valor;
    document.getElementById('pop-tipo-cliente-pago').classList.add('hidden');
    renderizarTablaPagos();
}
function actualizarIconoFiltroTipoClientePagos() {
    const boton = document.getElementById('btn-filtro-tipo-cliente-pago');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroPagosTipoClienteSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-tipo-cliente-pago').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroPagosTipoClienteSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroPagosTipoClienteSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroPagosTipoClienteSeleccionado);
    });
}

function elegirFiltroTipoPedidoPagos(valor) {
    filtroPagosTipoPedidoSeleccionado = valor;
    document.getElementById('pop-tipo-pedido-pago').classList.add('hidden');
    renderizarTablaPagos();
}

function elegirFiltroCondicionPagos(valor) {
    filtroPagosCondicionSeleccionado = valor;
    document.getElementById('pop-condicion-pago').classList.add('hidden');
    renderizarTablaPagos();
}
function actualizarIconoFiltroCondicionPagos() {
    const boton = document.getElementById('btn-filtro-condicion-pago');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroPagosCondicionSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-condicion-pago').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroPagosCondicionSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroPagosCondicionSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroPagosCondicionSeleccionado);
    });
}
function actualizarIconoFiltroTipoPedidoPagos() {
    const boton = document.getElementById('btn-filtro-tipo-pedido-pago');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroPagosTipoPedidoSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-tipo-pedido-pago').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroPagosTipoPedidoSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroPagosTipoPedidoSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroPagosTipoPedidoSeleccionado);
    });
}

// Anular un pago no afecta al pedido/venta: simplemente deja de contar en totalCobradoComprobanteVenta,
// por lo que el Comprobante de Venta asociado vuelve a figurar como "Pendiente" de cobro automáticamente.
function anularComprobantePagoListado(idComprobantePago) {
    const cp = listaComprobantesPago.find(c => c.id_comprobante_pago_cliente === idComprobantePago);
    if (!cp || cp.es_anulado) return;
    if (!confirm(`¿Anular el comprobante ${formatearIdentificador("CP", String(idComprobantePago).padStart(4, '0'))}?`)) return;
    cp.es_anulado = true;
    guardarDatos();
    renderizarTablaPagos();
}

function alternarOrdenPagos(campo) {
    if (ordenPagosCampo !== campo) { ordenPagosCampo = campo; ordenPagosDireccion = 'asc'; }
    else if (ordenPagosDireccion === 'asc') { ordenPagosDireccion = 'desc'; }
    else { ordenPagosCampo = null; ordenPagosDireccion = null; }
    renderizarTablaPagos();
}

function actualizarIconosOrdenPagos() {
    ['cliente'].forEach(campo => {
        const boton = document.getElementById(`btn-orden-${campo}-pago`);
        if (!boton) return;
        const activo = ordenPagosCampo === campo;
        const icono = activo && ordenPagosDireccion === 'asc' ? 'arrow-up' : activo && ordenPagosDireccion === 'desc' ? 'arrow-down' : 'arrow-up-down';
        boton.className = `normal-case transition ${activo ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
        boton.innerHTML = `<i data-lucide="${icono}" class="w-3.5 h-3.5"></i>`;
    });
}

function elegirFiltroMedioPago(valor) {
    filtroPagosMedioSeleccionado = valor;
    document.getElementById('pop-medio-pago').classList.add('hidden');
    renderizarTablaPagos();
}
function actualizarIconoFiltroMedioPago() {
    const boton = document.getElementById('btn-filtro-medio-pago');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroPagosMedioSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-medio-pago').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroPagosMedioSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroPagosMedioSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroPagosMedioSeleccionado);
    });
}

function elegirFiltroEstadoPagos(valor) {
    filtroPagosEstadoSeleccionado = valor;
    document.getElementById('pop-estado-pago').classList.add('hidden');
    renderizarTablaPagos();
}
function actualizarIconoFiltroEstadoPagos() {
    const boton = document.getElementById('btn-filtro-estado-pago');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroPagosEstadoSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-estado-pago').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroPagosEstadoSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroPagosEstadoSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroPagosEstadoSeleccionado);
    });
}

function volverAPagos() {
    renderizarTablaPagos();
    mostrarSubvistaCobranzas('pagos');
    if (window.location.hash !== '#pagos') window.location.hash = 'pagos';
}

function verComprobantePago(id) {
    origenComprobantePago = 'pagos';
    mostrarComprobantePago(id);
}

// ==========================================
// COMPROBANTE DE PAGO (vista impresa, compartida entre Registrar Cobro y Pagos)
// ==========================================
function mostrarComprobantePago(idComprobantePago) {
    const cp = listaComprobantesPago.find(c => c.id_comprobante_pago_cliente === idComprobantePago);
    if (!cp) return;
    const cv = listaComprobantesVenta.find(c => c.id_comprobante_venta_cliente === cp.id_comprobante_venta_cliente);
    const fechaEmisionCV = cv && cv.fecha_emision ? new Date(cv.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '-';
    const fechaPagoFormateada = cp.fecha_pago ? new Date(cp.fecha_pago + 'T00:00:00').toLocaleDateString('es-AR') : '-';

    document.getElementById('area-comprobante-pago').innerHTML = `
        <div class="flex justify-between items-start border-b border-slate-200 pb-4">
            <div class="text-xs text-slate-600 space-y-0.5">
                <p class="text-sm font-bold text-slate-900">${DATOS_EMPRESA.razonSocial}</p>
                <p>${DATOS_EMPRESA.domicilioComercial}</p>
                <p>Condición frente al IVA: ${DATOS_EMPRESA.condicionIva}</p>
                <p>CUIT: ${DATOS_EMPRESA.cuit}</p>
                <p>Fecha de Inicio de Actividades: ${DATOS_EMPRESA.fechaInicioActividades}</p>
            </div>
            <div class="text-xs text-slate-600 text-right space-y-0.5">
                <p class="text-sm font-bold text-slate-900">${formatearIdentificador("CP", String(cp.id_comprobante_pago_cliente).padStart(4, '0'))}</p>
                <p>Fecha de Emisión: ${fechaEmisionCV}${cv && cv.hora_emision ? ` - ${cv.hora_emision}` : ''}</p>
                <p>Fecha Pago: ${fechaPagoFormateada} - ${cp.hora_pago || '-'}</p>
                <p>Responsable: ${cp.empleado || '-'}</p>
            </div>
        </div>
        ${tarjetaClienteHTML(cp.clienteObj, cp.cliente, [
            `<b class="text-slate-700">Condición Pago:</b> ${cp.condicion_pago}`,
            `<b class="text-slate-700">Medio Pago:</b> ${nombreMedioPago(cp.id_medio_pago)}`
        ])}
        ${cp.es_anulado ? `<span class="inline-block px-2.5 py-1 bg-slate-200 text-slate-600 text-xs font-semibold rounded-full">Anulado</span>` : ''}
        <div class="no-print text-xs text-slate-400">
            Comprobante de Venta Asociado: ${cv ? `${formatearIdentificador("CV", String(cv.id_comprobante_venta_cliente).padStart(4, '0'))} (${formatearIdentificador("PED", cv.id_orden_pedido_cliente)})` : '-'}
        </div>
        ${cp.observaciones ? `<p class="text-xs text-slate-500"><b class="text-slate-700">Observaciones:</b> ${cp.observaciones}</p>` : ''}
        <div class="border-t border-slate-200 pt-4 text-right">
            <p class="text-lg font-bold text-slate-900">Importe: $ ${cp.importe.toLocaleString()}</p>
        </div>
    `;
    mostrarSubvistaCobranzas('comprobante-pago');
    lucide.createIcons();
}

function volverDesdeComprobantePago() {
    if (origenComprobantePago === 'pagos') {
        volverAPagos();
    } else {
        mostrarSubvistaCobranzas('registrar-cobro');
        if (window.location.hash !== '#registrar-cobro') window.location.hash = 'registrar-cobro';
    }
}

// ==========================================
// REPORTE DE CAJA (reemplaza al antiguo "Cierre de Caja" - se recalcula en vivo, sin resetear nada)
// ==========================================
function irAReporteCaja() {
    const hoy = new Date().toISOString().slice(0, 10);
    const totales = totalesCobradosPorMedio(hoy);
    const totalGeneral = totales.reduce((acc, t) => acc + t.total, 0);

    document.getElementById('reporte-caja-fecha').innerText = `Fecha: ${new Date(hoy + 'T00:00:00').toLocaleDateString('es-AR')}`;
    document.getElementById('reporte-caja-body').innerHTML = totales.map(t => `
        <tr><td class="py-2">${t.medio}</td><td class="py-2 text-right">$ ${t.total.toLocaleString()}</td></tr>
    `).join('');
    document.getElementById('reporte-caja-total').innerText = `$ ${totalGeneral.toLocaleString()}`;
    mostrarSubvistaCobranzas('reporte-caja');
}

function initPaginaCobranzas() {
    irASubvistaDesdeHashCobranzas();
    window.addEventListener('hashchange', irASubvistaDesdeHashCobranzas);
}
