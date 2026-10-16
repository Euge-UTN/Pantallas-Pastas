// ==========================================
// MÓDULO DE COMPRAS
// Presupuestos de Proveedores -> Registrar Orden de Compra -> Órdenes de Compra
// Mismo patrón que Ventas (Presupuesto -> Pedido), aplicado a Proveedores / Materias Primas.
// ==========================================

const SUBVISTAS_COMPRAS = ['ordenes-compra', 'registrar-orden-compra', 'detalle-orden-compra', 'presupuestos-proveedor', 'registrar-presupuesto-proveedor', 'presupuesto-proveedor-detalle', 'remitos', 'registrar-remito', 'detalle-remito'];
function mostrarSubvistaCompras(subvista) {
    SUBVISTAS_COMPRAS.forEach(v => document.getElementById(`vista-${v}`).classList.add('hidden'));
    const vistaDestino = document.getElementById(`vista-${subvista}`);
    if (vistaDestino) vistaDestino.classList.remove('hidden');
}

// Navegación por hash: sincroniza el sub-menú del sidebar con la subvista mostrada.
function irASubvistaDesdeHashCompras() {
    const hash = (window.location.hash || '').replace('#', '') || 'ordenes-compra';
    if (hash === 'registrar-orden-compra') {
        if (!ordenCompraEnConversionId) resetFormularioOC();
        mostrarSubvistaCompras('registrar-orden-compra');
    } else if (hash === 'presupuestos') {
        renderizarTablaPresupuestosProveedor();
        mostrarSubvistaCompras('presupuestos-proveedor');
    } else if (hash === 'registrar-presupuesto') {
        if (!presupuestoProveedorEnEdicionId) {
            resetFormularioPresupuestoProveedor();
            precargarNotaPedidoMPPendiente();
        }
        mostrarSubvistaCompras('registrar-presupuesto-proveedor');
    } else if (hash === 'remitos') {
        renderizarTablaRemitos();
        mostrarSubvistaCompras('remitos');
    } else if (hash === 'registrar-remito') {
        resetFormularioRemito();
        mostrarSubvistaCompras('registrar-remito');
    } else {
        renderizarTablaOrdenesCompra();
        mostrarSubvistaCompras('ordenes-compra');
    }
}

function irARegistrarOrdenCompra() {
    resetFormularioOC();
    mostrarSubvistaCompras('registrar-orden-compra');
    if (window.location.hash !== '#registrar-orden-compra') window.location.hash = 'registrar-orden-compra';
}

function volverAlListadoCompras() {
    resetFormularioOC();
    renderizarTablaOrdenesCompra();
    mostrarSubvistaCompras('ordenes-compra');
    if (window.location.hash !== '#ordenes-compra') window.location.hash = 'ordenes-compra';
}

// ==========================================
// REGISTRAR ORDEN DE COMPRA
// ==========================================
let itemsOCActual = [];
let proveedorSeleccionadoOC = null;
let ordenCompraEnConversionId = null; // id del presupuesto de proveedor que se está convirtiendo en orden

// ==========================================
// MODAL: AGREGAR PROVEEDOR RÁPIDO (desde Registrar Presupuesto u Registrar Orden de Compra)
// ==========================================
let destinoModalNuevoProveedor = 'presupuesto'; // 'presupuesto' | 'remito' - a qué autocompletado vuelve tras guardar

function abrirModalNuevoProveedor(destino = 'presupuesto') {
    destinoModalNuevoProveedor = destino;
    ['mprov-razon-social', 'mprov-numero-documento', 'mprov-altura', 'mprov-cp', 'mprov-telefono', 'mprov-email', 'mprov-rubro', 'mprov-tiempo-entrega'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('mprov-tipo-documento').selectedIndex = 0;
    document.getElementById('mprov-iva').selectedIndex = 0;
    document.getElementById('mprov-fecha-alta').value = new Date().toISOString().slice(0, 10);
    document.getElementById('mprov-provincia').selectedIndex = 0;
    cargarLocalidadesCascada('mprov');
    document.getElementById('modal-nuevo-proveedor').classList.remove('hidden');
}

function cerrarModalNuevoProveedor() {
    document.getElementById('modal-nuevo-proveedor').classList.add('hidden');
}

function guardarProveedorDesdeCompras() {
    const razonSocial = document.getElementById('mprov-razon-social').value.trim();
    const tipoDocumento = document.getElementById('mprov-tipo-documento').value;
    const numeroDocumento = document.getElementById('mprov-numero-documento').value.trim();
    const calleObj = obtenerCalleSeleccionada('mprov');
    const provincia = document.getElementById('mprov-provincia').value;
    const localidad = document.getElementById('mprov-localidad').value;
    const altura = document.getElementById('mprov-altura').value.trim();
    const telefono = document.getElementById('mprov-telefono').value.trim();
    const email = document.getElementById('mprov-email').value.trim();
    const iva = document.getElementById('mprov-iva').value;
    const rubro = document.getElementById('mprov-rubro').value.trim();
    const fechaAlta = document.getElementById('mprov-fecha-alta').value;
    const tiempoEntrega = document.getElementById('mprov-tiempo-entrega').value.trim();

    if (!razonSocial || !numeroDocumento) return alert('Completá el Nombre y el Número de Documento.');
    if (!provincia || !localidad || !calleObj || !altura) return alert('Completá Provincia, Localidad, Calle y Altura.');
    if (!telefono) return alert('Completá el Teléfono.');
    if (!email) return alert('Completá el Correo Electrónico.');
    if (!rubro) return alert('Completá el Rubro.');
    if (!fechaAlta) return alert('Seleccioná la Fecha de Alta.');
    if (!tiempoEntrega) return alert('Completá el Tiempo de Entrega Estimado.');

    const nuevo = new Proveedor('', '', tipoDocumento, numeroDocumento, calleObj, altura, telefono, email, iva, rubro, razonSocial, fechaAlta, tiempoEntrega, true);
    listaProveedores.unshift(nuevo);
    guardarDatos();

    const idx = listaProveedores.indexOf(nuevo);
    if (destinoModalNuevoProveedor === 'remito') {
        elegirProveedorRemito(idx);
    } else {
        elegirProveedorPresupuesto(idx);
    }
    cerrarModalNuevoProveedor();
}

// La Orden de Compra se origina obligatoriamente en un Presupuesto de Proveedor Pendiente:
// se busca directo el presupuesto (por N° o por proveedor) y éste completa proveedor + ítems,
// mismo rol que "Generar Pedido" desde un Presupuesto en Ventas, pero buscado acá adentro.
function filtrarPresupuestosAutocompletadoOC() {
    const input = document.getElementById('oc-presupuesto-autocompletar');
    const cont = document.getElementById('oc-presupuesto-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    document.getElementById('select-oc-presupuesto').value = '';
    proveedorSeleccionadoOC = null;
    ordenCompraEnConversionId = null;
    document.getElementById('ficha-proveedor-oc').classList.add('hidden');
    itemsOCActual = [];
    renderizarTablaOC();

    if (!termino) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }

    const pendientes = listaPresupuestosProveedor.filter(pr => pr.estado === 'Pendiente');
    const filtrados = pendientes.filter(pr => {
        const proveedor = pr.proveedorObj ? pr.proveedorObj.nombreMostrado : (pr.proveedor || '');
        return normalizarTexto(proveedor).includes(termino) || String(pr.id_presupuesto_proveedor).includes(termino);
    });
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(pr => {
        const idx = listaPresupuestosProveedor.indexOf(pr);
        const proveedor = pr.proveedorObj ? pr.proveedorObj.nombreMostrado : (pr.proveedor || '-');
        return `<button type="button" onmousedown="event.preventDefault(); elegirPresupuestoOC(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${formatearIdentificador("PRES-PROV", String(pr.id_presupuesto_proveedor).padStart(4, '0'))} - ${proveedor}</span>
            <span class="block text-[11px] text-slate-400">$ ${pr.total_estimado.toLocaleString()}</span>
        </button>`;
    }).join('');
    cont.classList.remove('hidden');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#oc-presupuesto-autocompletar') && !e.target.closest('#oc-presupuesto-autocompletar-opciones')) {
        document.getElementById('oc-presupuesto-autocompletar-opciones')?.classList.add('hidden');
    }
});

function elegirPresupuestoOC(idx) {
    const pr = listaPresupuestosProveedor[idx];
    if (!pr || pr.estado !== 'Pendiente') return;

    ordenCompraEnConversionId = pr.id_presupuesto_proveedor;
    proveedorSeleccionadoOC = pr.proveedorObj;
    document.getElementById('oc-presupuesto-autocompletar').value = `${formatearIdentificador("PRES-PROV", String(pr.id_presupuesto_proveedor).padStart(4, '0'))} - ${pr.proveedorObj ? pr.proveedorObj.nombreMostrado : pr.proveedor}`;
    document.getElementById('select-oc-presupuesto').value = idx;
    document.getElementById('oc-presupuesto-autocompletar-opciones').classList.add('hidden');

    itemsOCActual = pr.detalle.map(i => ({ id: Date.now() + Math.random(), clave: i.clave, tipo: i.tipo, marca: i.marca, nombre: i.nombre, cantidad: i.cantidad, precioUnitario: i.precio_unitario, subtotal: i.subtotal }));
    document.getElementById('oc-observaciones').value = pr.observaciones || '';
    mostrarFichaProveedorOC(pr);
    renderizarTablaOC();
}

