// ==========================================
// MÓDULO DE COMPRAS
// Presupuestos de Proveedores -> Registrar Orden de Compra -> Órdenes de Compra
// Mismo patrón que Ventas (Presupuesto -> Pedido), aplicado a Proveedores / Materias Primas.
// ==========================================

const SUBVISTAS_COMPRAS = ['ordenes-compra', 'registrar-orden-compra', 'detalle-orden-compra', 'presupuestos-proveedor', 'registrar-presupuesto-proveedor', 'presupuesto-proveedor-detalle'];
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
let destinoModalNuevoProveedor = 'oc'; // 'oc' | 'presupuesto' — a qué autocompletado vuelve tras guardar

function abrirModalNuevoProveedor(destino = 'oc') {
    destinoModalNuevoProveedor = destino;
    ['mprov-razon-social', 'mprov-numero-documento', 'mprov-altura', 'mprov-telefono', 'mprov-email', 'mprov-rubro', 'mprov-tiempo-entrega'].forEach(id => document.getElementById(id).value = '');
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
    if (destinoModalNuevoProveedor === 'presupuesto') {
        elegirProveedorPresupuesto(idx);
    } else {
        elegirProveedorOC(idx);
    }
    cerrarModalNuevoProveedor();
}

function filtrarProveedoresAutocompletadoOC() {
    const input = document.getElementById('oc-proveedor-autocompletar');
    const cont = document.getElementById('oc-proveedor-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    document.getElementById('select-oc-proveedor').value = '';
    proveedorSeleccionadoOC = null;
    document.getElementById('ficha-proveedor-oc').classList.add('hidden');
    document.getElementById('oc-presupuesto-previo-wrap').classList.add('hidden');
    calcularTotalOC();

    if (!termino) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }

    const filtrados = listaProveedores.filter(p => p.estado_activo && (normalizarTexto(`${p.nombre} ${p.apellido}`).includes(termino) || normalizarTexto(p.razon_social).includes(termino) || normalizarTexto(p.numero_documento).includes(termino)));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(p => {
        const idx = listaProveedores.indexOf(p);
        return `<button type="button" onmousedown="event.preventDefault(); elegirProveedorOC(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${p.nombreMostrado}</span>
            <span class="block text-[11px] text-slate-400">${p.rubro || '-'} · ${p.documentoCompleto}</span>
        </button>`;
    }).join('');
    cont.classList.remove('hidden');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#oc-proveedor-autocompletar') && !e.target.closest('#oc-proveedor-autocompletar-opciones')) {
        document.getElementById('oc-proveedor-autocompletar-opciones')?.classList.add('hidden');
    }
});

function elegirProveedorOC(idx) {
    proveedorSeleccionadoOC = listaProveedores[idx];
    document.getElementById('oc-proveedor-autocompletar').value = proveedorSeleccionadoOC.nombreMostrado;
    document.getElementById('select-oc-proveedor').value = idx;
    document.getElementById('oc-proveedor-autocompletar-opciones').classList.add('hidden');
    mostrarFichaProveedorOC();
    poblarPresupuestosPreviosOC();
    calcularTotalOC();
}

