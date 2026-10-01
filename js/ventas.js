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

// ---------- Popovers de búsqueda/filtro por columna (Historial de Pedidos) y combos con búsqueda (Registrar Pedido) ----------
// Se posicionan con position:fixed calculada por JS (no absolute) para que floten por encima de todo
// sin que el contenedor con scroll horizontal de la tabla les agregue una barra de scroll vertical.
function togglePopoverColumna(id) {
    document.querySelectorAll('.popover-columna').forEach(p => { if (p.id !== id) p.classList.add('hidden'); });
    const panel = document.getElementById(id);
    const abrir = panel.classList.contains('hidden');

    if (abrir) {
        const wrapper = panel.closest('.popover-trigger');
        const rect = wrapper.getBoundingClientRect();
        panel.style.position = 'fixed';
        panel.style.top = `${rect.bottom + 6}px`;
        panel.style.left = `${rect.left}px`;
        if (id.startsWith('combo-')) panel.style.width = `${rect.width}px`;
    }
    panel.classList.toggle('hidden');

    // Los combos con búsqueda (Cliente/Empleado/Producto) siempre reabren con el buscador vacío y la lista completa actualizada.
    if (abrir && id.startsWith('combo-')) {
        const input = panel.querySelector('input');
        if (input) {
            input.value = '';
            input.dispatchEvent(new Event('input'));
            input.focus();
        }
    }
}
document.addEventListener('click', (e) => {
    if (!e.target.closest('.popover-trigger')) {
        document.querySelectorAll('.popover-columna').forEach(p => p.classList.add('hidden'));
    }
});

const SUBVISTAS_VENTAS = ['dashboard', 'nuevo-pedido', 'presupuesto', 'detalle-pedido', 'comprobante-venta'];
function mostrarSubvistaVentas(subvista) {
    SUBVISTAS_VENTAS.forEach(v => document.getElementById(`vista-${v}`).classList.add('hidden'));
    const vistaDestino = document.getElementById(`vista-${subvista}`);
    if (vistaDestino) vistaDestino.classList.remove('hidden');
}

