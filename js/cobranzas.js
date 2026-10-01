// ==========================================
// MÓDULO DE COBRANZAS
// Cliente -> Orden de Pedido (ya confirmada, con Comprobante de Venta) -> Cobro -> Comprobante de Pago.
// ==========================================

// Una orden de pedido es cobrable si no está cancelada, no es una donación (total $0) y todavía no tiene un cobro vigente.
function pedidoEsCobrable(p) {
    return !!p.clienteObj && p.estado !== 'Cancelado' && !p.esDonacion && p.total > 0 && !pedidoEstaCobrado(p.id);
}

function clientesConPedidosCobrables() {
    const clientesUnicos = new Set();
    listaPedidos.forEach(p => { if (pedidoEsCobrable(p)) clientesUnicos.add(p.clienteObj); });
    return listaClientes.filter(c => clientesUnicos.has(c));
}

function poblarSelectClienteCobranza() {
    const select = document.getElementById('cobro-cliente');
    const clientes = clientesConPedidosCobrables();

    select.innerHTML = `<option value="" disabled selected>${clientes.length ? 'Elegí un cliente' : 'No hay clientes con órdenes pendientes de cobro'}</option>` +
        clientes.map(c => `<option value="${listaClientes.indexOf(c)}">${c.nombreMostrado}</option>`).join('');
    select.disabled = !clientes.length;

    document.getElementById('cobro-orden').innerHTML = '<option value="" disabled selected>Elegí primero el cliente</option>';
    document.getElementById('cobro-orden').disabled = true;
    document.getElementById('ficha-orden-cobro').classList.add('hidden');
    document.getElementById('cobro-monto').value = '';
}

function renderizarSelectOrdenCobro() {
    const idx = parseInt(document.getElementById('cobro-cliente').value);
    const selectOrden = document.getElementById('cobro-orden');
    document.getElementById('ficha-orden-cobro').classList.add('hidden');
    document.getElementById('cobro-monto').value = '';

    if (isNaN(idx)) {
        selectOrden.innerHTML = '<option value="" disabled selected>Elegí primero el cliente</option>';
        selectOrden.disabled = true;
        return;
    }

    const cliente = listaClientes[idx];
    const pedidosCliente = listaPedidos.filter(p => p.clienteObj === cliente && pedidoEsCobrable(p));
    selectOrden.disabled = false;
    selectOrden.innerHTML = `<option value="" disabled selected>${pedidosCliente.length ? 'Elegí una orden de pedido' : 'Este cliente no tiene órdenes pendientes de cobro'}</option>` +
        pedidosCliente.map(p => `<option value="${p.id}">PED-${p.id} — $ ${p.total.toLocaleString()}</option>`).join('');
}