function mostrarFichaProveedorOC() {
    const ficha = document.getElementById('ficha-proveedor-oc');
    const p = proveedorSeleccionadoOC;
    if (!p) { ficha.classList.add('hidden'); return; }
    ficha.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            <p><b class="text-slate-700">Rubro:</b> ${p.rubro || '-'}</p>
            <p><b class="text-slate-700">Documento:</b> ${p.documentoCompleto}</p>
            <p><b class="text-slate-700">Condición IVA:</b> ${p.condicion_iva}</p>
            <p><b class="text-slate-700">Dirección:</b> ${p.direccionCompleta}</p>
        </div>`;
    ficha.classList.remove('hidden');
}

// Al elegir proveedor, se puede opcionalmente partir de uno de sus presupuestos Pendientes
// (mismo rol que "Generar Pedido" desde un Presupuesto en Ventas, pero elegido acá adentro).
function poblarPresupuestosPreviosOC() {
    const wrap = document.getElementById('oc-presupuesto-previo-wrap');
    const select = document.getElementById('oc-presupuesto-previo');
    const presupuestosProveedorPendientes = listaPresupuestosProveedor.filter(pr => pr.proveedorObj === proveedorSeleccionadoOC && pr.estado === 'Pendiente');

    if (!presupuestosProveedorPendientes.length) { wrap.classList.add('hidden'); select.innerHTML = ''; return; }

    select.innerHTML = `<option value="">— No usar ningún presupuesto previo —</option>` +
        presupuestosProveedorPendientes.map(pr => `<option value="${pr.id_presupuesto_proveedor}">PRES-PROV-${String(pr.id_presupuesto_proveedor).padStart(5, '0')} — $ ${pr.total_estimado.toLocaleString()}</option>`).join('');
    wrap.classList.remove('hidden');
}

function cargarPresupuestoEnOC() {
    const idPresupuesto = parseInt(document.getElementById('oc-presupuesto-previo').value);
    if (isNaN(idPresupuesto)) { ordenCompraEnConversionId = null; return; }
    const pr = listaPresupuestosProveedor.find(p => p.id_presupuesto_proveedor === idPresupuesto);
    if (!pr) return;

    ordenCompraEnConversionId = pr.id_presupuesto_proveedor;
    itemsOCActual = pr.detalle.map(i => ({ id: Date.now() + Math.random(), clave: i.clave, tipo: i.tipo, marca: i.marca, nombre: i.nombre, cantidad: i.cantidad, precioUnitario: i.precio_unitario, subtotal: i.subtotal }));
    document.getElementById('oc-observaciones').value = pr.observaciones || '';
    renderizarTablaOC();
}

function filtrarMateriaPrimaAutocompletadoOC() {
    const input = document.getElementById('oc-mp-autocompletar');
    const cont = document.getElementById('oc-mp-autocompletar-opciones');
    const termino = normalizarTexto(input.value).trim();

    document.getElementById('oc-mp-select').value = '';

    if (!termino) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }

    const filtrados = CATALOGO_MATERIAS_PRIMAS.filter(m => normalizarTexto(m.nombre).includes(termino) || normalizarTexto(m.tipo).includes(termino) || normalizarTexto(m.marca).includes(termino));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(m => {
        const idx = CATALOGO_MATERIAS_PRIMAS.indexOf(m);
        return `<button type="button" onmousedown="event.preventDefault(); elegirMateriaPrimaOC(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${m.nombre}</span>
            <span class="block text-[11px] text-slate-400">${m.tipo} · ${m.marca}</span>
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
        itemsOCActual.push({ id: Date.now(), clave: m.clave, tipo: m.tipo, marca: m.marca, nombre: m.nombre, cantidad, precioUnitario: m.precio, subtotal: m.precio * cantidad });
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
    document.getElementById('oc-proveedor-autocompletar').value = '';
    document.getElementById('select-oc-proveedor').value = '';
    document.getElementById('ficha-proveedor-oc').classList.add('hidden');
    document.getElementById('oc-presupuesto-previo-wrap').classList.add('hidden');
    document.getElementById('oc-presupuesto-previo').innerHTML = '';
    document.getElementById('oc-condicion-pago').selectedIndex = 0;
    document.getElementById('oc-observaciones').value = '';
    document.getElementById('oc-mp-autocompletar').value = '';
    document.getElementById('oc-mp-select').value = '';
    document.getElementById('oc-mp-cant').value = 1;
    renderizarTablaOC();
    lucide.createIcons();
}