// Navegación por hash: sincroniza el sub-menú del sidebar (#dashboard / #registrar) con la subvista mostrada.
function irASubvistaDesdeHash() {
    const hash = (window.location.hash || '').replace('#', '') || 'dashboard';
    if (hash === 'registrar') {
        if (!pedidoEnEdicionId) resetFormularioPedido();
        mostrarSubvistaVentas('nuevo-pedido');
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

const TIPOS_PEDIDO_POR_TIPO_CLIENTE = {
    'Mostrador': ['Mostrador', 'Evento'],
    'Mayorista': ['Mayorista', 'Evento']
};

function renderizarOpcionesTipoPedido(tipoCliente) {
    const select = document.getElementById('select-tipo-operacion');
    const opciones = TIPOS_PEDIDO_POR_TIPO_CLIENTE[tipoCliente] || ['Mostrador', 'Mayorista', 'Evento'];
    select.innerHTML = '<option value="" disabled selected>Elegí un tipo de pedido</option>' +
        opciones.map(o => `<option value="${o}">${o}</option>`).join('');
}

let clientesFiltradosParaCombo = [];

function renderizarSelectClientePedido() {
    const tipo = document.getElementById('pedido-tipo-cliente').value;
    const boton = document.getElementById('combo-cliente-btn');
    const label = document.getElementById('combo-cliente-label');
    const ficha = document.getElementById('ficha-cliente-pedido');
    clienteSeleccionadoPedido = null;
    document.getElementById('select-cliente-pedido').value = '';
    document.getElementById('combo-cliente-panel').classList.add('hidden');
    document.getElementById('combo-cliente-buscar').value = '';
    ficha.classList.add('hidden');

    // Al cambiar el tipo de cliente, el tipo de pedido ya seleccionado puede dejar de ser válido: se limpia y se recalculan las opciones permitidas.
    renderizarOpcionesTipoPedido(tipo);

    if (!tipo) {
        boton.disabled = true;
        label.textContent = 'Elegí primero el tipo de cliente';
        label.className = 'truncate text-slate-400';
        clientesFiltradosParaCombo = [];
        renderizarOpcionesComboCliente();
        return;
    }

    clientesFiltradosParaCombo = listaClientes.filter(c => c.tipo_cliente === tipo);
    boton.disabled = false;
    label.textContent = clientesFiltradosParaCombo.length ? 'Elegí un cliente' : 'No hay clientes de este tipo todavía';
    label.className = 'truncate text-slate-400';
    renderizarOpcionesComboCliente();
}

function renderizarOpcionesComboCliente() {
    const termino = normalizarTexto(document.getElementById('combo-cliente-buscar').value).trim();
    const cont = document.getElementById('combo-cliente-opciones');
    const filtrados = clientesFiltradosParaCombo.filter(c => !termino || normalizarTexto(`${c.nombre} ${c.apellido}`).includes(termino));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        return;
    }
    cont.innerHTML = filtrados.map(c => {
        const idx = listaClientes.indexOf(c);
        return `<button type="button" onclick="elegirClientePedido(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100 truncate">${c.nombre} ${c.apellido}</button>`;
    }).join('');
}

function elegirClientePedido(idx) {
    clienteSeleccionadoPedido = listaClientes[idx];
    document.getElementById('select-cliente-pedido').value = idx;
    const label = document.getElementById('combo-cliente-label');
    label.textContent = clienteSeleccionadoPedido.nombreMostrado;
    label.className = 'truncate text-slate-800';
    document.getElementById('combo-cliente-panel').classList.add('hidden');
    mostrarFichaClientePedido();
}

function mostrarFichaClientePedido() {
    const ficha = document.getElementById('ficha-cliente-pedido');
    const c = clienteSeleccionadoPedido;
    if (!c) { ficha.classList.add('hidden'); return; }
    ficha.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            <p><b class="text-slate-700">Documento:</b> ${c.documentoCompleto}</p>
            <p><b class="text-slate-700">Condición IVA:</b> ${c.condicion_iva}</p>
            <p><b class="text-slate-700">Dirección:</b> ${c.direccionCompleta}</p>
            <p><b class="text-slate-700">Límite de crédito:</b> $ ${c.limite_credito.toLocaleString()}</p>
        </div>`;
    ficha.classList.remove('hidden');
}

function abrirModalNuevoCliente() {
    const tipoYaElegido = document.getElementById('pedido-tipo-cliente').value;
    const selectTipoModal = document.getElementById('mcli-tipo-cliente');
    if (tipoYaElegido) {
        selectTipoModal.value = tipoYaElegido;
    } else {
        selectTipoModal.selectedIndex = 0;
    }
    ['mcli-nombre', 'mcli-apellido', 'mcli-razon-social', 'mcli-numero-documento', 'mcli-telefono', 'mcli-email'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('mcli-limite').value = 0;
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
    const telefono = document.getElementById('mcli-telefono').value.trim();
    const email = document.getElementById('mcli-email').value.trim();
    const iva = document.getElementById('mcli-iva').value;
    const limite = parseFloat(document.getElementById('mcli-limite').value) || 0;

    if (!tipoCliente) return alert('Seleccioná el tipo de cliente.');
    if (!nombre || !apellido || !numeroDocumento) return alert('Completá Nombre, Apellido y Número de Documento.');

    const nuevo = new Cliente(nombre, apellido, tipoDocumento, numeroDocumento, null, '', telefono, email, iva, tipoCliente, limite, razonSocial);
    listaClientes.unshift(nuevo);
    renderizarClientesUI();
    guardarDatos();

    document.getElementById('pedido-tipo-cliente').value = tipoCliente;
    renderizarSelectClientePedido();
    elegirClientePedido(listaClientes.indexOf(nuevo));
    cerrarModalNuevoCliente();
}

const CATALOGO_PRODUCTOS_VENTA = {
    'Pastas Rellenas': [
        { nombre: 'Ravioles de Ricotta y Verdura', precio: 3500 },
        { nombre: 'Sorrentinos de Jamón y Queso', precio: 4200 }
    ],
    'Pastas Secas': [
        { nombre: 'Tallarines al Huevo', precio: 2800 },
        { nombre: 'Ñoquis de Papa', precio: 3000 }
    ],
    'Salsas': [
        { nombre: 'Salsa Fileto en Pote', precio: 1200 },
        { nombre: 'Salsa Bolognesa en Pote', precio: 1800 }
    ]
};

let productosFiltradosParaCombo = [];

function renderizarProductosPorTipo() {
    const tipo = document.getElementById('prod-tipo').value;
    const boton = document.getElementById('combo-producto-btn');
    const label = document.getElementById('combo-producto-label');
    document.getElementById('prod-select').value = '';
    document.getElementById('combo-producto-panel').classList.add('hidden');
    document.getElementById('combo-producto-buscar').value = '';

    if (!tipo) {
        boton.disabled = true;
        label.textContent = 'Elegí primero un tipo';
        label.className = 'truncate text-slate-400';
        productosFiltradosParaCombo = [];
        renderizarOpcionesComboProducto();
        return;
    }

    boton.disabled = false;
    label.textContent = 'Elegí un producto';
    label.className = 'truncate text-slate-400';
    productosFiltradosParaCombo = CATALOGO_PRODUCTOS_VENTA[tipo].map(p => ({ nombre: p.nombre, precio: p.precio, tipo }));
    renderizarOpcionesComboProducto();
}

function renderizarOpcionesComboProducto() {
    const termino = normalizarTexto(document.getElementById('combo-producto-buscar').value).trim();
    const cont = document.getElementById('combo-producto-opciones');
    const filtrados = productosFiltradosParaCombo.filter(p => !termino || normalizarTexto(p.nombre).includes(termino));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        return;
    }
    cont.innerHTML = filtrados.map(p => {
        const idx = productosFiltradosParaCombo.indexOf(p);
        return `<button type="button" onclick="elegirProductoPedido(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100 truncate">${p.nombre}</button>`;
    }).join('');
}

function elegirProductoPedido(idx) {
    const p = productosFiltradosParaCombo[idx];
    document.getElementById('prod-select').value = `${p.nombre}|${p.precio}|${p.tipo}`;
    const label = document.getElementById('combo-producto-label');
    label.textContent = p.nombre;
    label.className = 'truncate text-slate-800';
    document.getElementById('combo-producto-panel').classList.add('hidden');
}

function agregarProductoPedido() {
    const tipoProducto = document.getElementById('prod-tipo').value;
    const prodSelect = document.getElementById('prod-select').value;
    const cantidad = parseInt(document.getElementById('prod-cant').value);

    if (!tipoProducto || !prodSelect) return alert('Seleccioná el tipo de producto y el producto.');
    if (!cantidad || cantidad <= 0) return alert('Ingrese una cantidad válida.');

    const [nombre, precioStr, tipo] = prodSelect.split('|');
    const precioUnitario = parseFloat(precioStr);

    const itemExistente = itemsPedidoActual.find(item => item.nombre === nombre && item.tipo === tipo);
    if (itemExistente) {
        itemExistente.cantidad += cantidad;
        itemExistente.subtotal = itemExistente.cantidad * itemExistente.precioUnitario;
    } else {
        itemsPedidoActual.push({ id: Date.now(), nombre, tipo, cantidad, precioUnitario, subtotal: precioUnitario * cantidad });
    }
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
            <td class="p-3 font-medium text-slate-800">${item.nombre}</td>
            <td class="p-3 text-slate-500">${item.tipo || '-'}</td>
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
    const esDonacion = document.getElementById('pedido-es-donacion').value === 'Si';

    const inputBonificacion = document.getElementById('pedido-bonificacion');
    inputBonificacion.disabled = esDonacion;
    if (esDonacion) inputBonificacion.value = 0;
    document.getElementById('nota-bonificacion-donacion').classList.toggle('hidden', !esDonacion);

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

function renderizarEmpleadoSelectVentas() {
    document.getElementById('pedido-empleado').value = '';
    document.getElementById('combo-empleado-panel').classList.add('hidden');
    document.getElementById('combo-empleado-buscar').value = '';
    const label = document.getElementById('combo-empleado-label');
    label.textContent = 'Elegí un empleado';
    label.className = 'truncate text-slate-400';
    renderizarOpcionesComboEmpleado();
}

function renderizarOpcionesComboEmpleado() {
    const termino = normalizarTexto(document.getElementById('combo-empleado-buscar').value).trim();
    const cont = document.getElementById('combo-empleado-opciones');
    const filtrados = listaEmpleados.filter(e => !termino || normalizarTexto(e.nombreCompleto).includes(termino));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        return;
    }
    cont.innerHTML = filtrados.map(e => {
        const idx = listaEmpleados.indexOf(e);
        return `<button type="button" onclick="elegirEmpleadoPedido(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100 truncate">${e.nombreCompleto}</button>`;
    }).join('');
}

function elegirEmpleadoPedido(idx) {
    const empleado = listaEmpleados[idx];
    document.getElementById('pedido-empleado').value = empleado.nombreCompleto;
    const label = document.getElementById('combo-empleado-label');
    label.textContent = empleado.nombreCompleto;
    label.className = 'truncate text-slate-800';
    document.getElementById('combo-empleado-panel').classList.add('hidden');
}

function resetFormularioPedido() {
    itemsPedidoActual = [];
    pedidoEnEdicionId = null;
    clienteSeleccionadoPedido = null;
    document.getElementById('titulo-form-pedido').innerText = 'Registrar Nuevo Pedido';
    document.getElementById('btn-confirmar-pedido').innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i><span>Confirmar Pedido</span>';
    document.getElementById('btn-emitir-presupuesto').classList.remove('hidden');
    document.getElementById('pedido-tipo-cliente').selectedIndex = 0;
    renderizarSelectClientePedido();
    renderizarEmpleadoSelectVentas();
    document.getElementById('select-tipo-operacion').selectedIndex = 0;
    document.getElementById('pedido-es-donacion').selectedIndex = 0;
    document.getElementById('pedido-bonificacion').value = 0;
    document.getElementById('pedido-observaciones').value = '';
    document.getElementById('prod-tipo').selectedIndex = 0;
    document.getElementById('prod-cant').value = 1;
    renderizarProductosPorTipo();
    renderizarTablaPedido();
    lucide.createIcons();
}

function validarDatosObligatoriosPedido() {
    if (!clienteSeleccionadoPedido) { alert('Seleccioná el tipo de cliente y el cliente del pedido.'); return false; }
    if (!document.getElementById('pedido-empleado').value) { alert('Seleccioná el empleado que registra el pedido.'); return false; }
    if (!document.getElementById('select-tipo-operacion').value) { alert('Seleccioná el tipo de pedido.'); return false; }
    if (!document.getElementById('pedido-es-donacion').value) { alert('Indicá si el pedido es una donación.'); return false; }
    if (itemsPedidoActual.length === 0) { alert('Añadí al menos un producto al pedido.'); return false; }
    return true;
}

function confirmarPedido() {
    if (!validarDatosObligatoriosPedido()) return;
    const empleado = document.getElementById('pedido-empleado').value;

    const total = calcularTotalPedido();
    const tipo = document.getElementById('select-tipo-operacion').value;
    const esDonacion = document.getElementById('pedido-es-donacion').value === 'Si';
    const bonificacion = parseFloat(document.getElementById('pedido-bonificacion').value) || 0;
    const observaciones = document.getElementById('pedido-observaciones').value.trim();
    const detalle = itemsPedidoActual.map(i => ({ ...i }));

    if (pedidoEnEdicionId) {
        const pedido = listaPedidos.find(p => p.id === pedidoEnEdicionId);
        Object.assign(pedido, { clienteObj: clienteSeleccionadoPedido, cliente: clienteSeleccionadoPedido.nombreMostrado, empleado, tipo, esDonacion, bonificacion, observaciones, detalle, total });
        actualizarComprobanteVenta(pedido);
        alert(`¡Pedido PED-${pedido.id} actualizado con éxito! El comprobante de venta asociado se actualizó.`);
    } else {
        const ahora = new Date();
        const nuevoPedido = {
            id: numPedidoContador++, clienteObj: clienteSeleccionadoPedido, cliente: clienteSeleccionadoPedido.nombreMostrado,
            empleado, tipo, esDonacion, bonificacion, observaciones, detalle, total, estado: 'Pendiente',
            fecha: ahora.toISOString().slice(0, 10), hora: ahora.toTimeString().slice(0, 5)
        };
        listaPedidos.unshift(nuevoPedido);
        generarComprobanteVenta(nuevoPedido);
        alert(`¡Pedido para "${clienteSeleccionadoPedido.nombreMostrado}" registrado! Se emitió el comprobante de venta correspondiente.`);
    }

    guardarDatos();
    volverAlListadoVentas();
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
            (!filtroPedidoTipoSeleccionado || p.tipo === filtroPedidoTipoSeleccionado);
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

    if (!pedidosFiltrados.length) {
        tbody.innerHTML = `<tr><td colspan="10" class="px-6 py-10 text-center text-slate-400 text-sm">No se encontraron pedidos con ese criterio.</td></tr>`;
    }
    pedidosFiltrados.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        const activo = p.estado !== 'Cancelado' && p.estado !== 'Entregado';
        const siguiente = activo ? ESTADOS_PEDIDO[ESTADOS_PEDIDO.indexOf(p.estado) + 1] : null;
        const fechaFormateada = p.fecha ? new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-AR') : '-';

        // El comprobante de venta solo puede verse cuando la orden de pedido llegó a "Listo" o "Entregado".
        const comprobante = obtenerComprobanteVentaPorPedido(p.id);
        const comprobanteVisible = comprobante && !comprobante.es_anulado && (p.estado === 'Listo' || p.estado === 'Entregado');

        tr.innerHTML = `
            <td class="px-6 py-4 font-semibold text-slate-900">PED-${p.id}</td>
            <td class="px-6 py-4">${p.clienteObj ? p.clienteObj.nombre : '-'}</td>
            <td class="px-6 py-4">${p.clienteObj ? p.clienteObj.apellido : '-'}</td>
            <td class="px-6 py-4 text-slate-500">${p.clienteObj ? p.clienteObj.numero_documento : '-'}</td>
            <td class="px-6 py-4 text-slate-500">${p.clienteObj ? p.clienteObj.tipo_documento : '-'}</td>
            <td class="px-6 py-4"><span class="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">${p.tipo}${p.esDonacion ? ' · Donación' : ''}</span></td>
            <td class="px-6 py-4 text-slate-500">${fechaFormateada}</td>
            <td class="px-6 py-4 text-right font-medium">$ ${p.total.toLocaleString()}</td>
            <td class="px-6 py-4 text-center"><span class="px-2.5 py-1 ${COLOR_ESTADO_PEDIDO[p.estado]} text-xs font-semibold rounded-full">${p.estado}</span></td>
            <td class="px-6 py-4">
                <div class="flex items-center justify-start gap-1.5">
                    <button onclick="verDetallePedido(${p.id})" title="Ver detalle" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    ${comprobanteVisible ? `<button onclick="verComprobanteVenta(${p.id})" title="Ver comprobante de venta" class="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition"><i data-lucide="file-check-2" class="w-4 h-4"></i></button>` : ''}
                    ${p.estado === 'Pendiente' ? `<button onclick="editarPedido(${p.id})" title="Editar pedido" class="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>` : ''}
                    ${siguiente ? `<button onclick="avanzarEstadoPedido(${p.id})" title="Marcar ${siguiente}" class="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"><i data-lucide="arrow-right-circle" class="w-4 h-4"></i></button>` : ''}
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
    document.getElementById('btn-emitir-presupuesto').classList.add('hidden');

    document.getElementById('pedido-tipo-cliente').value = pedido.clienteObj.tipo_cliente;
    renderizarSelectClientePedido();
    elegirClientePedido(listaClientes.indexOf(pedido.clienteObj));

    renderizarEmpleadoSelectVentas();
    const idxEmpleado = listaEmpleados.findIndex(e => e.nombreCompleto === pedido.empleado);
    if (idxEmpleado > -1) elegirEmpleadoPedido(idxEmpleado);
    document.getElementById('select-tipo-operacion').value = pedido.tipo;
    document.getElementById('pedido-es-donacion').value = pedido.esDonacion ? 'Si' : 'No';
    document.getElementById('pedido-bonificacion').value = pedido.bonificacion || 0;
    document.getElementById('pedido-observaciones').value = pedido.observaciones || '';
    document.getElementById('prod-tipo').selectedIndex = 0;
    document.getElementById('prod-cant').value = 1;
    renderizarProductosPorTipo();

    renderizarTablaPedido();
    mostrarSubvistaVentas('nuevo-pedido');
    if (window.location.hash !== '#registrar') window.location.hash = 'registrar';
    lucide.createIcons();
}

function verDetallePedido(id) {
    const p = listaPedidos.find(x => x.id === id);
    const c = p.clienteObj;
    const fechaPedidoFormateada = p.fecha ? new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-AR') : '-';
    const fechaEntregaFormateada = p.fechaEntrega ? new Date(p.fechaEntrega + 'T00:00:00').toLocaleDateString('es-AR') : 'Aún no entregado';

    const subtotalPedido = (p.detalle || []).reduce((acc, i) => acc + i.subtotal, 0);
    const descuentoPct = p.esDonacion ? 100 : (p.bonificacion || 0);
    const descuentoMonto = p.esDonacion ? subtotalPedido : subtotalPedido * ((p.bonificacion || 0) / 100);
    // El comprobante de venta solo puede verse cuando la orden de pedido llegó a "Listo" o "Entregado".
    const comprobanteVenta = obtenerComprobanteVentaPorPedido(p.id);
    const comprobanteVisible = comprobanteVenta && !comprobanteVenta.es_anulado && (p.estado === 'Listo' || p.estado === 'Entregado');

    const filas = (p.detalle || []).map(i => `
        <tr class="border-b border-slate-100">
            <td class="py-2">${i.nombre}</td>
            <td class="py-2 text-slate-500">${i.tipo || '-'}</td>
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
                    <span class="px-2.5 py-1 ${COLOR_ESTADO_PEDIDO[p.estado]} text-xs font-semibold rounded-full">${p.estado}</span>
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
                    <tr><th class="py-2">Producto</th><th class="py-2">Tipo</th><th class="py-2 text-center">Cant.</th><th class="py-2 text-right">P. Unitario</th><th class="py-2 text-right">Subtotal</th></tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>

        <div class="border-t border-slate-200 pt-4 space-y-1 text-right">
            <p class="text-xs text-slate-500">Subtotal: $ ${subtotalPedido.toLocaleString()}</p>
            <p class="text-xs text-emerald-600">${p.esDonacion ? 'Donación' : 'Descuento'} (${descuentoPct}%): -$ ${descuentoMonto.toLocaleString()}</p>
            <p class="text-lg font-bold text-slate-900">Total: $ ${p.total.toLocaleString()}</p>
        </div>

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

function emitirPresupuestoDesdePedido() {
    if (!validarDatosObligatoriosPedido()) return;

    document.getElementById('presupuesto-cliente-nombre').innerText = clienteSeleccionadoPedido.nombreMostrado;
    const tbody = document.getElementById('presupuesto-detalle-body');
    tbody.innerHTML = '';
    let total = 0;

    itemsPedidoActual.forEach(item => {
        total += item.subtotal;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-2">${item.nombre}</td>
            <td class="py-2 text-center">${item.cantidad}</td>
            <td class="py-2 text-right">$ ${item.precioUnitario.toLocaleString()}</td>
            <td class="py-2 text-right">$ ${item.subtotal.toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('presupuesto-total-monto').innerText = `Total Presupuestado: $ ${total.toLocaleString()}`;
    mostrarSubvistaVentas('presupuesto');
}

function verComprobanteVenta(idPedido) {
    const cv = obtenerComprobanteVentaPorPedido(idPedido);
    if (!cv) return alert('Este pedido todavía no tiene un comprobante de venta asociado.');

    const c = cv.clienteObj;
    const fechaFormateada = cv.fecha_emision ? new Date(cv.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '-';
    const descuentoMonto = cv.subtotal * ((cv.porcentaje_bonificacion || 0) / 100);

    const filas = (cv.detalle || []).map(i => `
        <tr class="border-b border-slate-100">
            <td class="py-2">${i.nombre}</td>
            <td class="py-2 text-center">${i.cantidad}</td>
            <td class="py-2 text-right">$ ${i.precio_unitario.toLocaleString()}</td>
            <td class="py-2 text-right">$ ${i.total.toLocaleString()}</td>
        </tr>`).join('');

    document.getElementById('area-comprobante-venta').innerHTML = `
        <div class="flex justify-between items-start border-b border-slate-200 pb-4">
            <div>
                <h1 class="text-2xl font-bold text-red-600">FÁBRICA DE PASTAS</h1>
                <p class="text-xs text-slate-500">${nombreTipoComprobanteVenta(cv.id_tipo_comprobante_venta)}</p>
                <p class="text-xs font-semibold text-slate-800 mt-2">Cliente: ${c ? c.nombreMostrado : cv.cliente}</p>
                ${c ? `<p class="text-xs text-slate-500">${c.documentoCompleto} · ${c.direccionCompleta}</p>` : ''}
            </div>
            <div class="text-right">
                <p class="text-sm font-bold text-slate-800">CV-${String(cv.id_comprobante_venta_cliente).padStart(5, '0')}</p>
                <p class="text-xs text-slate-400">Pedido asociado: PED-${cv.id_orden_pedido_cliente}</p>
                <p class="text-xs text-slate-400">Fecha: ${fechaFormateada} — Hora: ${cv.hora_emision || '-'}</p>
                ${cv.es_anulado ? `<span class="inline-block mt-1 px-2.5 py-1 bg-slate-200 text-slate-600 text-xs font-semibold rounded-full">Anulado</span>` : ''}
            </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500">
            <p><b class="text-slate-700">Condición de Venta:</b> ${cv.condicion_venta}</p>
            <p><b class="text-slate-700">Empleado Responsable:</b> ${cv.id_empleado}</p>
            ${cv.observaciones ? `<p class="sm:col-span-2"><b class="text-slate-700">Observaciones:</b> ${cv.observaciones}</p>` : ''}
        </div>
        <table class="w-full text-xs text-left">
            <thead class="border-b border-slate-300 uppercase text-slate-500">
                <tr><th class="py-2">Producto</th><th class="py-2 text-center">Cant.</th><th class="py-2 text-right">P. Unitario</th><th class="py-2 text-right">Subtotal</th></tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>
        <div class="border-t border-slate-200 pt-4 space-y-1 text-right">
            <p class="text-xs text-slate-500">Subtotal: $ ${cv.subtotal.toLocaleString()}</p>
            <p class="text-xs text-emerald-600">Bonificación (${cv.porcentaje_bonificacion}%): -$ ${descuentoMonto.toLocaleString()}</p>
            <p class="text-lg font-bold text-slate-900">Total: $ ${cv.total.toLocaleString()}</p>
        </div>
    `;
    mostrarSubvistaVentas('comprobante-venta');
}

function initPaginaVentas() {
    renderizarClientesUI();
    renderizarEmpleadosUI();
    renderizarTablaPedidosRegistrados();
    resetFormularioPedido();
    irASubvistaDesdeHash();
    window.addEventListener('hashchange', irASubvistaDesdeHash);
}
