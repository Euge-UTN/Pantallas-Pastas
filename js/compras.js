// ==========================================
// MÓDULO DE COMPRAS (MULTI-ITEM)
// ==========================================
let itemsCompraActual = [];

function agregarInsumoCompra() {
    const insumoVal = document.getElementById('compra-insumo-select').value;
    const cantidad = parseInt(document.getElementById('compra-insumo-cant').value);

    if (!cantidad || cantidad <= 0) return alert('Ingrese una cantidad válida.');

    const [nombreInsumo, precioStr] = insumoVal.split('|');
    const precioUnitario = parseFloat(precioStr);
    const subtotal = precioUnitario * cantidad;

    itemsCompraActual.push({ id: Date.now(), nombreInsumo, cantidad, precioUnitario, subtotal });
    renderizarTablaCompra();
}

function eliminarItemCompra(id) {
    itemsCompraActual = itemsCompraActual.filter(item => item.id !== id);
    renderizarTablaCompra();
}

function renderizarTablaCompra() {
    const tbody = document.getElementById('tabla-items-compra');
    tbody.innerHTML = '';
    let total = 0;

    itemsCompraActual.forEach(item => {
        total += item.subtotal;
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="p-3 font-medium text-slate-800">${item.nombreInsumo}</td>
            <td class="p-3 text-center">${item.cantidad} u.</td>
            <td class="p-3 text-right">$ ${item.precioUnitario.toLocaleString()}</td>
            <td class="p-3 text-right font-semibold">$ ${item.subtotal.toLocaleString()}</td>
            <td class="p-3 text-center">
                <button type="button" onclick="eliminarItemCompra(${item.id})" class="text-red-500 hover:text-red-700">
                    <i data-lucide="trash-2" class="w-4 h-4 inline"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('compra-cant-items').innerText = itemsCompraActual.length;
    document.getElementById('compra-total-monto').innerText = `$ ${total.toLocaleString()}`;
    lucide.createIcons();
}

function generarOrdenCompra() {
    const proveedor = document.getElementById('compra-proveedor').value;

    if (!proveedor) return alert('Por favor seleccione un proveedor.');
    if (itemsCompraActual.length === 0) return alert('Agregue al menos un insumo a la Orden de Compra.');

    const totalOrden = itemsCompraActual.reduce((acc, i) => acc + i.subtotal, 0);
    const detalleResumido = itemsCompraActual.map(i => `${i.cantidad}x ${i.nombreInsumo.split('(')[0].trim()}`).join(', ');

    listaOrdenesCompra.unshift({
        id: numOrdenCompraContador++, proveedor, detalleResumido, total: totalOrden, estado: 'Enviada'
    });
    guardarDatos();
    renderizarHistorialCompras();

    alert(`¡Orden de Compra emitida exitosamente a ${proveedor}!`);
    itemsCompraActual = [];
    renderizarTablaCompra();
}

function renderizarHistorialCompras() {
    const tbody = document.getElementById('tabla-historial-compras');
    tbody.innerHTML = '';
    listaOrdenesCompra.forEach(oc => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="p-3 font-semibold font-mono">OC-${oc.id}</td>
            <td class="p-3 font-medium text-slate-800">${oc.proveedor}</td>
            <td class="p-3 text-slate-600">${oc.detalleResumido}</td>
            <td class="p-3 text-right font-bold text-slate-900">$ ${oc.total.toLocaleString()}</td>
            <td class="p-3 text-center"><span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-semibold">${oc.estado}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function initPaginaCompras() {
    renderizarProveedoresUI();
    renderizarHistorialCompras();
}