function confirmarOrdenCompra() {
    if (!proveedorSeleccionadoOC) return alert('Buscá y seleccioná el proveedor.');
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

    if (ordenCompraEnConversionId) {
        const presupuesto = listaPresupuestosProveedor.find(p => p.id_presupuesto_proveedor === ordenCompraEnConversionId);
        if (presupuesto) { presupuesto.estado = 'Convertido'; presupuesto.idOrdenCompraGenerada = nuevaOrden.id; }
    }

    guardarDatos();
    alert(`¡Orden de Compra OC-${nuevaOrden.id} emitida a "${proveedorSeleccionadoOC.nombreMostrado}"!`);
    volverAlListadoCompras();
}

// ==========================================
// ÓRDENES DE COMPRA (listado)
// ==========================================
let ordenOCCampo = null;
let ordenOCDireccion = null;
let filtroOCTipoDocSeleccionado = '';
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
    const terminoNombre = normalizarTexto(document.getElementById('buscar-nombre-oc')?.value || '').trim();
    const terminoApellido = normalizarTexto(document.getElementById('buscar-apellido-oc')?.value || '').trim();
    const terminoDocumento = normalizarTexto(document.getElementById('buscar-documento-oc')?.value || '').trim();

    let ordenesFiltradas = listaOrdenesCompra.filter(oc => {
        const nombre = oc.proveedorObj ? oc.proveedorObj.nombre : '';
        const apellido = oc.proveedorObj ? oc.proveedorObj.apellido : '';
        const documento = oc.proveedorObj ? oc.proveedorObj.numero_documento : '';
        const tipoDocumento = oc.proveedorObj ? oc.proveedorObj.tipo_documento : '';
        return (!terminoNum || String(oc.id).includes(terminoNum)) &&
            (!terminoNombre || normalizarTexto(nombre).includes(terminoNombre)) &&
            (!terminoApellido || normalizarTexto(apellido).includes(terminoApellido)) &&
            (!terminoDocumento || normalizarTexto(documento).includes(terminoDocumento)) &&
            (!filtroOCTipoDocSeleccionado || tipoDocumento === filtroOCTipoDocSeleccionado) &&
            (!filtroOCEstadoSeleccionado || oc.estado === filtroOCEstadoSeleccionado);
    });

    if (ordenOCCampo && ordenOCDireccion) {
        ordenesFiltradas.sort((a, b) => {
            const va = (a.proveedorObj ? a.proveedorObj[ordenOCCampo] : '') || '';
            const vb = (b.proveedorObj ? b.proveedorObj[ordenOCCampo] : '') || '';
            const cmp = va.localeCompare(vb, 'es');
            return ordenOCDireccion === 'asc' ? cmp : -cmp;
        });
    }
    actualizarIconosOrdenOC();
    actualizarIconoFiltroTipoDocOC();
    actualizarIconoFiltroEstadoOC();

    if (!ordenesFiltradas.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="px-6 py-10 text-center text-slate-400 text-sm">No se encontraron órdenes de compra con ese criterio.</td></tr>`;
    }
    ordenesFiltradas.forEach(oc => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        const activa = oc.estado === 'Enviada';
        const fechaFormateada = oc.fecha_emision ? new Date(oc.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '-';
        tr.innerHTML = `
            <td class="px-6 py-4 font-semibold text-slate-900">OC-${oc.id}</td>
            <td class="px-6 py-4">${oc.proveedorObj ? oc.proveedorObj.nombre : '-'}</td>
            <td class="px-6 py-4">${oc.proveedorObj ? oc.proveedorObj.apellido : '-'}</td>
            <td class="px-6 py-4 text-slate-500">${oc.proveedorObj ? oc.proveedorObj.tipo_documento : '-'}</td>
            <td class="px-6 py-4 text-slate-500">${oc.proveedorObj ? oc.proveedorObj.numero_documento : '-'}</td>
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
    ['nombre', 'apellido'].forEach(campo => {
        const boton = document.getElementById(`btn-orden-${campo}-oc`);
        if (!boton) return;
        const activo = ordenOCCampo === campo;
        const icono = activo && ordenOCDireccion === 'asc' ? 'arrow-up' : activo && ordenOCDireccion === 'desc' ? 'arrow-down' : 'arrow-up-down';
        boton.className = `normal-case transition ${activo ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
        boton.innerHTML = `<i data-lucide="${icono}" class="w-3.5 h-3.5"></i>`;
    });
}

function elegirFiltroTipoDocOC(valor) {
    filtroOCTipoDocSeleccionado = valor;
    document.getElementById('pop-tipo-doc-oc').classList.add('hidden');
    renderizarTablaOrdenesCompra();
}
function actualizarIconoFiltroTipoDocOC() {
    const boton = document.getElementById('btn-filtro-tipo-doc-oc');
    if (!boton) return;
    boton.className = `normal-case transition ${filtroOCTipoDocSeleccionado ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
    document.querySelectorAll('.opcion-filtro-tipo-doc-oc').forEach(op => {
        op.classList.toggle('bg-red-50', op.dataset.valor === filtroOCTipoDocSeleccionado);
        op.classList.toggle('text-red-700', op.dataset.valor === filtroOCTipoDocSeleccionado);
        op.classList.toggle('font-medium', op.dataset.valor === filtroOCTipoDocSeleccionado);
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
    if (!confirm(`¿Confirma la cancelación de la orden de compra OC-${id}?`)) return;
    const oc = listaOrdenesCompra.find(o => o.id === id);
    if (!oc) return;
    oc.estado = 'Cancelada';
    guardarDatos();
    renderizarTablaOrdenesCompra();
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

    document.getElementById('area-detalle-orden-compra').innerHTML = `
        <div class="flex justify-between items-start border-b border-slate-200 pb-4">
            <div>
                <h1 class="text-2xl font-bold text-red-600">FÁBRICA DE PASTAS</h1>
                <p class="text-xs text-slate-500">Orden de Compra a Proveedor</p>
                <div class="flex items-center gap-2 mt-2">
                    <p class="text-sm font-bold text-slate-800">OC-${oc.id}</p>
                    <span class="px-2.5 py-1 ${COLOR_ESTADO_ORDEN_COMPRA[oc.estado]} text-xs font-semibold rounded-full whitespace-nowrap">${oc.estado}</span>
                </div>
                ${oc.id_presupuesto_proveedor ? `<p class="text-xs text-slate-400 mt-1">Generada desde PRES-PROV-${String(oc.id_presupuesto_proveedor).padStart(5, '0')}</p>` : ''}
            </div>
            <div class="text-right text-xs text-slate-500 space-y-0.5">
                <p><b class="text-slate-700">Fecha de Emisión:</b> ${fechaFormateada} — ${oc.hora_emision || '-'}</p>
                <p><b class="text-slate-700">Condición de Pago:</b> ${oc.condicion_pago}</p>
            </div>
        </div>

        <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1 text-xs">
            <h3 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><i data-lucide="truck" class="w-3.5 h-3.5"></i>Proveedor</h3>
            ${p ? `
            <p><b class="text-slate-700">Nombre:</b> ${p.nombreMostrado}</p>
            <p><b class="text-slate-700">Documento:</b> ${p.documentoCompleto}</p>
            <p><b class="text-slate-700">Domicilio:</b> ${p.direccionCompleta}</p>
            <p><b class="text-slate-700">Teléfono:</b> ${p.telefono || '-'}</p>
            ` : `<p>${oc.proveedor}</p>`}
        </div>

        ${oc.observaciones ? `
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <b>Observaciones:</b> ${oc.observaciones}
        </div>` : ''}

        <div>
            <h3 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Detalle de Materias Primas</h3>
            <table class="w-full text-xs text-left">
                <thead class="border-b border-slate-300 uppercase text-slate-500">
                    <tr><th class="py-2">Tipo</th><th class="py-2">Marca</th><th class="py-2">Producto</th><th class="py-2 text-center">Cant.</th><th class="py-2 text-right">P. Unitario</th><th class="py-2 text-right">Subtotal</th></tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>

        <div class="border-t border-slate-200 pt-4 text-right">
            <p class="text-lg font-bold text-slate-900">Total: $ ${oc.total.toLocaleString()}</p>
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
let presupuestoProveedorEnEdicionId = null;
let ordenPresupuestoProveedorCampo = null;
let ordenPresupuestoProveedorDireccion = null;
let filtroPresupuestoProveedorEstadoSeleccionado = '';

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
            itemsPresupuestoProveedorActual.push({ id: Date.now() + Math.random(), clave: cat.clave, tipo: cat.tipo, marca: cat.marca, nombre: cat.nombre, cantidad, precioUnitario: cat.precio, subtotal: cantidad * cat.precio });
        });
        renderizarTablaItemsPresupuestoProveedor();
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

    const filtrados = CATALOGO_MATERIAS_PRIMAS.filter(m => normalizarTexto(m.nombre).includes(termino) || normalizarTexto(m.tipo).includes(termino) || normalizarTexto(m.marca).includes(termino));
    if (!filtrados.length) {
        cont.innerHTML = `<p class="px-3 py-2 text-xs text-slate-400">Sin resultados.</p>`;
        cont.classList.remove('hidden');
        return;
    }
    cont.innerHTML = filtrados.map(m => {
        const idx = CATALOGO_MATERIAS_PRIMAS.indexOf(m);
        return `<button type="button" onmousedown="event.preventDefault(); elegirMateriaPrimaPresupuesto(${idx})" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100">
            <span class="block truncate">${m.nombre}</span>
            <span class="block text-[11px] text-slate-400">${m.tipo} · ${m.marca}</span>
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
        itemsPresupuestoProveedorActual.push({ id: Date.now(), clave: m.clave, tipo: m.tipo, marca: m.marca, nombre: m.nombre, cantidad, precioUnitario: m.precio, subtotal: m.precio * cantidad });
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
    const total = itemsPresupuestoProveedorActual.reduce((acc, i) => acc + i.subtotal, 0);
    document.getElementById('cant-items-presupuesto-proveedor').innerText = itemsPresupuestoProveedorActual.length;
    document.getElementById('total-presupuesto-proveedor-monto').innerText = `$ ${total.toLocaleString()}`;
    return total;
}

function resetFormularioPresupuestoProveedor() {
    itemsPresupuestoProveedorActual = [];
    proveedorSeleccionadoPresupuesto = null;
    presupuestoProveedorEnEdicionId = null;
    document.getElementById('titulo-form-presupuesto-proveedor').innerText = 'Registrar Presupuesto de Proveedor';
    document.getElementById('btn-guardar-presupuesto-proveedor').innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i><span>Guardar Presupuesto</span>';
    document.getElementById('presup-prov-autocompletar').value = '';
    document.getElementById('select-presup-proveedor').value = '';
    document.getElementById('ficha-proveedor-presupuesto').classList.add('hidden');
    document.getElementById('presup-condicion-entrega').value = '';
    document.getElementById('presup-fecha-vencimiento').value = '';
    document.getElementById('presup-proveedor-observaciones').value = '';
    document.getElementById('presup-mp-autocompletar').value = '';
    document.getElementById('presup-mp-select').value = '';
    document.getElementById('presup-mp-cant').value = 1;
    renderizarTablaItemsPresupuestoProveedor();
    lucide.createIcons();
}

function editarPresupuestoProveedor(id) {
    const presupuesto = listaPresupuestosProveedor.find(p => p.id_presupuesto_proveedor === id);
    if (!presupuesto || presupuesto.estado !== 'Pendiente') return;

    presupuestoProveedorEnEdicionId = id;
    itemsPresupuestoProveedorActual = presupuesto.detalle.map(i => ({ id: Date.now() + Math.random(), clave: i.clave, tipo: i.tipo, marca: i.marca, nombre: i.nombre, cantidad: i.cantidad, precioUnitario: i.precio_unitario, subtotal: i.subtotal }));

    document.getElementById('titulo-form-presupuesto-proveedor').innerText = `Editar Presupuesto PRES-PROV-${String(id).padStart(5, '0')}`;
    document.getElementById('btn-guardar-presupuesto-proveedor').innerHTML = '<i data-lucide="save" class="w-4 h-4"></i><span>Guardar Cambios</span>';

    elegirProveedorPresupuesto(listaProveedores.indexOf(presupuesto.proveedorObj));
    document.getElementById('presup-condicion-entrega').value = presupuesto.condicion_entrega || '';
    document.getElementById('presup-fecha-vencimiento').value = presupuesto.fecha_vencimiento || '';
    document.getElementById('presup-proveedor-observaciones').value = presupuesto.observaciones || '';

    renderizarTablaItemsPresupuestoProveedor();
    mostrarSubvistaCompras('registrar-presupuesto-proveedor');
    if (window.location.hash !== '#registrar-presupuesto') window.location.hash = 'registrar-presupuesto';
    lucide.createIcons();
}

function guardarPresupuestoProveedor() {
    if (!proveedorSeleccionadoPresupuesto) return alert('Buscá y seleccioná el proveedor.');
    if (itemsPresupuestoProveedorActual.length === 0) return alert('Añadí al menos una materia prima al presupuesto.');

    const condicionEntrega = document.getElementById('presup-condicion-entrega').value.trim();
    const fechaVencimiento = document.getElementById('presup-fecha-vencimiento').value || null;
    const observaciones = document.getElementById('presup-proveedor-observaciones').value.trim();
    const detalle = itemsPresupuestoProveedorActual.map(i => ({ clave: i.clave, tipo: i.tipo, marca: i.marca, nombre: i.nombre, cantidad: i.cantidad, precio_unitario: i.precioUnitario, subtotal: i.subtotal }));
    const total = calcularTotalPresupuestoProveedor();

    if (presupuestoProveedorEnEdicionId) {
        const presupuesto = listaPresupuestosProveedor.find(p => p.id_presupuesto_proveedor === presupuestoProveedorEnEdicionId);
        Object.assign(presupuesto, { proveedorObj: proveedorSeleccionadoPresupuesto, proveedor: proveedorSeleccionadoPresupuesto.nombreMostrado, condicion_entrega: condicionEntrega, fecha_vencimiento: fechaVencimiento, observaciones, detalle, total_estimado: total });
        guardarDatos();
        alert(`¡Presupuesto PRES-PROV-${String(presupuesto.id_presupuesto_proveedor).padStart(5, '0')} actualizado con éxito!`);
    } else {
        const ahora = new Date();
        const nuevoPresupuesto = {
            id_presupuesto_proveedor: numPresupuestoProveedorContador++,
            proveedorObj: proveedorSeleccionadoPresupuesto, proveedor: proveedorSeleccionadoPresupuesto.nombreMostrado,
            fecha_emision: ahora.toISOString().slice(0, 10), hora_emision: ahora.toTimeString().slice(0, 5),
            condicion_entrega: condicionEntrega, fecha_vencimiento: fechaVencimiento,
            estado: 'Pendiente', idOrdenCompraGenerada: null, observaciones, detalle, total_estimado: total
        };
        listaPresupuestosProveedor.unshift(nuevoPresupuesto);
        guardarDatos();
        alert(`¡Presupuesto PRES-PROV-${String(nuevoPresupuesto.id_presupuesto_proveedor).padStart(5, '0')} guardado para "${nuevoPresupuesto.proveedor}"!`);
    }
    volverAPresupuestosProveedor();
}

function renderizarTablaPresupuestosProveedor() {
    const tbody = document.getElementById('tabla-presupuestos-proveedor');
    tbody.innerHTML = '';

    const terminoNum = normalizarTexto(document.getElementById('buscar-num-presupuesto-proveedor')?.value || '').trim();
    const terminoNombre = normalizarTexto(document.getElementById('buscar-nombre-presupuesto-proveedor')?.value || '').trim();
    const terminoApellido = normalizarTexto(document.getElementById('buscar-apellido-presupuesto-proveedor')?.value || '').trim();

    let filtrados = listaPresupuestosProveedor.filter(pr => {
        const nombre = pr.proveedorObj ? pr.proveedorObj.nombre : '';
        const apellido = pr.proveedorObj ? pr.proveedorObj.apellido : '';
        return (!terminoNum || String(pr.id_presupuesto_proveedor).includes(terminoNum)) &&
            (!terminoNombre || normalizarTexto(nombre).includes(terminoNombre)) &&
            (!terminoApellido || normalizarTexto(apellido).includes(terminoApellido)) &&
            (!filtroPresupuestoProveedorEstadoSeleccionado || pr.estado === filtroPresupuestoProveedorEstadoSeleccionado);
    });

    if (ordenPresupuestoProveedorCampo && ordenPresupuestoProveedorDireccion) {
        filtrados.sort((a, b) => {
            const va = (a.proveedorObj ? a.proveedorObj[ordenPresupuestoProveedorCampo] : '') || '';
            const vb = (b.proveedorObj ? b.proveedorObj[ordenPresupuestoProveedorCampo] : '') || '';
            const cmp = va.localeCompare(vb, 'es');
            return ordenPresupuestoProveedorDireccion === 'asc' ? cmp : -cmp;
        });
    }
    actualizarIconosOrdenPresupuestoProveedor();
    actualizarIconoFiltroEstadoPresupuestoProveedor();

    if (!filtrados.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-10 text-center text-slate-400 text-sm">No se encontraron presupuestos con ese criterio.</td></tr>`;
    }
    filtrados.forEach(pr => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        const fechaFormateada = pr.fecha_emision ? new Date(pr.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '-';
        tr.innerHTML = `
            <td class="px-6 py-4 font-semibold text-slate-900">PRES-PROV-${String(pr.id_presupuesto_proveedor).padStart(5, '0')}</td>
            <td class="px-6 py-4">${pr.proveedorObj ? pr.proveedorObj.nombre : '-'}</td>
            <td class="px-6 py-4">${pr.proveedorObj ? pr.proveedorObj.apellido : '-'}</td>
            <td class="px-6 py-4 text-slate-500">${fechaFormateada}</td>
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

function alternarOrdenPresupuestoProveedor(campo) {
    if (ordenPresupuestoProveedorCampo !== campo) { ordenPresupuestoProveedorCampo = campo; ordenPresupuestoProveedorDireccion = 'asc'; }
    else if (ordenPresupuestoProveedorDireccion === 'asc') { ordenPresupuestoProveedorDireccion = 'desc'; }
    else { ordenPresupuestoProveedorCampo = null; ordenPresupuestoProveedorDireccion = null; }
    renderizarTablaPresupuestosProveedor();
}

function actualizarIconosOrdenPresupuestoProveedor() {
    ['nombre', 'apellido'].forEach(campo => {
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

// Vista impresa del Presupuesto de Proveedor — misma estética que verPresupuesto() de Ventas:
// línea única de datos del proveedor + badge de estado + tabla de materias primas + total.
function verPresupuestoProveedor(id) {
    const pr = listaPresupuestosProveedor.find(p => p.id_presupuesto_proveedor === id);
    if (!pr) return;
    const p = pr.proveedorObj;
    const fechaFormateada = pr.fecha_emision ? new Date(pr.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '-';
    const vencimientoFormateado = pr.fecha_vencimiento ? new Date(pr.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-';

    document.getElementById('presupuesto-proveedor-linea').innerHTML = p
        ? `Proveedor: ${p.nombreMostrado} · ${p.documentoCompleto} · ${p.direccionCompleta} · ${p.rubro || '-'} · Tel: ${p.telefono || '-'}`
        : `Proveedor: ${pr.proveedor}`;
    document.getElementById('presupuesto-proveedor-numero').innerText = `PRES-PROV-${String(pr.id_presupuesto_proveedor).padStart(5, '0')}`;
    document.getElementById('presupuesto-proveedor-fecha').innerText = `Fecha: ${fechaFormateada} — Vence: ${vencimientoFormateado}`;
    const badge = document.getElementById('presupuesto-proveedor-estado-badge');
    badge.textContent = pr.estado;
    badge.className = `inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${pr.estado === 'Convertido' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`;

    document.getElementById('presupuesto-proveedor-detalle-body').innerHTML = pr.detalle.map(i => `
        <tr>
            <td class="py-2 text-slate-500">${i.tipo}</td>
            <td class="py-2 text-slate-500">${i.marca}</td>
            <td class="py-2">${i.nombre}</td>
            <td class="py-2 text-right">$ ${i.precio_unitario.toLocaleString()}</td>
            <td class="py-2 text-center">${i.cantidad}</td>
            <td class="py-2 text-right">$ ${i.subtotal.toLocaleString()}</td>
        </tr>`).join('');
    document.getElementById('presupuesto-proveedor-total-monto').innerText = `Total Estimado: $ ${pr.total_estimado.toLocaleString()}`;
    document.getElementById('presupuesto-proveedor-condicion-entrega').textContent = pr.condicion_entrega || '-';

    const wrapGenerar = document.getElementById('presupuesto-proveedor-generar-oc-wrap');
    wrapGenerar.innerHTML = pr.estado === 'Pendiente'
        ? `<button type="button" onclick="editarPresupuestoProveedor(${pr.id_presupuesto_proveedor})" class="bg-slate-100 border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-200 flex items-center space-x-2"><i data-lucide="pencil" class="w-4 h-4"></i><span>Editar</span></button>
           <button type="button" onclick="generarOrdenCompraDesdePresupuesto(${pr.id_presupuesto_proveedor})" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center space-x-2"><i data-lucide="arrow-right-circle" class="w-4 h-4"></i><span>Generar Orden de Compra</span></button>`
        : pr.idOrdenCompraGenerada ? `<p class="text-xs text-slate-500">Convertido en la orden de compra OC-${pr.idOrdenCompraGenerada}.</p>` : '';
    lucide.createIcons();
    mostrarSubvistaCompras('presupuesto-proveedor-detalle');
}

// Precarga Registrar Orden de Compra con el proveedor y el detalle de este presupuesto (misma lógica
// que poblarPresupuestosPreviosOC + cargarPresupuestoEnOC, pero disparada desde el botón del detalle).
function generarOrdenCompraDesdePresupuesto(id) {
    const pr = listaPresupuestosProveedor.find(p => p.id_presupuesto_proveedor === id);
    if (!pr || pr.estado !== 'Pendiente') return;

    resetFormularioOC();
    elegirProveedorOC(listaProveedores.indexOf(pr.proveedorObj));
    document.getElementById('oc-presupuesto-previo').value = pr.id_presupuesto_proveedor;
    cargarPresupuestoEnOC();

    mostrarSubvistaCompras('registrar-orden-compra');
    if (window.location.hash !== '#registrar-orden-compra') window.location.hash = 'registrar-orden-compra';
    lucide.createIcons();
}

function initPaginaCompras() {
    inicializarCombosUbicacion();
    renderizarTablaOrdenesCompra();
    renderizarTablaPresupuestosProveedor();
    resetFormularioOC();
    resetFormularioPresupuestoProveedor();
    irASubvistaDesdeHashCompras();
    window.addEventListener('hashchange', irASubvistaDesdeHashCompras);
}