function mostrarFichaProveedorOC(pr) {
    const ficha = document.getElementById('ficha-proveedor-oc');
    const p = proveedorSeleccionadoOC;
    if (!p) { ficha.classList.add('hidden'); return; }
    ficha.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            <p><b class="text-slate-700">Proveedor:</b> ${p.nombreMostrado}</p>
            <p><b class="text-slate-700">Rubro:</b> ${p.rubro || '-'}</p>
            <p><b class="text-slate-700">Documento:</b> ${p.documentoCompleto}</p>
            <p><b class="text-slate-700">Condición IVA:</b> ${p.condicion_iva}</p>
            <p><b class="text-slate-700">Dirección:</b> ${p.direccionCompleta}</p>
            <p><b class="text-slate-700">Condición de Entrega:</b> ${pr.condicion_entrega || '-'}</p>
        </div>`;
    ficha.classList.remove('hidden');
}

function filtrarMateriaPrimaAutocompletadoOC() {
    const input = document.getElementById('oc-mp-autocompletar');
    const cont = document.getElementById('oc-mp-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    document.getElementById('oc-mp-select').value = '';

    if (!termino) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }

    const filtrados = CATALOGO_MATERIAS_PRIMAS.filter(m => normalizarTexto(m.nombre).includes(termino) || normalizarTexto(nombreTipoMateriaPrima(m.id_tipo_materia_prima)).includes(termino) || normalizarTexto(nombreMarca(m.id_marca)).includes(termino));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(m => {
        const idx = CATALOGO_MATERIAS_PRIMAS.indexOf(m);
        return `<button type="button" onmousedown="event.preventDefault(); elegirMateriaPrimaOC(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${m.nombre}</span>
            <span class="block text-[11px] text-slate-400">${nombreTipoMateriaPrima(m.id_tipo_materia_prima)} · ${nombreMarca(m.id_marca)}</span>
        </button>`;
    }).join('');
    cont.classList.remove('hidden');
}

function elegirMateriaPrimaOC(idx) {
    const m = CATALOGO_MATERIAS_PRIMAS[idx];
    document.getElementById('oc-mp-autocompletar').value = m.nombre;
    document.getElementById('oc-mp-select').value = idx;
    document.getElementById('oc-mp-autocompletar-opciones').classList.add('hidden');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#oc-mp-autocompletar') && !e.target.closest('#oc-mp-autocompletar-opciones')) {
        document.getElementById('oc-mp-autocompletar-opciones')?.classList.add('hidden');
    }
});

function agregarMateriaPrimaOC() {
    const idx = parseInt(document.getElementById('oc-mp-select').value);
    const cantidad = parseInt(document.getElementById('oc-mp-cant').value);

    if (isNaN(idx)) return alert('Elegí una materia prima de la lista de sugerencias.');
    if (!cantidad || cantidad <= 0) return alert('Ingrese una cantidad válida.');

    const m = CATALOGO_MATERIAS_PRIMAS[idx];
    const itemExistente = itemsOCActual.find(item => item.clave === m.clave);
    if (itemExistente) {
        itemExistente.cantidad += cantidad;
        itemExistente.subtotal = itemExistente.cantidad * itemExistente.precioUnitario;
    } else {
        itemsOCActual.push({ id: Date.now(), clave: m.clave, tipo: nombreTipoMateriaPrima(m.id_tipo_materia_prima), marca: nombreMarca(m.id_marca), nombre: m.nombre, cantidad, precioUnitario: m.precio, subtotal: m.precio * cantidad });
    }
    document.getElementById('oc-mp-autocompletar').value = '';
    document.getElementById('oc-mp-select').value = '';
    document.getElementById('oc-mp-cant').value = 1;
    renderizarTablaOC();
}

function eliminarItemOC(id) {
    itemsOCActual = itemsOCActual.filter(item => item.id !== id);
    renderizarTablaOC();
}

function renderizarTablaOC() {
    const tbody = document.getElementById('tabla-items-oc');
    tbody.innerHTML = '';
    itemsOCActual.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 text-slate-500">${item.tipo}</td>
            <td class="p-3 text-slate-500">${item.marca}</td>
            <td class="p-3 font-medium text-slate-800">${item.nombre}</td>
            <td class="p-3 text-center">
                <input type="number" min="1" value="${item.cantidad}" onchange="actualizarCantidadItemOC(${item.id}, this.value)" class="w-16 text-center border border-slate-300 rounded-md p-1 text-sm outline-none focus:ring-2 focus:ring-red-500">
            </td>
            <td class="p-3 text-right">$ ${item.precioUnitario.toLocaleString()}</td>
            <td class="p-3 text-right font-semibold">$ ${item.subtotal.toLocaleString()}</td>
            <td class="p-3 text-center">
                <button type="button" onclick="eliminarItemOC(${item.id})" class="text-red-500 hover:text-red-700">
                    <i data-lucide="trash-2" class="w-4 h-4 inline"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
    calcularTotalOC();
}

function actualizarCantidadItemOC(id, nuevaCantidad) {
    const cantidad = parseInt(nuevaCantidad);
    const item = itemsOCActual.find(i => i.id === id);
    if (!item) return;
    if (!cantidad || cantidad <= 0) { renderizarTablaOC(); return; }
    item.cantidad = cantidad;
    item.subtotal = item.cantidad * item.precioUnitario;
    renderizarTablaOC();
}

function calcularTotalOC() {
    const total = itemsOCActual.reduce((acc, i) => acc + i.subtotal, 0);
    document.getElementById('cant-items-oc').innerText = itemsOCActual.length;
    document.getElementById('total-oc-monto').innerText = `$ ${total.toLocaleString()}`;
    return total;
}

function resetFormularioOC() {
    itemsOCActual = [];
    proveedorSeleccionadoOC = null;
    ordenCompraEnConversionId = null;
    document.getElementById('oc-presupuesto-autocompletar').value = '';
    document.getElementById('select-oc-presupuesto').value = '';
    document.getElementById('ficha-proveedor-oc').classList.add('hidden');
    document.getElementById('oc-condicion-pago').selectedIndex = 0;
    document.getElementById('oc-observaciones').value = '';
    document.getElementById('oc-mp-autocompletar').value = '';
    document.getElementById('oc-mp-select').value = '';
    document.getElementById('oc-mp-cant').value = 1;
    renderizarTablaOC();
    lucide.createIcons();
}

function confirmarOrdenCompra() {
    if (!ordenCompraEnConversionId || !proveedorSeleccionadoOC) return alert('Buscá y seleccioná un presupuesto de proveedor: toda Orden de Compra debe originarse en uno.');
    if (itemsOCActual.length === 0) return alert('Añadí al menos una materia prima a la orden.');
    const condicionPago = document.getElementById('oc-condicion-pago').value;
    if (!condicionPago) return alert('Seleccioná la condición de pago.');

    const observaciones = document.getElementById('oc-observaciones').value.trim();
    const detalle = itemsOCActual.map(i => ({ ...i }));
    const total = detalle.reduce((acc, i) => acc + i.subtotal, 0);
    const ahora = new Date();

    const nuevaOrden = {
        id: numOrdenCompraContador++, id_presupuesto_proveedor: ordenCompraEnConversionId,
        proveedorObj: proveedorSeleccionadoOC, proveedor: proveedorSeleccionadoOC.nombreMostrado,
        fecha_emision: ahora.toISOString().slice(0, 10), hora_emision: ahora.toTimeString().slice(0, 5),
        condicion_pago: condicionPago, estado: 'Enviada', observaciones, detalle, total
    };
    listaOrdenesCompra.unshift(nuevaOrden);

    const presupuesto = listaPresupuestosProveedor.find(p => p.id_presupuesto_proveedor === ordenCompraEnConversionId);
    if (presupuesto) { presupuesto.estado = 'Convertido'; presupuesto.idOrdenCompraGenerada = nuevaOrden.id; }

    guardarDatos();
    alert(`¡Orden de Compra ${formatearIdentificador("OC", nuevaOrden.id)} emitida a "${proveedorSeleccionadoOC.nombreMostrado}"!`);
    volverAlListadoCompras();
}

// ==========================================
// ÓRDENES DE COMPRA (listado)
// ==========================================
let ordenOCCampo = null;
let ordenOCDireccion = null;
let filtroOCEstadoSeleccionado = '';

function renderizarTablaOrdenesCompra() {
    const tbody = document.getElementById('tabla-ordenes-compra');
    tbody.innerHTML = '';

    const ordenesValidas = listaOrdenesCompra.filter(oc => oc.estado !== 'Cancelada');
    document.getElementById('kpi-oc-total-ordenes').innerText = listaOrdenesCompra.length;
    document.getElementById('kpi-oc-enviadas').innerText = listaOrdenesCompra.filter(oc => oc.estado === 'Enviada').length;
    document.getElementById('kpi-oc-proveedores').innerText = new Set(ordenesValidas.map(oc => oc.proveedorObj)).size;
    document.getElementById('kpi-oc-monto-total').innerText = `$ ${ordenesValidas.reduce((a, oc) => a + oc.total, 0).toLocaleString()}`;
    const ticketPromedio = ordenesValidas.length ? ordenesValidas.reduce((a, oc) => a + oc.total, 0) / ordenesValidas.length : 0;
    document.getElementById('kpi-oc-ticket-promedio').innerText = `$ ${Math.round(ticketPromedio).toLocaleString()}`;

    const terminoNum = normalizarTexto(document.getElementById('buscar-num-oc')?.value || '').trim();
    const terminoPresupuesto = normalizarTexto(document.getElementById('buscar-num-presupuesto-oc')?.value || '').trim();
    const terminoProveedor = normalizarTexto(document.getElementById('buscar-proveedor-oc')?.value || '').trim();
    const fechaDesde = document.getElementById('buscar-fecha-desde-oc')?.value || '';
    const fechaHasta = document.getElementById('buscar-fecha-hasta-oc')?.value || '';
    const montoDesde = document.getElementById('buscar-monto-desde-oc')?.value || '';
    const montoHasta = document.getElementById('buscar-monto-hasta-oc')?.value || '';

    let ordenesFiltradas = listaOrdenesCompra.filter(oc => {
        const proveedor = oc.proveedorObj ? oc.proveedorObj.nombreMostrado : (oc.proveedor || '');
        return (!terminoNum || String(oc.id).includes(terminoNum)) &&
            (!terminoPresupuesto || (oc.id_presupuesto_proveedor && String(oc.id_presupuesto_proveedor).includes(terminoPresupuesto))) &&
            (!terminoProveedor || normalizarTexto(proveedor).includes(terminoProveedor)) &&
            (!filtroOCEstadoSeleccionado || oc.estado === filtroOCEstadoSeleccionado) &&
            coincideRangoFecha(fechaDesde, fechaHasta, oc.fecha_emision) &&
            coincideRangoMonto(montoDesde, montoHasta, oc.total);
    });

    if (ordenOCCampo && ordenOCDireccion) {
        ordenesFiltradas.sort((a, b) => {
            const va = (a.proveedorObj ? a.proveedorObj.nombreMostrado : (a.proveedor || '')) || '';
            const vb = (b.proveedorObj ? b.proveedorObj.nombreMostrado : (b.proveedor || '')) || '';
            const cmp = va.localeCompare(vb, 'es');
            return ordenOCDireccion === 'asc' ? cmp : -cmp;
        });
    }
    actualizarIconosOrdenOC();
    actualizarIconoFiltroEstadoOC();

    if (!ordenesFiltradas.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-10 text-center text-slate-400 text-sm">No se encontraron órdenes de compra con ese criterio.</td></tr>`;
    }
    ordenesFiltradas.forEach(oc => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        const activa = oc.estado === 'Enviada';
        const fechaFormateada = oc.fecha_emision ? new Date(oc.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '-';
        tr.innerHTML = `
            <td class="px-6 py-4 font-semibold text-slate-900">${formatearIdentificador('OC', oc.id)}</td>
            <td class="px-6 py-4 text-slate-500">${oc.id_presupuesto_proveedor ? `${formatearIdentificador("PRES-PROV", String(oc.id_presupuesto_proveedor).padStart(4, '0'))}` : '-'}</td>
            <td class="px-6 py-4 text-slate-800">${oc.proveedorObj ? oc.proveedorObj.nombreMostrado : (oc.proveedor || '-')}</td>
            <td class="px-6 py-4 text-slate-500">${fechaFormateada}</td>
            <td class="px-6 py-4 text-right font-medium whitespace-nowrap">$ ${oc.total.toLocaleString()}</td>
            <td class="px-6 py-4 text-center"><span class="px-2.5 py-1 ${COLOR_ESTADO_ORDEN_COMPRA[oc.estado]} text-xs font-semibold rounded-full whitespace-nowrap">${oc.estado}</span></td>
            <td class="px-6 py-4">
                <div class="flex items-center justify-start gap-1.5">
                    <button onclick="verDetalleOrdenCompra(${oc.id})" title="Ver detalle" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    ${activa ? `<button onclick="avanzarEstadoOrdenCompra(${oc.id})" title="Marcar Recibida" class="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"><i data-lucide="arrow-right-circle" class="w-4 h-4"></i></button>` : ''}
                    ${activa ? `<button onclick="cancelarOrdenCompra(${oc.id})" title="Cancelar orden" class="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"><i data-lucide="x-circle" class="w-4 h-4"></i></button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function alternarOrdenOC(campo) {
    if (ordenOCCampo !== campo) { ordenOCCampo = campo; ordenOCDireccion = 'asc'; }
    else if (ordenOCDireccion === 'asc') { ordenOCDireccion = 'desc'; }
    else { ordenOCCampo = null; ordenOCDireccion = null; }
    renderizarTablaOrdenesCompra();
}

function actualizarIconosOrdenOC() {
    ['proveedor'].forEach(campo => {
        const boton = document.getElementById(`btn-orden-${campo}-oc`);
        if (!boton) return;
        const activo = ordenOCCampo === campo;
        const icono = activo && ordenOCDireccion === 'asc' ? 'arrow-up' : activo && ordenOCDireccion === 'desc' ? 'arrow-down' : 'arrow-up-down';
        boton.className = `normal-case transition ${activo ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
        boton.innerHTML = `<i data-lucide="${icono}" class="w-3.5 h-3.5"></i>`;
    });
}

function elegirFiltroEstadoOC(valor) {
    filtroOCEstadoSeleccionado = valor;
    document.getElementById('pop-estado-oc').classList.add('hidden');
    renderizarTablaOrdenesCompra();
}
function actualizarIconoFiltroEstadoOC() {
    const boton = document.getElementById('btn-filtro-estado-oc');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroOCEstadoSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-estado-oc').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroOCEstadoSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroOCEstadoSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroOCEstadoSeleccionado);
    });
}

function avanzarEstadoOrdenCompra(id) {
    const oc = listaOrdenesCompra.find(o => o.id === id);
    if (!oc || oc.estado !== 'Enviada') return;
    oc.estado = 'Recibida';
    guardarDatos();
    renderizarTablaOrdenesCompra();
}

function cancelarOrdenCompra(id) {
    if (!confirm(`¿Confirma la cancelación de la orden de compra ${formatearIdentificador("OC", id)}?`)) return;
    const oc = listaOrdenesCompra.find(o => o.id === id);
    if (!oc) return;
    oc.estado = 'Cancelada';
    guardarDatos();
    renderizarTablaOrdenesCompra();
}

function tarjetaProveedorComprasHTML(proveedor, nombreFallback, etiquetaExtra, valorExtra) {
    return `
        <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1 text-xs">
            <h3 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><i data-lucide="truck" class="w-3.5 h-3.5"></i>Proveedor</h3>
            ${proveedor ? `
                <p><b class="text-slate-700">Nombre:</b> ${proveedor.nombreMostrado}</p>
                <p><b class="text-slate-700">Documento:</b> ${proveedor.documentoCompleto}</p>
                <p><b class="text-slate-700">Domicilio:</b> ${proveedor.direccionCompleta}</p>
                <p><b class="text-slate-700">Teléfono:</b> ${proveedor.telefono || '-'}</p>` : `<p><b class="text-slate-700">Nombre:</b> ${nombreFallback || '-'}</p>`}
            ${etiquetaExtra ? `<p><b class="text-slate-700">${etiquetaExtra}:</b> ${valorExtra || '-'}</p>` : ''}
        </div>`;
}

function verDetalleOrdenCompra(id) {
    const oc = listaOrdenesCompra.find(o => o.id === id);
    if (!oc) return;
    const p = oc.proveedorObj;
    const fechaFormateada = oc.fecha_emision ? new Date(oc.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '-';

    const filas = (oc.detalle || []).map(i => `
        <tr class="border-b border-slate-100">
            <td class="py-2 text-slate-500">${i.tipo}</td>
            <td class="py-2 text-slate-500">${i.marca}</td>
            <td class="py-2">${i.nombre}</td>
            <td class="py-2 text-center">${i.cantidad}</td>
            <td class="py-2 text-right">$ ${i.precioUnitario.toLocaleString()}</td>
            <td class="py-2 text-right">$ ${i.subtotal.toLocaleString()}</td>
        </tr>`).join('');

    const fechaRecepcionFormateada = oc.fecha_recepcion ? new Date(oc.fecha_recepcion + 'T00:00:00').toLocaleDateString('es-AR') : null;

    document.getElementById('area-detalle-orden-compra').innerHTML = `
        <div class="flex justify-between items-start border-b border-slate-200 pb-4">
            <div>
                <h1 class="text-2xl font-bold text-red-600">FÁBRICA DE PASTAS</h1>
                <p class="text-xs text-slate-500">Orden de Compra a Proveedor</p>
                <p class="text-sm font-bold text-slate-800 mt-2">${formatearIdentificador('OC', oc.id)}</p>
                ${oc.id_presupuesto_proveedor ? `<p class="text-xs text-slate-400 mt-1">Generada desde ${formatearIdentificador("PRES-PROV", String(oc.id_presupuesto_proveedor).padStart(4, '0'))}</p>` : ''}
            </div>
            <div class="text-right text-xs text-slate-500 space-y-0.5">
                <p><b class="text-slate-700">Fecha de Emisión:</b> ${fechaFormateada}</p><p class="pl-1">${oc.hora_emision || '-'} hs</p>
                <p><b class="text-slate-700">Fecha de Recepción:</b> ${fechaRecepcionFormateada || 'Aún no recibida'}</p><p class="pl-1">${fechaRecepcionFormateada ? `${oc.hora_recepcion || '-'} hs` : ''}</p>
            </div>
        </div>

        ${tarjetaProveedorComprasHTML(p, oc.proveedor, 'Condición de Pago', oc.condicion_pago)}

        <div>
            <h3 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Detalle de Materias Primas</h3>
            <table class="w-full text-xs text-left">
                <thead class="border-b border-slate-300 uppercase text-slate-500">
                    <tr><th class="py-2">Tipo</th><th class="py-2">Marca</th><th class="py-2">Producto</th><th class="py-2 text-center">Cant.</th><th class="py-2 text-right">P. Unitario</th><th class="py-2 text-right">Subtotal</th></tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>

        ${oc.observaciones ? `
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <b>Observaciones:</b> ${oc.observaciones}
        </div>` : ''}

        <div class="border-t border-slate-200 pt-4 flex items-baseline gap-2">
            <span class="text-sm font-semibold text-slate-500">Total:</span>
            <span class="text-lg font-bold text-slate-900">$ ${oc.total.toLocaleString()}</span>
        </div>
    `;
    lucide.createIcons();
    mostrarSubvistaCompras('detalle-orden-compra');
}

// ==========================================
// PRESUPUESTOS DE PROVEEDORES
// ==========================================
let proveedorSeleccionadoPresupuesto = null;
let itemsPresupuestoProveedorActual = [];
let itemsPresupuestoMaquinariaActual = [];
let tipoPresupuestoProveedorActual = 'MateriaPrima'; // 'MateriaPrima' | 'Maquinaria'
let presupuestoProveedorEnEdicionId = null;
let ordenPresupuestoProveedorCampo = null;
let ordenPresupuestoProveedorDireccion = null;
let filtroPresupuestoProveedorEstadoSeleccionado = '';
let filtroTipoPresupuestoProveedorListado = '';

// Alterna entre cotizar Materia Prima o Maquinaria: bloquea/oculta la sección del tipo no elegido.
function elegirTipoPresupuestoProveedor(tipo) {
    tipoPresupuestoProveedorActual = tipo;
    document.getElementById('presup-seccion-materia-prima').classList.toggle('hidden', tipo !== 'MateriaPrima');
    document.getElementById('presup-seccion-maquinaria').classList.toggle('hidden', tipo !== 'Maquinaria');
    ['MateriaPrima', 'Maquinaria'].forEach(t => {
        const boton = document.getElementById(`tipo-presupuesto-${t}`);
        if (!boton) return;
        const activo = t === tipo;
        boton.className = `tipo-presupuesto-proveedor px-4 py-1.5 rounded-md font-semibold transition ${activo ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-white'}`;
    });
    calcularTotalPresupuestoProveedor();
}

// Si Producción generó una Nota de Pedido de MP por faltante de stock, la precarga acá como ítems del presupuesto.
function precargarNotaPedidoMPPendiente() {
    const crudo = sessionStorage.getItem('notaPedidoMPPendiente');
    if (!crudo) return;
    sessionStorage.removeItem('notaPedidoMPPendiente');
    try {
        const faltantes = JSON.parse(crudo);
        faltantes.forEach(f => {
            const cat = CATALOGO_MATERIAS_PRIMAS.find(c => c.clave === f.clave);
            if (!cat) return;
            const cantidad = Math.ceil(f.cantidad);
            itemsPresupuestoProveedorActual.push({ id: Date.now() + Math.random(), clave: cat.clave, tipo: nombreTipoMateriaPrima(cat.id_tipo_materia_prima), marca: nombreMarca(cat.id_marca), nombre: cat.nombre, cantidad, precioUnitario: cat.precio, subtotal: cantidad * cat.precio });
        });
        renderizarTablaItemsPresupuestoProveedor();
        // No hay una Orden de Producción confirmada todavía en este punto (el faltante se calcula antes de
        // registrar la producción, como chequeo previo), por eso la observación queda genérica.
        document.getElementById('presup-proveedor-observaciones').value = 'Generado automáticamente desde Producción por faltante de materia prima.';
    } catch (e) { /* nota corrupta o vacía: se ignora */ }
}

function irARegistrarPresupuestoProveedor() {
    resetFormularioPresupuestoProveedor();
    mostrarSubvistaCompras('registrar-presupuesto-proveedor');
    if (window.location.hash !== '#registrar-presupuesto') window.location.hash = 'registrar-presupuesto';
}

function volverAPresupuestosProveedor() {
    renderizarTablaPresupuestosProveedor();
    mostrarSubvistaCompras('presupuestos-proveedor');
    if (window.location.hash !== '#presupuestos') window.location.hash = 'presupuestos';
}

function filtrarProveedoresAutocompletadoPresupuesto() {
    const input = document.getElementById('presup-prov-autocompletar');
    const cont = document.getElementById('presup-prov-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    document.getElementById('select-presup-proveedor').value = '';
    proveedorSeleccionadoPresupuesto = null;
    document.getElementById('ficha-proveedor-presupuesto').classList.add('hidden');

    if (!termino) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }

    const filtrados = listaProveedores.filter(p => p.estado_activo && (normalizarTexto(`${p.nombre} ${p.apellido}`).includes(termino) || normalizarTexto(p.razon_social).includes(termino) || normalizarTexto(p.numero_documento).includes(termino)));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(p => {
        const idx = listaProveedores.indexOf(p);
        return `<button type="button" onmousedown="event.preventDefault(); elegirProveedorPresupuesto(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${p.nombreMostrado}</span>
            <span class="block text-[11px] text-slate-400">${p.rubro || '-'} · ${p.documentoCompleto}</span>
        </button>`;
    }).join('');
    cont.classList.remove('hidden');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#presup-prov-autocompletar') && !e.target.closest('#presup-prov-autocompletar-opciones')) {
        document.getElementById('presup-prov-autocompletar-opciones')?.classList.add('hidden');
    }
});

function elegirProveedorPresupuesto(idx) {
    proveedorSeleccionadoPresupuesto = listaProveedores[idx];
    document.getElementById('presup-prov-autocompletar').value = proveedorSeleccionadoPresupuesto.nombreMostrado;
    document.getElementById('select-presup-proveedor').value = idx;
    document.getElementById('presup-prov-autocompletar-opciones').classList.add('hidden');

    const ficha = document.getElementById('ficha-proveedor-presupuesto');
    const p = proveedorSeleccionadoPresupuesto;
    ficha.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            <p><b class="text-slate-700">Rubro:</b> ${p.rubro || '-'}</p>
            <p><b class="text-slate-700">Documento:</b> ${p.documentoCompleto}</p>
            <p><b class="text-slate-700">Dirección:</b> ${p.direccionCompleta}</p>
        </div>`;
    ficha.classList.remove('hidden');
}

function filtrarMateriaPrimaAutocompletadoPresupuesto() {
    const input = document.getElementById('presup-mp-autocompletar');
    const cont = document.getElementById('presup-mp-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    document.getElementById('presup-mp-select').value = '';

    if (!termino) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }

    const filtrados = CATALOGO_MATERIAS_PRIMAS.filter(m => normalizarTexto(m.nombre).includes(termino) || normalizarTexto(nombreTipoMateriaPrima(m.id_tipo_materia_prima)).includes(termino) || normalizarTexto(nombreMarca(m.id_marca)).includes(termino));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(m => {
        const idx = CATALOGO_MATERIAS_PRIMAS.indexOf(m);
        return `<button type="button" onmousedown="event.preventDefault(); elegirMateriaPrimaPresupuesto(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${m.nombre}</span>
            <span class="block text-[11px] text-slate-400">${nombreTipoMateriaPrima(m.id_tipo_materia_prima)} · ${nombreMarca(m.id_marca)}</span>
        </button>`;
    }).join('');
    cont.classList.remove('hidden');
}

function elegirMateriaPrimaPresupuesto(idx) {
    const m = CATALOGO_MATERIAS_PRIMAS[idx];
    document.getElementById('presup-mp-autocompletar').value = m.nombre;
    document.getElementById('presup-mp-select').value = idx;
    document.getElementById('presup-mp-autocompletar-opciones').classList.add('hidden');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#presup-mp-autocompletar') && !e.target.closest('#presup-mp-autocompletar-opciones')) {
        document.getElementById('presup-mp-autocompletar-opciones')?.classList.add('hidden');
    }
});

function agregarMateriaPrimaPresupuesto() {
    const idx = parseInt(document.getElementById('presup-mp-select').value);
    const cantidad = parseInt(document.getElementById('presup-mp-cant').value);

    if (isNaN(idx)) return alert('Elegí una materia prima de la lista de sugerencias.');
    if (!cantidad || cantidad <= 0) return alert('Ingrese una cantidad válida.');

    const m = CATALOGO_MATERIAS_PRIMAS[idx];
    const itemExistente = itemsPresupuestoProveedorActual.find(item => item.clave === m.clave);
    if (itemExistente) {
        itemExistente.cantidad += cantidad;
        itemExistente.subtotal = itemExistente.cantidad * itemExistente.precioUnitario;
    } else {
        itemsPresupuestoProveedorActual.push({ id: Date.now(), clave: m.clave, tipo: nombreTipoMateriaPrima(m.id_tipo_materia_prima), marca: nombreMarca(m.id_marca), nombre: m.nombre, cantidad, precioUnitario: m.precio, subtotal: m.precio * cantidad });
    }
    document.getElementById('presup-mp-autocompletar').value = '';
    document.getElementById('presup-mp-select').value = '';
    document.getElementById('presup-mp-cant').value = 1;
    renderizarTablaItemsPresupuestoProveedor();
}

function eliminarItemPresupuestoProveedor(id) {
    itemsPresupuestoProveedorActual = itemsPresupuestoProveedorActual.filter(item => item.id !== id);
    renderizarTablaItemsPresupuestoProveedor();
}

// ---------- Presupuesto de Proveedor: sección Maquinaria (mismo patrón que Materia Prima) ----------
function filtrarMaquinariaAutocompletadoPresupuesto() {
    const input = document.getElementById('presup-maq-autocompletar');
    const cont = document.getElementById('presup-maq-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    document.getElementById('presup-maq-select').value = '';
    if (!termino) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }

    const filtrados = listaMaquinaria.filter(m => normalizarTexto(m.nombre).includes(termino) || normalizarTexto(nombreMarca(m.id_marca)).includes(termino) || normalizarTexto(m.modelo).includes(termino));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(m => {
        const idx = listaMaquinaria.indexOf(m);
        return `<button type="button" onmousedown="event.preventDefault(); elegirMaquinariaAutocompletadoPresupuesto(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${nombreMarca(m.id_marca)} - ${m.modelo}</span>
            <span class="block text-[11px] text-slate-400">${m.nombre}</span>
        </button>`;
    }).join('');
    cont.classList.remove('hidden');
}

function elegirMaquinariaAutocompletadoPresupuesto(idx) {
    const m = listaMaquinaria[idx];
    document.getElementById('presup-maq-autocompletar').value = `${nombreMarca(m.id_marca)} - ${m.modelo}`;
    document.getElementById('presup-maq-select').value = idx;
    document.getElementById('presup-maq-autocompletar-opciones').classList.add('hidden');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#presup-maq-autocompletar') && !e.target.closest('#presup-maq-autocompletar-opciones')) {
        document.getElementById('presup-maq-autocompletar-opciones')?.classList.add('hidden');
    }
});

function agregarMaquinariaPresupuesto() {
    const idx = parseInt(document.getElementById('presup-maq-select').value);
    const cantidad = parseInt(document.getElementById('presup-maq-cant').value);
    const precioUnitario = parseFloat(document.getElementById('presup-maq-precio').value);

    if (isNaN(idx)) return alert('Elegí una maquinaria de la lista de sugerencias.');
    if (!cantidad || cantidad <= 0) return alert('Ingrese una cantidad válida.');
    if (!precioUnitario || precioUnitario <= 0) return alert('Ingrese el precio unitario cotizado.');

    const m = listaMaquinaria[idx];
    itemsPresupuestoMaquinariaActual.push({ id: Date.now(), id_maquinaria: m.id_maquinaria, marca: nombreMarca(m.id_marca), nombre: m.nombre, modelo: m.modelo, cantidad, precioUnitario, subtotal: precioUnitario * cantidad });
    document.getElementById('presup-maq-autocompletar').value = '';
    document.getElementById('presup-maq-select').value = '';
    document.getElementById('presup-maq-cant').value = 1;
    document.getElementById('presup-maq-precio').value = '';
    renderizarTablaItemsPresupuestoMaquinaria();
}

function eliminarItemPresupuestoMaquinaria(id) {
    itemsPresupuestoMaquinariaActual = itemsPresupuestoMaquinariaActual.filter(item => item.id !== id);
    renderizarTablaItemsPresupuestoMaquinaria();
}

function renderizarTablaItemsPresupuestoMaquinaria() {
    const tbody = document.getElementById('tabla-items-presupuesto-maquinaria');
    tbody.innerHTML = '';
    itemsPresupuestoMaquinariaActual.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 text-slate-500">${item.marca}</td>
            <td class="p-3 font-medium text-slate-800">${item.nombre} (${item.modelo})</td>
            <td class="p-3 text-right">$ ${item.precioUnitario.toLocaleString()}</td>
            <td class="p-3 text-center">
                <input type="number" min="1" value="${item.cantidad}" onchange="actualizarCantidadItemPresupuestoMaquinaria(${item.id}, this.value)" class="w-16 text-center border border-slate-300 rounded-md p-1 text-sm outline-none focus:ring-2 focus:ring-red-500">
            </td>
            <td class="p-3 text-right font-semibold">$ ${item.subtotal.toLocaleString()}</td>
            <td class="p-3 text-center">
                <button type="button" onclick="eliminarItemPresupuestoMaquinaria(${item.id})" class="text-red-500 hover:text-red-700">
                    <i data-lucide="trash-2" class="w-4 h-4 inline"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
    calcularTotalPresupuestoProveedor();
}

function actualizarCantidadItemPresupuestoMaquinaria(id, nuevaCantidad) {
    const cantidad = parseInt(nuevaCantidad);
    const item = itemsPresupuestoMaquinariaActual.find(i => i.id === id);
    if (!item) return;
    if (!cantidad || cantidad <= 0) { renderizarTablaItemsPresupuestoMaquinaria(); return; }
    item.cantidad = cantidad;
    item.subtotal = item.cantidad * item.precioUnitario;
    renderizarTablaItemsPresupuestoMaquinaria();
}

function renderizarTablaItemsPresupuestoProveedor() {
    const tbody = document.getElementById('tabla-items-presupuesto-proveedor');
    tbody.innerHTML = '';
    itemsPresupuestoProveedorActual.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 text-slate-500">${item.tipo}</td>
            <td class="p-3 text-slate-500">${item.marca}</td>
            <td class="p-3 font-medium text-slate-800">${item.nombre}</td>
            <td class="p-3 text-right">$ ${item.precioUnitario.toLocaleString()}</td>
            <td class="p-3 text-center">
                <input type="number" min="1" value="${item.cantidad}" onchange="actualizarCantidadItemPresupuestoProveedor(${item.id}, this.value)" class="w-16 text-center border border-slate-300 rounded-md p-1 text-sm outline-none focus:ring-2 focus:ring-red-500">
            </td>
            <td class="p-3 text-right font-semibold">$ ${item.subtotal.toLocaleString()}</td>
            <td class="p-3 text-center">
                <button type="button" onclick="eliminarItemPresupuestoProveedor(${item.id})" class="text-red-500 hover:text-red-700">
                    <i data-lucide="trash-2" class="w-4 h-4 inline"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
    calcularTotalPresupuestoProveedor();
}

function actualizarCantidadItemPresupuestoProveedor(id, nuevaCantidad) {
    const cantidad = parseInt(nuevaCantidad);
    const item = itemsPresupuestoProveedorActual.find(i => i.id === id);
    if (!item) return;
    if (!cantidad || cantidad <= 0) { renderizarTablaItemsPresupuestoProveedor(); return; }
    item.cantidad = cantidad;
    item.subtotal = item.cantidad * item.precioUnitario;
    renderizarTablaItemsPresupuestoProveedor();
}

function calcularTotalPresupuestoProveedor() {
    const items = tipoPresupuestoProveedorActual === 'Maquinaria' ? itemsPresupuestoMaquinariaActual : itemsPresupuestoProveedorActual;
    const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0);
    const bonifPct = parseFloat(document.getElementById('presup-bonificacion')?.value) || 0;
    const bonifMonto = subtotal * (bonifPct / 100);
    const total = Math.max(0, subtotal - bonifMonto);

    document.getElementById('cant-items-presupuesto-proveedor').innerText = items.length;
    document.getElementById('subtotal-presupuesto-proveedor-monto').innerText = `$ ${subtotal.toLocaleString()}`;
    document.getElementById('label-bonificacion-presupuesto-proveedor').innerText = `Bonificación (${bonifPct}%)`;
    document.getElementById('bonificacion-presupuesto-proveedor-monto').innerText = `-$ ${bonifMonto.toLocaleString()}`;
    document.getElementById('total-presupuesto-proveedor-monto').innerText = `$ ${total.toLocaleString()}`;
    return total;
}

function resetFormularioPresupuestoProveedor() {
    itemsPresupuestoProveedorActual = [];
    itemsPresupuestoMaquinariaActual = [];
    proveedorSeleccionadoPresupuesto = null;
    presupuestoProveedorEnEdicionId = null;
    document.getElementById('titulo-form-presupuesto-proveedor').innerText = 'Registrar Presupuesto de Proveedor';
    document.getElementById('btn-guardar-presupuesto-proveedor').innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i><span>Guardar Presupuesto</span>';
    document.getElementById('presup-prov-autocompletar').value = '';
    document.getElementById('select-presup-proveedor').value = '';
    document.getElementById('ficha-proveedor-presupuesto').classList.add('hidden');
    document.getElementById('presup-condicion-entrega').value = '';
    const ahora = new Date();
    document.getElementById('presup-fecha-emision').value = ahora.toISOString().slice(0, 10);
    document.getElementById('presup-hora-emision').value = ahora.toTimeString().slice(0, 5);
    document.getElementById('presup-fecha-vencimiento').value = '';
    document.getElementById('presup-bonificacion').value = 0;
    document.getElementById('presup-proveedor-observaciones').value = '';
    document.getElementById('presup-mp-autocompletar').value = '';
    document.getElementById('presup-mp-select').value = '';
    document.getElementById('presup-mp-cant').value = 1;
    document.getElementById('presup-maq-autocompletar').value = '';
    document.getElementById('presup-maq-select').value = '';
    document.getElementById('presup-maq-cant').value = 1;
    document.getElementById('presup-maq-precio').value = '';
    document.getElementById('presup-proveedor-empleado').value = usuarioInternoActual.nombre;
    document.getElementById('presup-proveedor-empleado-nombre').textContent = `${usuarioInternoActual.nombre} (${usuarioInternoActual.rol})`;
    elegirTipoPresupuestoProveedor('MateriaPrima');
    renderizarTablaItemsPresupuestoProveedor();
    renderizarTablaItemsPresupuestoMaquinaria();
    lucide.createIcons();
}

function editarPresupuestoProveedor(id) {
    const presupuesto = listaPresupuestosProveedor.find(p => p.id_presupuesto_proveedor === id);
    if (!presupuesto || presupuesto.estado !== 'Pendiente') return;

    presupuestoProveedorEnEdicionId = id;
    itemsPresupuestoProveedorActual = [];
    itemsPresupuestoMaquinariaActual = [];
    if (presupuesto.tipo === 'Maquinaria') {
        itemsPresupuestoMaquinariaActual = presupuesto.detalle.map(i => ({ id: Date.now() + Math.random(), id_maquinaria: i.id_maquinaria, marca: i.marca, nombre: i.nombre, modelo: i.modelo, cantidad: i.cantidad, precioUnitario: i.precio_unitario, subtotal: i.subtotal }));
    } else {
        itemsPresupuestoProveedorActual = presupuesto.detalle.map(i => ({ id: Date.now() + Math.random(), clave: i.clave, tipo: i.tipo, marca: i.marca, nombre: i.nombre, cantidad: i.cantidad, precioUnitario: i.precio_unitario, subtotal: i.subtotal }));
    }

    document.getElementById('titulo-form-presupuesto-proveedor').innerText = `Editar Presupuesto ${formatearIdentificador("PRES-PROV", String(id).padStart(4, '0'))}`;
    document.getElementById('btn-guardar-presupuesto-proveedor').innerHTML = '<i data-lucide="save" class="w-4 h-4"></i><span>Guardar Cambios</span>';

    elegirProveedorPresupuesto(listaProveedores.indexOf(presupuesto.proveedorObj));
    elegirTipoPresupuestoProveedor(presupuesto.tipo || 'MateriaPrima');
    document.getElementById('presup-condicion-entrega').value = presupuesto.condicion_entrega || '';
    document.getElementById('presup-fecha-emision').value = presupuesto.fecha_emision || '';
    document.getElementById('presup-hora-emision').value = presupuesto.hora_emision || '';
    document.getElementById('presup-fecha-vencimiento').value = presupuesto.fecha_vencimiento || '';
    document.getElementById('presup-bonificacion').value = presupuesto.bonificacion || 0;
    document.getElementById('presup-proveedor-observaciones').value = presupuesto.observaciones || '';
    document.getElementById('presup-proveedor-empleado').value = presupuesto.empleado || usuarioInternoActual.nombre;
    document.getElementById('presup-proveedor-empleado-nombre').textContent = presupuesto.empleado || `${usuarioInternoActual.nombre} (${usuarioInternoActual.rol})`;

    renderizarTablaItemsPresupuestoProveedor();
    renderizarTablaItemsPresupuestoMaquinaria();
    mostrarSubvistaCompras('registrar-presupuesto-proveedor');
    if (window.location.hash !== '#registrar-presupuesto') window.location.hash = 'registrar-presupuesto';
    lucide.createIcons();
}

function guardarPresupuestoProveedor() {
    if (!proveedorSeleccionadoPresupuesto) return alert('Buscá y seleccioná el proveedor.');
    const esMaquinaria = tipoPresupuestoProveedorActual === 'Maquinaria';
    const itemsActivos = esMaquinaria ? itemsPresupuestoMaquinariaActual : itemsPresupuestoProveedorActual;
    if (itemsActivos.length === 0) return alert(`Añadí al menos ${esMaquinaria ? 'una maquinaria' : 'una materia prima'} al presupuesto.`);

    const condicionEntrega = document.getElementById('presup-condicion-entrega').value.trim();
    const fechaEmision = document.getElementById('presup-fecha-emision').value;
    const horaEmision = document.getElementById('presup-hora-emision').value;
    const fechaVencimiento = document.getElementById('presup-fecha-vencimiento').value || null;
    if (!condicionEntrega) return alert('La condición de entrega es obligatoria.');
    if (!fechaEmision || !horaEmision) return alert('La fecha y hora de emisión son obligatorias.');
    if (!fechaVencimiento) return alert('La fecha de vencimiento es obligatoria.');
    const bonificacion = parseFloat(document.getElementById('presup-bonificacion').value) || 0;
    const observaciones = document.getElementById('presup-proveedor-observaciones').value.trim();
    const empleado = document.getElementById('presup-proveedor-empleado').value || usuarioInternoActual.nombre;
    const detalle = esMaquinaria
        ? itemsActivos.map(i => ({ id_maquinaria: i.id_maquinaria, marca: i.marca, nombre: i.nombre, modelo: i.modelo, cantidad: i.cantidad, precio_unitario: i.precioUnitario, subtotal: i.subtotal }))
        : itemsActivos.map(i => ({ clave: i.clave, tipo: i.tipo, marca: i.marca, nombre: i.nombre, cantidad: i.cantidad, precio_unitario: i.precioUnitario, subtotal: i.subtotal }));
    const total = calcularTotalPresupuestoProveedor();
    const datosComunes = {
        proveedorObj: proveedorSeleccionadoPresupuesto, proveedor: proveedorSeleccionadoPresupuesto.nombreMostrado,
        tipo: tipoPresupuestoProveedorActual, empleado, fecha_emision: fechaEmision, hora_emision: horaEmision,
        condicion_entrega: condicionEntrega, fecha_vencimiento: fechaVencimiento, bonificacion,
        observaciones, detalle, total_estimado: total
    };

    if (presupuestoProveedorEnEdicionId) {
        const presupuesto = listaPresupuestosProveedor.find(p => p.id_presupuesto_proveedor === presupuestoProveedorEnEdicionId);
        Object.assign(presupuesto, datosComunes);
        guardarDatos();
        alert(`¡Presupuesto ${formatearIdentificador("PRES-PROV", String(presupuesto.id_presupuesto_proveedor).padStart(4, '0'))} actualizado con éxito!`);
    } else {
        const nuevoPresupuesto = { id_presupuesto_proveedor: numPresupuestoProveedorContador++, estado: 'Pendiente', idOrdenCompraGenerada: null, ...datosComunes };
        listaPresupuestosProveedor.unshift(nuevoPresupuesto);
        guardarDatos();
        alert(`¡Presupuesto ${formatearIdentificador("PRES-PROV", String(nuevoPresupuesto.id_presupuesto_proveedor).padStart(4, '0'))} guardado para "${nuevoPresupuesto.proveedor}"!`);
    }
    volverAPresupuestosProveedor();
}

// Badge chico que distingue un presupuesto de Materia Prima de uno de Maquinaria en el listado.
function badgeTipoPresupuestoProveedor(tipo) {
    return tipo === 'Maquinaria'
        ? `<span class="inline-flex items-center text-xs bg-violet-100 text-violet-800 px-2 py-1 rounded whitespace-nowrap">Maquinaria</span>`
        : `<span class="inline-flex items-center text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded whitespace-nowrap">Materia Prima</span>`;
}

function renderizarTablaPresupuestosProveedor() {
    const tbody = document.getElementById('tabla-presupuestos-proveedor');
    tbody.innerHTML = '';
    renderizarStatsPresupuestosProveedor();

    const terminoNum = normalizarTexto(document.getElementById('buscar-num-presupuesto-proveedor')?.value || '').trim();
    const terminoProveedor = normalizarTexto(document.getElementById('buscar-proveedor-presupuesto-proveedor')?.value || '').trim();
    const terminoEmpleado = normalizarTexto(document.getElementById('buscar-empleado-presupuesto-proveedor')?.value || '').trim();
    const fechaEmisionExacta = document.getElementById('buscar-emision-presupuesto-proveedor')?.value || '';
    const fechaVencimientoExacta = document.getElementById('buscar-vencimiento-presupuesto-proveedor')?.value || '';
    const montoDesde = document.getElementById('buscar-monto-desde-presupuesto-proveedor')?.value || '';
    const montoHasta = document.getElementById('buscar-monto-hasta-presupuesto-proveedor')?.value || '';

    let filtrados = listaPresupuestosProveedor.filter(pr => {
        const proveedor = pr.proveedorObj ? pr.proveedorObj.nombreMostrado : (pr.proveedor || '');
        return (!terminoNum || String(pr.id_presupuesto_proveedor).includes(terminoNum)) &&
            (!terminoProveedor || normalizarTexto(proveedor).includes(terminoProveedor)) &&
            (!terminoEmpleado || normalizarTexto(pr.empleado).includes(terminoEmpleado)) &&
            (!filtroPresupuestoProveedorEstadoSeleccionado || pr.estado === filtroPresupuestoProveedorEstadoSeleccionado) &&
            (!filtroTipoPresupuestoProveedorListado || pr.tipo === filtroTipoPresupuestoProveedorListado) &&
            coincideFechaExacta(fechaEmisionExacta, pr.fecha_emision) &&
            coincideFechaExacta(fechaVencimientoExacta, pr.fecha_vencimiento) &&
            coincideRangoMonto(montoDesde, montoHasta, pr.total_estimado);
    });

    if (ordenPresupuestoProveedorCampo && ordenPresupuestoProveedorDireccion) {
        filtrados.sort((a, b) => {
            const va = (a.proveedorObj ? a.proveedorObj.nombreMostrado : (a.proveedor || '')) || '';
            const vb = (b.proveedorObj ? b.proveedorObj.nombreMostrado : (b.proveedor || '')) || '';
            const cmp = va.localeCompare(vb, 'es');
            return ordenPresupuestoProveedorDireccion === 'asc' ? cmp : -cmp;
        });
    }
    actualizarIconosOrdenPresupuestoProveedor();
    actualizarIconoFiltroEstadoPresupuestoProveedor();

    if (!filtrados.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="px-6 py-10 text-center text-slate-400 text-sm">No se encontraron presupuestos con ese criterio.</td></tr>`;
    }
    filtrados.forEach(pr => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        const fechaEmisionFormateada = pr.fecha_emision ? new Date(pr.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '-';
        const fechaVencimientoFormateada = pr.fecha_vencimiento ? new Date(pr.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-';
        tr.innerHTML = `
            <td class="px-6 py-4 font-semibold text-slate-900">${formatearIdentificador("PRES-PROV", String(pr.id_presupuesto_proveedor).padStart(4, '0'))}</td>
            <td class="px-6 py-4">${badgeTipoPresupuestoProveedor(pr.tipo)}</td>
            <td class="px-6 py-4 text-slate-800">${pr.proveedorObj ? pr.proveedorObj.nombreMostrado : (pr.proveedor || '-')}</td>
            <td class="px-6 py-4 text-slate-500">${pr.empleado || '-'}</td>
            <td class="px-6 py-4 text-slate-500">${fechaEmisionFormateada}</td>
            <td class="px-6 py-4 text-slate-500">${fechaVencimientoFormateada}</td>
            <td class="px-6 py-4 text-right font-medium whitespace-nowrap">$ ${pr.total_estimado.toLocaleString()}</td>
            <td class="px-6 py-4 text-center"><span class="px-2.5 py-1 ${pr.estado === 'Convertido' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} text-xs font-semibold rounded-full whitespace-nowrap">${pr.estado}</span></td>
            <td class="px-6 py-4">
                <div class="flex items-center justify-start gap-1.5">
                    <button onclick="verPresupuestoProveedor(${pr.id_presupuesto_proveedor})" title="Ver presupuesto" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    ${pr.estado === 'Pendiente' ? `<button onclick="editarPresupuestoProveedor(${pr.id_presupuesto_proveedor})" title="Editar presupuesto" class="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function renderizarStatsPresupuestosProveedor() {
    const total = listaPresupuestosProveedor.length;
    const pendientes = listaPresupuestosProveedor.filter(pr => pr.estado === 'Pendiente').length;
    const maquinaria = listaPresupuestosProveedor.filter(pr => pr.tipo === 'Maquinaria').length;
    const materiaPrima = listaPresupuestosProveedor.filter(pr => pr.tipo !== 'Maquinaria').length;
    const set = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };
    set('kpi-pres-prov-total', total);
    set('kpi-pres-prov-pendientes', pendientes);
    set('kpi-pres-prov-materia-prima', materiaPrima);
    set('kpi-pres-prov-maquinaria', maquinaria);
}

function alternarOrdenPresupuestoProveedor(campo) {
    if (ordenPresupuestoProveedorCampo !== campo) { ordenPresupuestoProveedorCampo = campo; ordenPresupuestoProveedorDireccion = 'asc'; }
    else if (ordenPresupuestoProveedorDireccion === 'asc') { ordenPresupuestoProveedorDireccion = 'desc'; }
    else { ordenPresupuestoProveedorCampo = null; ordenPresupuestoProveedorDireccion = null; }
    renderizarTablaPresupuestosProveedor();
}

function actualizarIconosOrdenPresupuestoProveedor() {
    ['proveedor'].forEach(campo => {
        const boton = document.getElementById(`btn-orden-${campo}-presupuesto-proveedor`);
        if (!boton) return;
        const activo = ordenPresupuestoProveedorCampo === campo;
        const icono = activo && ordenPresupuestoProveedorDireccion === 'asc' ? 'arrow-up' : activo && ordenPresupuestoProveedorDireccion === 'desc' ? 'arrow-down' : 'arrow-up-down';
        boton.className = `normal-case transition ${activo ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
        boton.innerHTML = `<i data-lucide="${icono}" class="w-3.5 h-3.5"></i>`;
    });
}

function elegirFiltroEstadoPresupuestoProveedor(valor) {
    filtroPresupuestoProveedorEstadoSeleccionado = valor;
    document.getElementById('pop-estado-presupuesto-proveedor').classList.add('hidden');
    renderizarTablaPresupuestosProveedor();
}

function elegirFiltroTipoPresupuestoProveedorListado(valor) {
    filtroTipoPresupuestoProveedorListado = valor;
    document.getElementById('pop-tipo-presupuesto-proveedor')?.classList.add('hidden');
    renderizarTablaPresupuestosProveedor();
}
function actualizarIconoFiltroEstadoPresupuestoProveedor() {
    const boton = document.getElementById('btn-filtro-estado-presupuesto-proveedor');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroPresupuestoProveedorEstadoSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-estado-presupuesto-proveedor').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroPresupuestoProveedorEstadoSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroPresupuestoProveedorEstadoSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroPresupuestoProveedorEstadoSeleccionado);
    });
}

// Vista impresa del Presupuesto de Proveedor - misma estética que verPresupuesto() de Ventas:
// línea única de datos del proveedor + badge de estado + tabla de materias primas + total.
function verPresupuestoProveedor(id) {
    const pr = listaPresupuestosProveedor.find(p => p.id_presupuesto_proveedor === id);
    if (!pr) return;
    const p = pr.proveedorObj;
    const esMaquinaria = pr.tipo === 'Maquinaria';
    const fechaFormateada = pr.fecha_emision ? new Date(pr.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '-';
    const vencimientoFormateado = pr.fecha_vencimiento ? new Date(pr.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-';

    document.getElementById('presupuesto-proveedor-linea').innerHTML = tarjetaProveedorComprasHTML(p, pr.proveedor, 'Condición de Entrega', pr.condicion_entrega);
    document.getElementById('presupuesto-proveedor-numero').innerText = `${formatearIdentificador("PRES-PROV", String(pr.id_presupuesto_proveedor).padStart(4, '0'))}`;
    document.getElementById('presupuesto-proveedor-fecha-emision').textContent = fechaFormateada;
    document.getElementById('presupuesto-proveedor-hora-emision').textContent = pr.hora_emision || '-';
    document.getElementById('presupuesto-proveedor-vencimiento').textContent = vencimientoFormateado;

    // El detalle cambia según el tipo: Materia Prima (Marca/Nombre/Cantidad/Precio/Subtotal) o Maquinaria (Marca/Maquinaria/Cantidad/Precio/Subtotal).
    document.getElementById('presupuesto-proveedor-detalle-head').innerHTML = `
        <tr>
            <th class="py-2">Marca</th>
            <th class="py-2">${esMaquinaria ? 'Maquinaria' : 'Nombre'}</th>
            <th class="py-2 text-center">Cant.</th>
            <th class="py-2 text-right">Precio</th>
            <th class="py-2 text-right">Subtotal</th>
        </tr>`;
    document.getElementById('presupuesto-proveedor-detalle-body').innerHTML = pr.detalle.map(i => `
        <tr>
            <td class="py-2 text-slate-500">${i.marca}</td>
            <td class="py-2">${i.nombre}${esMaquinaria && i.modelo ? ` (${i.modelo})` : ''}</td>
            <td class="py-2 text-center">${i.cantidad}</td>
            <td class="py-2 text-right">$ ${i.precio_unitario.toLocaleString()}</td>
            <td class="py-2 text-right">$ ${i.subtotal.toLocaleString()}</td>
        </tr>`).join('');

    const subtotal = pr.detalle.reduce((acc, i) => acc + i.subtotal, 0);
    const bonifPct = pr.bonificacion || 0;
    const bonifMonto = subtotal * (bonifPct / 100);
    document.getElementById('presupuesto-proveedor-subtotal-monto').textContent = `$ ${subtotal.toLocaleString()}`;
    document.getElementById('presupuesto-proveedor-bonificacion-linea').textContent = bonifPct ? `Bonificación (${bonifPct}%): -$ ${bonifMonto.toLocaleString()}` : '';
    document.getElementById('presupuesto-proveedor-total-monto').innerText = `$ ${pr.total_estimado.toLocaleString()}`;

    const obs = document.getElementById('presupuesto-proveedor-observaciones');
    if (pr.observaciones) {
        obs.innerHTML = `<b>Observaciones:</b> ${pr.observaciones}`;
        obs.classList.remove('hidden');
    } else {
        obs.classList.add('hidden');
    }

    const wrapGenerar = document.getElementById('presupuesto-proveedor-generar-oc-wrap');
    wrapGenerar.innerHTML = pr.estado === 'Pendiente'
        ? `<button type="button" onclick="editarPresupuestoProveedor(${pr.id_presupuesto_proveedor})" class="bg-slate-100 border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-200 flex items-center space-x-2"><i data-lucide="pencil" class="w-4 h-4"></i><span>Editar</span></button>
           <button type="button" onclick="generarOrdenCompraDesdePresupuesto(${pr.id_presupuesto_proveedor})" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center space-x-2"><i data-lucide="arrow-right-circle" class="w-4 h-4"></i><span>Generar Orden de Compra</span></button>`
        : pr.idOrdenCompraGenerada ? `<p class="text-xs text-slate-500">Convertido en la orden de compra ${formatearIdentificador("OC", pr.idOrdenCompraGenerada)}.</p>` : '';
    lucide.createIcons();
    mostrarSubvistaCompras('presupuesto-proveedor-detalle');
}

// Precarga Registrar Orden de Compra con el proveedor y el detalle de este presupuesto (misma lógica
// que elegirPresupuestoOC, pero disparada desde el botón del detalle en vez de la búsqueda).
function generarOrdenCompraDesdePresupuesto(id) {
    const idx = listaPresupuestosProveedor.findIndex(p => p.id_presupuesto_proveedor === id);
    if (idx === -1) return;

    resetFormularioOC();
    elegirPresupuestoOC(idx);

    mostrarSubvistaCompras('registrar-orden-compra');
    if (window.location.hash !== '#registrar-orden-compra') window.location.hash = 'registrar-orden-compra';
    lucide.createIcons();
}

// ==========================================
// REMITOS DE PROVEEDORES
// Un remito siempre está asociado a una Orden de Compra ya emitida (confirma qué mercadería llegó).
// ==========================================
let itemsRemitoActual = [];
let proveedorSeleccionadoRemito = null;
let ordenCompraSeleccionadaRemito = null;
let ordenRemitosDireccion = null;

function irARemitos() {
    if (window.location.hash !== '#remitos') window.location.hash = 'remitos'; else irASubvistaDesdeHashCompras();
}

function irARegistrarRemito() {
    resetFormularioRemito();
    mostrarSubvistaCompras('registrar-remito');
    if (window.location.hash !== '#registrar-remito') window.location.hash = 'registrar-remito';
}

function volverARemitos() {
    irARemitos();
}

function filtrarProveedoresAutocompletadoRemito() {
    const input = document.getElementById('remito-proveedor-autocompletar');
    const cont = document.getElementById('remito-proveedor-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    document.getElementById('select-remito-proveedor').value = '';
    proveedorSeleccionadoRemito = null;
    document.getElementById('ficha-proveedor-remito').classList.add('hidden');
    document.getElementById('remito-oc-wrap').classList.add('hidden');
    itemsRemitoActual = [];
    renderizarTablaItemsRemito();

    if (!termino) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }

    const filtrados = listaProveedores.filter(p => p.estado_activo && (normalizarTexto(`${p.nombre} ${p.apellido}`).includes(termino) || normalizarTexto(p.razon_social).includes(termino) || normalizarTexto(p.numero_documento).includes(termino)));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(p => {
        const idx = listaProveedores.indexOf(p);
        return `<button type="button" onmousedown="event.preventDefault(); elegirProveedorRemito(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${p.nombreMostrado}</span>
            <span class="block text-[11px] text-slate-400">${p.rubro || '-'} · ${p.documentoCompleto}</span>
        </button>`;
    }).join('');
    cont.classList.remove('hidden');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#remito-proveedor-autocompletar') && !e.target.closest('#remito-proveedor-autocompletar-opciones')) {
        document.getElementById('remito-proveedor-autocompletar-opciones')?.classList.add('hidden');
    }
});

function elegirProveedorRemito(idx) {
    proveedorSeleccionadoRemito = listaProveedores[idx];
    document.getElementById('remito-proveedor-autocompletar').value = proveedorSeleccionadoRemito.nombreMostrado;
    document.getElementById('select-remito-proveedor').value = idx;
    document.getElementById('remito-proveedor-autocompletar-opciones').classList.add('hidden');
    document.getElementById('ficha-proveedor-remito').innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            <p><b class="text-slate-700">Rubro:</b> ${proveedorSeleccionadoRemito.rubro || '-'}</p>
            <p><b class="text-slate-700">Documento:</b> ${proveedorSeleccionadoRemito.documentoCompleto}</p>
        </div>`;
    document.getElementById('ficha-proveedor-remito').classList.remove('hidden');
    poblarOrdenesCompraRemito();
}

// Solo se puede remitir contra una Orden de Compra de ese proveedor que no esté Cancelada.
function poblarOrdenesCompraRemito() {
    const wrap = document.getElementById('remito-oc-wrap');
    const select = document.getElementById('remito-orden-compra');
    const vacio = document.getElementById('remito-oc-vacio');
    const ordenes = listaOrdenesCompra.filter(oc => oc.proveedorObj === proveedorSeleccionadoRemito && oc.estado !== 'Cancelada');

    ordenCompraSeleccionadaRemito = null;
    itemsRemitoActual = [];
    renderizarTablaItemsRemito();
    wrap.classList.remove('hidden');

    if (!ordenes.length) {
        select.innerHTML = '';
        vacio.classList.remove('hidden');
        return;
    }
    vacio.classList.add('hidden');
    select.innerHTML = `<option value="" disabled selected>Elegí una orden de compra</option>` +
        ordenes.map(oc => `<option value="${oc.id}">${formatearIdentificador("OC", String(oc.id).padStart(4, '0'))} - $ ${oc.total.toLocaleString()} (${oc.estado})</option>`).join('');
}

// Precarga el detalle de materias primas desde la Orden de Compra elegida (editable: lo recibido puede diferir de lo pedido).
function cargarOrdenCompraEnRemito() {
    const idOC = parseInt(document.getElementById('remito-orden-compra').value);
    const oc = listaOrdenesCompra.find(o => o.id === idOC);
    if (!oc) { ordenCompraSeleccionadaRemito = null; itemsRemitoActual = []; renderizarTablaItemsRemito(); return; }
    ordenCompraSeleccionadaRemito = oc;
    itemsRemitoActual = oc.detalle.map(i => ({ id: Date.now() + Math.random(), clave: i.clave, tipo: i.tipo, marca: i.marca, nombre: i.nombre, cantidad: i.cantidad }));
    renderizarTablaItemsRemito();
}

function filtrarMateriaPrimaAutocompletadoRemito() {
    const input = document.getElementById('remito-mp-autocompletar');
    const cont = document.getElementById('remito-mp-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    document.getElementById('remito-mp-select').value = '';
    if (!termino) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }

    const filtrados = CATALOGO_MATERIAS_PRIMAS.filter(m => normalizarTexto(m.nombre).includes(termino) || normalizarTexto(nombreTipoMateriaPrima(m.id_tipo_materia_prima)).includes(termino) || normalizarTexto(nombreMarca(m.id_marca)).includes(termino));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(m => {
        const idx = CATALOGO_MATERIAS_PRIMAS.indexOf(m);
        return `<button type="button" onmousedown="event.preventDefault(); elegirMateriaPrimaRemito(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${m.nombre}</span>
            <span class="block text-[11px] text-slate-400">${nombreTipoMateriaPrima(m.id_tipo_materia_prima)} · ${nombreMarca(m.id_marca)}</span>
        </button>`;
    }).join('');
    cont.classList.remove('hidden');
}

function elegirMateriaPrimaRemito(idx) {
    const m = CATALOGO_MATERIAS_PRIMAS[idx];
    document.getElementById('remito-mp-autocompletar').value = m.nombre;
    document.getElementById('remito-mp-select').value = idx;
    document.getElementById('remito-mp-autocompletar-opciones').classList.add('hidden');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#remito-mp-autocompletar') && !e.target.closest('#remito-mp-autocompletar-opciones')) {
        document.getElementById('remito-mp-autocompletar-opciones')?.classList.add('hidden');
    }
});

function agregarMateriaPrimaRemito() {
    const idx = parseInt(document.getElementById('remito-mp-select').value);
    const cantidad = parseFloat(document.getElementById('remito-mp-cant').value);

    if (isNaN(idx)) return alert('Elegí una materia prima de la lista de sugerencias.');
    if (!cantidad || cantidad <= 0) return alert('Ingrese una cantidad válida.');

    const m = CATALOGO_MATERIAS_PRIMAS[idx];
    const itemExistente = itemsRemitoActual.find(item => item.clave === m.clave);
    if (itemExistente) {
        itemExistente.cantidad += cantidad;
    } else {
        itemsRemitoActual.push({ id: Date.now(), clave: m.clave, tipo: nombreTipoMateriaPrima(m.id_tipo_materia_prima), marca: nombreMarca(m.id_marca), nombre: m.nombre, cantidad });
    }
    document.getElementById('remito-mp-autocompletar').value = '';
    document.getElementById('remito-mp-select').value = '';
    document.getElementById('remito-mp-cant').value = 1;
    renderizarTablaItemsRemito();
}

function eliminarItemRemito(id) {
    itemsRemitoActual = itemsRemitoActual.filter(item => item.id !== id);
    renderizarTablaItemsRemito();
}

function actualizarCantidadItemRemito(id, nuevaCantidad) {
    const cantidad = parseFloat(nuevaCantidad);
    const item = itemsRemitoActual.find(i => i.id === id);
    if (!item) return;
    if (!cantidad || cantidad <= 0) { renderizarTablaItemsRemito(); return; }
    item.cantidad = cantidad;
    renderizarTablaItemsRemito();
}

function renderizarTablaItemsRemito() {
    const tbody = document.getElementById('tabla-items-remito');
    tbody.innerHTML = '';
    itemsRemitoActual.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 text-slate-500">${item.tipo}</td>
            <td class="p-3 text-slate-500">${item.marca}</td>
            <td class="p-3 font-medium text-slate-800">${item.nombre}</td>
            <td class="p-3 text-center">
                <input type="number" min="0.01" step="0.01" value="${item.cantidad}" onchange="actualizarCantidadItemRemito(${item.id}, this.value)" class="w-20 text-center border border-slate-300 rounded-md p-1 text-sm outline-none focus:ring-2 focus:ring-red-500">
            </td>
            <td class="p-3 text-center">
                <button type="button" onclick="eliminarItemRemito(${item.id})" class="text-red-500 hover:text-red-700">
                    <i data-lucide="trash-2" class="w-4 h-4 inline"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
    document.getElementById('cant-items-remito').innerText = itemsRemitoActual.length;
}

function resetFormularioRemito() {
    itemsRemitoActual = [];
    proveedorSeleccionadoRemito = null;
    ordenCompraSeleccionadaRemito = null;
    document.getElementById('remito-proveedor-autocompletar').value = '';
    document.getElementById('select-remito-proveedor').value = '';
    document.getElementById('ficha-proveedor-remito').classList.add('hidden');
    document.getElementById('remito-oc-wrap').classList.add('hidden');
    document.getElementById('remito-orden-compra').innerHTML = '';
    const ahora = new Date();
    document.getElementById('remito-fecha-entrega').value = ahora.toISOString().slice(0, 10);
    document.getElementById('remito-hora-entrega').value = ahora.toTimeString().slice(0, 5);
    document.getElementById('remito-firma-recepcion').value = '';
    document.getElementById('remito-observaciones').value = '';
    document.getElementById('remito-mp-autocompletar').value = '';
    document.getElementById('remito-mp-select').value = '';
    document.getElementById('remito-mp-cant').value = 1;
    renderizarTablaItemsRemito();
    lucide.createIcons();
}

function confirmarRemito() {
    const fechaEntrega = document.getElementById('remito-fecha-entrega').value;
    const horaEntrega = document.getElementById('remito-hora-entrega').value;
    const firmaRecepcion = document.getElementById('remito-firma-recepcion').value.trim();
    const observaciones = document.getElementById('remito-observaciones').value.trim();

    if (!proveedorSeleccionadoRemito) return alert('Buscá y seleccioná el proveedor.');
    if (!ordenCompraSeleccionadaRemito) return alert('Elegí la orden de compra que remite.');
    if (!itemsRemitoActual.length) return alert('Agregá al menos una materia prima recibida.');
    if (!fechaEntrega) return alert('Seleccioná la Fecha de Entrega.');
    if (!horaEntrega) return alert('Seleccioná la Hora de Entrega.');
    if (!firmaRecepcion) return alert('Completá la Firma de Recepción.');

    const ahora = new Date();
    const remito = {
        id_remito_proveedor: numRemitoContador++,
        id_proveedor: proveedorSeleccionadoRemito.numero_documento,
        proveedorObj: proveedorSeleccionadoRemito,
        proveedor: proveedorSeleccionadoRemito.nombreMostrado,
        id_orden_compra_proveedor: ordenCompraSeleccionadaRemito.id,
        fecha_emision: ahora.toISOString().slice(0, 10),
        hora_emision: ahora.toTimeString().slice(0, 5),
        fecha_entrega: fechaEntrega,
        hora_entrega: horaEntrega,
        firma_recepcion: firmaRecepcion,
        observaciones,
        detalle: itemsRemitoActual.map(i => ({ clave: i.clave, tipo: i.tipo, marca: i.marca, nombre: i.nombre, cantidad: i.cantidad }))
    };
    listaRemitos.unshift(remito);

    // Confirmar el remito cierra el ciclo: la Orden de Compra pasa a "Recibida" con su fecha/hora de recepción.
    if (ordenCompraSeleccionadaRemito.estado !== 'Cancelada') {
        ordenCompraSeleccionadaRemito.estado = 'Recibida';
        ordenCompraSeleccionadaRemito.fecha_recepcion = fechaEntrega;
        ordenCompraSeleccionadaRemito.hora_recepcion = horaEntrega;
    }

    guardarDatos();
    alert(`¡Remito ${formatearIdentificador("REM", String(remito.id_remito_proveedor).padStart(4, '0'))} registrado con éxito! La Orden de Compra ${formatearIdentificador("OC", ordenCompraSeleccionadaRemito.id)} quedó marcada como Recibida.`);
    volverARemitos();
}

function alternarOrdenRemitos() {
    ordenRemitosDireccion = ordenRemitosDireccion === null ? 'asc' : ordenRemitosDireccion === 'asc' ? 'desc' : null;
    renderizarTablaRemitos();
}

function actualizarIconoOrdenRemitos() {
    const boton = document.getElementById('btn-orden-proveedor-remito');
    if (!boton) return;
    const icono = ordenRemitosDireccion === 'asc' ? 'arrow-up' : ordenRemitosDireccion === 'desc' ? 'arrow-down' : 'arrow-up-down';
    boton.className = `normal-case transition ${ordenRemitosDireccion ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    boton.innerHTML = `<i data-lucide="${icono}" class="w-3.5 h-3.5"></i>`;
    lucide.createIcons();
}

function renderizarTablaRemitos() {
    const tbody = document.getElementById('tabla-remitos');
    if (!tbody) return;
    renderizarStatsRemitos();
    const terminoNum = normalizarTexto(document.getElementById('buscar-num-remito')?.value || '').trim();
    const terminoCompra = normalizarTexto(document.getElementById('buscar-num-compra-remito')?.value || '').trim();
    const terminoProveedor = normalizarTexto(document.getElementById('buscar-proveedor-remito')?.value || '').trim();
    const terminoFirma = normalizarTexto(document.getElementById('buscar-firma-remito')?.value || '').trim();
    const fechaRemito = document.getElementById('buscar-fecha-remito')?.value || '';
    const fechaEntregaRemito = document.getElementById('buscar-entrega-remito')?.value || '';

    let filtrados = listaRemitos.filter(r =>
        (!terminoNum || normalizarTexto(formatearIdentificador('REM', r.id_remito_proveedor)).includes(terminoNum)) &&
        (!terminoCompra || normalizarTexto(formatearIdentificador('OC', r.id_orden_compra_proveedor)).includes(terminoCompra)) &&
        (!terminoProveedor || normalizarTexto(`${r.proveedorObj?.nombreMostrado || r.proveedor}`).includes(terminoProveedor)) &&
        (!terminoFirma || normalizarTexto(r.firma_recepcion).includes(terminoFirma)) &&
        coincideFechaExacta(fechaRemito, r.fecha_emision) && coincideFechaExacta(fechaEntregaRemito, r.fecha_entrega)
    );

    if (ordenRemitosDireccion) {
        filtrados = [...filtrados].sort((a, b) => {
            const cmp = (a.proveedor || '').localeCompare(b.proveedor || '', 'es');
            return ordenRemitosDireccion === 'asc' ? cmp : -cmp;
        });
    }
    actualizarIconoOrdenRemitos();

    tbody.innerHTML = '';
    if (!filtrados.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">No se encontraron remitos con ese criterio.</td></tr>`;
        return;
    }
    filtrados.forEach(r => {
        const fechaEmisionFormateada = r.fecha_emision ? new Date(r.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '-';
        const fechaEntregaFormateada = r.fecha_entrega ? new Date(r.fecha_entrega + 'T00:00:00').toLocaleDateString('es-AR') : '-';
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="px-6 py-3 font-semibold text-slate-900 whitespace-nowrap">${formatearIdentificador("REM", String(r.id_remito_proveedor).padStart(4, '0'))}</td>
            <td class="px-6 py-3 text-slate-500 whitespace-nowrap">${formatearIdentificador("OC", String(r.id_orden_compra_proveedor).padStart(4, '0'))}</td>
            <td class="px-6 py-3 font-semibold text-slate-800">${r.proveedor}</td>
            <td class="px-6 py-3 text-slate-500 whitespace-nowrap">${fechaEmisionFormateada}</td>
            <td class="px-6 py-3 text-slate-500 whitespace-nowrap">${fechaEntregaFormateada}</td>
            <td class="px-6 py-3 text-slate-600">${r.firma_recepcion || '-'}</td>
            <td class="px-6 py-3">
                <button onclick="verDetalleRemito(${r.id_remito_proveedor})" title="Visualizar" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function renderizarStatsRemitos() {
    const total = listaRemitos.length;
    const proveedores = new Set(listaRemitos.map(r => r.proveedorObj?.numero_documento || r.proveedor).filter(Boolean)).size;
    const firmados = listaRemitos.filter(r => (r.firma_recepcion || '').trim()).length;
    const set = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };
    set('kpi-remitos-total', total);
    set('kpi-remitos-proveedores', proveedores);
    set('kpi-remitos-firmados', firmados);
    set('kpi-remitos-sin-firma', total - firmados);
}

function verDetalleRemito(id) {
    const r = listaRemitos.find(x => x.id_remito_proveedor === id);
    if (!r) return;
    const fechaEmisionFormateada = r.fecha_emision ? new Date(r.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '-';
    const fechaEntregaFormateada = r.fecha_entrega ? new Date(r.fecha_entrega + 'T00:00:00').toLocaleDateString('es-AR') : '-';
    const filas = r.detalle.map(d => `
        <tr class="border-b border-slate-100">
            <td class="py-2 text-slate-500">${d.tipo}</td>
            <td class="py-2 text-slate-500">${d.marca}</td>
            <td class="py-2 font-medium text-slate-800">${d.nombre}</td>
            <td class="py-2 text-center">${d.cantidad}</td>
        </tr>`).join('');

    document.getElementById('area-detalle-remito').innerHTML = `
        <div class="flex justify-between items-start border-b border-slate-200 pb-4">
            <div>
                <h1 class="text-2xl font-bold text-red-600">FÁBRICA DE PASTAS</h1>
                <p class="text-xs text-slate-500">Remito de Proveedor</p>
                <p class="text-sm font-bold text-slate-800 mt-2">${formatearIdentificador("REM", String(r.id_remito_proveedor).padStart(4, '0'))}</p>
            </div>
            <div class="text-right text-xs text-slate-500 space-y-0.5">
                <p><b class="text-slate-700">Fecha:</b> ${fechaEmisionFormateada}</p>
                <p><b class="text-slate-700">Fecha entrega:</b> ${fechaEntregaFormateada}</p>
                <p><b class="text-slate-700">Orden de Compra:</b> ${formatearIdentificador("OC", String(r.id_orden_compra_proveedor).padStart(4, '0'))}</p>
            </div>
        </div>
        ${tarjetaProveedorComprasHTML(r.proveedorObj, r.proveedor, 'Firma Recepción', r.firma_recepcion)}
        <div>
            <h3 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Materias Primas Recibidas</h3>
            <table class="w-full text-xs text-left">
                <thead class="border-b border-slate-300 uppercase text-slate-500">
                    <tr><th class="py-2">Tipo</th><th class="py-2">Marca</th><th class="py-2">Producto</th><th class="py-2 text-center">Cantidad</th></tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>
        ${r.observaciones ? `
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <b>Observaciones:</b> ${r.observaciones}
        </div>` : ''}`;
    mostrarSubvistaCompras('detalle-remito');
    lucide.createIcons();
}

function initPaginaCompras() {
    inicializarCombosUbicacion();
    renderizarTablaOrdenesCompra();
    renderizarTablaPresupuestosProveedor();
    renderizarTablaRemitos();
    resetFormularioOC();
    resetFormularioPresupuestoProveedor();
    resetFormularioRemito();
    irASubvistaDesdeHashCompras();
    window.addEventListener('hashchange', irASubvistaDesdeHashCompras);
}