function seleccionarOrdenCobro() {
    const idPedido = parseInt(document.getElementById('cobro-orden').value);
    const ficha = document.getElementById('ficha-orden-cobro');
    const inputMonto = document.getElementById('cobro-monto');

    if (isNaN(idPedido)) { ficha.classList.add('hidden'); inputMonto.value = ''; return; }

    const pedido = listaPedidos.find(p => p.id === idPedido);
    const cv = obtenerComprobanteVentaPorPedido(idPedido);
    const fechaFormateada = pedido.fecha ? new Date(pedido.fecha + 'T00:00:00').toLocaleDateString('es-AR') : '-';

    ficha.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            <p><b class="text-slate-700">Fecha del Pedido:</b> ${fechaFormateada}</p>
            <p><b class="text-slate-700">Tipo:</b> ${pedido.tipo}</p>
            <p><b class="text-slate-700">Comprobante de Venta:</b> ${cv ? 'CV-' + String(cv.id_comprobante_venta_cliente).padStart(5, '0') : '-'}</p>
            <p><b class="text-slate-700">Total a Cobrar:</b> $ ${pedido.total.toLocaleString()}</p>
        </div>`;
    ficha.classList.remove('hidden');
    inputMonto.value = `$ ${pedido.total.toLocaleString()}`;
}

function mostrarComprobantePago(comprobantePago, comprobanteVenta) {
    const fechaFormateada = comprobantePago.fecha_pago ? new Date(comprobantePago.fecha_pago + 'T00:00:00').toLocaleDateString('es-AR') : '-';
    document.getElementById('area-comprobante-pago').innerHTML = `
        <p><b class="text-slate-700">N° Comprobante de Pago:</b> CP-${String(comprobantePago.id_comprobante_pago_cliente).padStart(5, '0')}</p>
        <p><b class="text-slate-700">Comprobante de Venta Asociado:</b> CV-${String(comprobantePago.id_comprobante_venta_cliente).padStart(5, '0')} (PED-${comprobanteVenta.id_orden_pedido_cliente})</p>
        <p><b class="text-slate-700">Cliente:</b> ${comprobantePago.cliente}</p>
        <p><b class="text-slate-700">Medio de Pago:</b> ${nombreMedioPago(comprobantePago.id_medio_pago)}</p>
        <p><b class="text-slate-700">Condición de Pago:</b> ${comprobantePago.condicion_pago}</p>
        <p><b class="text-slate-700">Fecha y Hora de Pago:</b> ${fechaFormateada} — ${comprobantePago.hora_pago}</p>
        <p><b class="text-slate-700">Importe:</b> <span class="text-emerald-700 font-bold">$ ${comprobantePago.importe.toLocaleString()}</span></p>
        ${comprobantePago.observaciones ? `<p><b class="text-slate-700">Observaciones:</b> ${comprobantePago.observaciones}</p>` : ''}
    `;
    document.getElementById('vista-comprobante-pago').classList.remove('hidden');
}

function procesarCobroYComprobante() {
    const idxCliente = parseInt(document.getElementById('cobro-cliente').value);
    const idPedido = parseInt(document.getElementById('cobro-orden').value);
    const idMedioPago = parseInt(document.getElementById('cobro-medio').value);
    const condicionPago = document.getElementById('cobro-condicion').value;
    const observaciones = document.getElementById('cobro-observaciones').value.trim();

    if (isNaN(idxCliente)) return alert('Seleccioná el cliente.');
    if (isNaN(idPedido)) return alert('Seleccioná la orden de pedido a cobrar.');
    if (!idMedioPago) return alert('Seleccioná el medio de pago.');
    if (!condicionPago) return alert('Seleccioná la condición de pago.');

    const pedido = listaPedidos.find(p => p.id === idPedido);
    const comprobanteVenta = obtenerComprobanteVentaPorPedido(idPedido);
    if (!comprobanteVenta) return alert('Este pedido todavía no tiene un comprobante de venta asociado.');

    const comprobantePago = registrarComprobantePago({
        comprobanteVenta, idMedioPago, condicionPago, importe: pedido.total, observaciones
    });

    totalCajaAcumulado += comprobantePago.importe;
    document.getElementById('caja-cobros-acumulados').innerText = `$ ${totalCajaAcumulado.toLocaleString()}`;
    document.getElementById('caja-total-monto').innerText = `$ ${totalCajaAcumulado.toLocaleString()}`;

    guardarDatos();
    mostrarComprobantePago(comprobantePago, comprobanteVenta);
    poblarSelectClienteCobranza();
    renderizarTablaCobros();

    document.getElementById('cobro-medio').selectedIndex = 0;
    document.getElementById('cobro-condicion').selectedIndex = 0;
    document.getElementById('cobro-observaciones').value = '';
}

function renderizarTablaCobros() {
    const tbody = document.getElementById('tabla-cobros-registrados');
    tbody.innerHTML = '';

    const termino = normalizarTexto(document.getElementById('buscar-cobro-cliente')?.value || '').trim();
    const cobros = listaComprobantesPago.filter(cp => !termino || normalizarTexto(cp.cliente).includes(termino));

    if (!cobros.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-10 text-center text-slate-400 text-sm">${listaComprobantesPago.length ? 'No se encontraron cobros con ese criterio.' : 'Todavía no se registraron cobros.'}</td></tr>`;
        return;
    }

    cobros.forEach(cp => {
        const cv = listaComprobantesVenta.find(c => c.id_comprobante_venta_cliente === cp.id_comprobante_venta_cliente);
        const fechaFormateada = cp.fecha_pago ? new Date(cp.fecha_pago + 'T00:00:00').toLocaleDateString('es-AR') : '-';
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="px-6 py-4 font-semibold text-slate-900">CP-${String(cp.id_comprobante_pago_cliente).padStart(5, '0')}</td>
            <td class="px-6 py-4">${cp.cliente}</td>
            <td class="px-6 py-4 text-slate-500">${cv ? `PED-${cv.id_orden_pedido_cliente} / CV-${String(cv.id_comprobante_venta_cliente).padStart(5, '0')}` : '-'}</td>
            <td class="px-6 py-4">${nombreMedioPago(cp.id_medio_pago)}</td>
            <td class="px-6 py-4 text-slate-500">${fechaFormateada}</td>
            <td class="px-6 py-4 text-right font-medium">$ ${cp.importe.toLocaleString()}</td>
            <td class="px-6 py-4 text-center">${cp.es_anulado
                ? `<span class="px-2.5 py-1 bg-slate-200 text-slate-600 text-xs font-semibold rounded-full">Anulado</span>`
                : `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">Vigente</span>`}</td>
        `;
        tbody.appendChild(tr);
    });
}

function generarCierreDiario() {
    if (totalCajaAcumulado === 0) return alert('Sin movimientos en caja');
    alert(`Cierre de Caja exitoso. Total: $${totalCajaAcumulado.toLocaleString()}`);
    totalCajaAcumulado = 0;
    document.getElementById('caja-cobros-acumulados').innerText = '$ 0';
    document.getElementById('caja-total-monto').innerText = '$ 0';
    guardarDatos();
}

function initPaginaCobranzas() {
    poblarSelectClienteCobranza();
    renderizarTablaCobros();
    document.getElementById('caja-cobros-acumulados').innerText = `$ ${totalCajaAcumulado.toLocaleString()}`;
    document.getElementById('caja-total-monto').innerText = `$ ${totalCajaAcumulado.toLocaleString()}`;
}
