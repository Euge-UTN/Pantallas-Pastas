// ==========================================
// MÓDULO DE GESTIÓN DE CLIENTES
// ==========================================
const SUBVISTAS_CLIENTES = ['historial', 'registrar', 'detalle'];
let ordenClientesCampo = null; // 'nombre' | 'apellido' | null
let ordenClientesDireccion = null; // null | 'asc' | 'desc'
let filtroCliTipoDocSeleccionado = '';
let filtroCliTipoSeleccionado = '';
let filtroCliIvaSeleccionado = '';
let filtroCliCtaCteSeleccionado = '';
let clienteEnEdicionIdx = null; // índice en listaClientes del cliente que se está editando, o null en alta

function mostrarSubvistaClientes(subvista) {
    SUBVISTAS_CLIENTES.forEach(v => document.getElementById(`vista-${v}`).classList.add('hidden'));
    const vistaDestino = document.getElementById(`vista-${subvista}`);
    if (vistaDestino) vistaDestino.classList.remove('hidden');
}

// Navegación por hash: sincroniza el submenú del sidebar (#historial / #registrar) con la subvista mostrada.
function irASubvistaDesdeHashClientes() {
    const hash = (window.location.hash || '').replace('#', '') || 'historial';
    if (hash === 'registrar') {
        // Si no hay una edición en curso (clienteEnEdicionIdx ya seteado por editarCliente), arranca en blanco —
        // cubre tanto el botón "Registrar Cliente" como el link del submenú lateral.
        if (clienteEnEdicionIdx === null) {
            resetFormularioCliente();
            document.getElementById('titulo-form-cliente').innerText = 'Registrar Cliente';
            document.getElementById('texto-btn-guardar-cliente').innerText = 'Guardar Cliente';
        }
        mostrarSubvistaClientes('registrar');
    } else {
        aplicarFiltroClientes();
        renderizarStatsClientes();
        mostrarSubvistaClientes('historial');
    }
}

// Botón "Registrar Cliente" del historial: siempre arranca un alta nueva (limpia cualquier edición en curso).
function irARegistrarCliente() {
    clienteEnEdicionIdx = null;
    resetFormularioCliente();
    document.getElementById('titulo-form-cliente').innerText = 'Registrar Cliente';
    document.getElementById('texto-btn-guardar-cliente').innerText = 'Guardar Cliente';
    if (window.location.hash !== '#registrar') window.location.hash = 'registrar'; else irASubvistaDesdeHashClientes();
}

function volverAlHistorialClientes() {
    clienteEnEdicionIdx = null;
    if (window.location.hash !== '#historial') window.location.hash = 'historial'; else irASubvistaDesdeHashClientes();
}

// ==========================================
// VER DETALLE / EDITAR
// ==========================================
function construirFichaCliente(cli) {
    const fila = (etiqueta, valor) => `<div><p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">${etiqueta}</p><p class="text-slate-800">${valor ?? '-'}</p></div>`;
    return `
        <div class="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 class="text-xl font-bold text-slate-900">${cli.nombreMostrado}</h3>
            <span class="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-semibold">${cli.tipo_cliente}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${fila('Nombre', cli.nombre)}
            ${fila('Apellido', cli.apellido)}
            ${fila('Razón Social', cli.razon_social)}
            ${fila('Documento', cli.documentoCompleto)}
            ${fila('Dirección', cli.calleObj ? `${cli.calleObj.nombre} ${cli.altura}` : '-')}
            ${fila('Teléfonos', cli.telefonosCompletos.join(', ') || '-')}
            ${fila('Correo Electrónico', cli.email)}
            ${fila('Condición IVA', cli.condicion_iva)}
            ${fila('Fecha de Alta', cli.fecha_alta)}
            ${fila('Cuenta Corriente', cli.tiene_cuenta_corriente ? 'Sí' : 'No')}
            ${cli.tiene_cuenta_corriente ? fila('Límite de Crédito', `$ ${cli.limite_credito.toLocaleString()}`) : ''}
        </div>`;
}

function verClienteDetalle(idx) {
    const cli = listaClientes[idx];
    if (!cli) return;
    document.getElementById('area-detalle-cliente').innerHTML = construirFichaCliente(cli);
    document.getElementById('btn-editar-desde-detalle-cliente').onclick = () => editarCliente(idx);
    mostrarSubvistaClientes('detalle');
    lucide.createIcons();
}

function editarCliente(idx) {
    const cli = listaClientes[idx];
    if (!cli) return;
    clienteEnEdicionIdx = idx;

    document.getElementById('cli-nombre').value = cli.nombre || '';
    document.getElementById('cli-apellido').value = cli.apellido || '';
    document.getElementById('cli-razon-social').value = cli.razon_social || '';
    document.getElementById('cli-tipo-documento').value = cli.tipo_documento;
    document.getElementById('cli-numero-documento').value = cli.numero_documento || '';
    precargarUbicacionCascada('cli', cli.calleObj);
    document.getElementById('cli-altura').value = cli.altura || '';
    document.getElementById('cli-telefono').value = cli.telefono || '';
    precargarTelefonosAdicionales('cli', cli.telefonos_adicionales);
    document.getElementById('cli-email').value = cli.email || '';
    document.getElementById('cli-iva').value = cli.condicion_iva;
    document.getElementById('cli-tipo').value = cli.tipo_cliente;
    document.getElementById('cli-fecha-alta').value = cli.fecha_alta || '';
    document.getElementById('cli-cuenta-corriente').checked = !!cli.tiene_cuenta_corriente;
    document.getElementById('cli-limite').value = cli.limite_credito || 0;
    actualizarVisibilidadLimiteCliente();

    document.getElementById('titulo-form-cliente').innerText = 'Editar Cliente';
    document.getElementById('texto-btn-guardar-cliente').innerText = 'Guardar Cambios';
    if (window.location.hash !== '#registrar') window.location.hash = 'registrar'; else mostrarSubvistaClientes('registrar');
}

function renderizarTablaClientes(lista) {
    const tbody = document.getElementById('tabla-lista-clientes');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-slate-400">No se encontraron clientes con ese criterio.</td></tr>`;
        return;
    }

    lista.forEach(cli => {
        const idx = listaClientes.indexOf(cli);
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="px-6 py-3 font-semibold text-slate-800">${cli.nombre}</td>
            <td class="px-6 py-3">${cli.apellido || '-'}</td>
            <td class="px-6 py-3 text-slate-500">${cli.razon_social || '-'}</td>
            <td class="px-6 py-3 text-slate-500">${cli.tipo_documento}</td>
            <td class="px-6 py-3 font-mono">${cli.numero_documento}</td>
            <td class="px-6 py-3"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium whitespace-nowrap">${cli.tipo_cliente}</span></td>
            <td class="px-6 py-3 whitespace-nowrap">${cli.condicion_iva}</td>
            <td class="px-6 py-3 whitespace-nowrap">${cli.fecha_alta || '-'}</td>
            <td class="px-6 py-3 text-center">${cli.tiene_cuenta_corriente ? '<span class="text-emerald-600 font-semibold">Sí</span>' : '<span class="text-slate-400">No</span>'}</td>
            <td class="px-6 py-3">${badgeTelefonos(cli)}</td>
            <td class="px-6 py-3 text-slate-600">${cli.email || '-'}</td>
            <td class="px-6 py-3 text-right font-medium text-slate-900 whitespace-nowrap">$ ${cli.limite_credito.toLocaleString()}</td>
            <td class="px-6 py-3">
                <div class="flex items-center gap-1.5">
                    <button type="button" onclick="verClienteDetalle(${idx})" title="Ver detalle" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    <button type="button" onclick="editarCliente(${idx})" title="Editar cliente" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function renderizarStatsClientes() {
    const total = listaClientes.length;
    const mostrador = listaClientes.filter(cli => cli.tipo_cliente === 'Mostrador').length;
    const mayorista = listaClientes.filter(cli => cli.tipo_cliente === 'Mayorista').length;
    const limiteTotal = listaClientes.reduce((acc, cli) => acc + (Number(cli.limite_credito) || 0), 0);
    const sinEmail = listaClientes.filter(cli => !cli.email).length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('kpi-clientes-total', total);
    set('kpi-clientes-mostrador', mostrador);
    set('kpi-clientes-mayorista', mayorista);
    set('kpi-clientes-limite-total', `$ ${limiteTotal.toLocaleString()}`);
    set('kpi-clientes-sin-email', sinEmail);
}

function aplicarFiltroClientes() {
    const terminoNombre = normalizarTexto(document.getElementById('buscar-cli-nombre')?.value || '').trim();
    const terminoApellido = normalizarTexto(document.getElementById('buscar-cli-apellido')?.value || '').trim();
    const terminoDocumento = normalizarTexto(document.getElementById('buscar-cli-documento')?.value || '').trim();

    let filtrados = listaClientes.filter(cli =>
        (!terminoNombre || normalizarTexto(cli.nombre).includes(terminoNombre)) &&
        (!terminoApellido || normalizarTexto(cli.apellido).includes(terminoApellido)) &&
        (!terminoDocumento || normalizarTexto(cli.numero_documento).includes(terminoDocumento)) &&
        (!filtroCliTipoDocSeleccionado || cli.tipo_documento === filtroCliTipoDocSeleccionado) &&
        (!filtroCliTipoSeleccionado || cli.tipo_cliente === filtroCliTipoSeleccionado) &&
        (!filtroCliIvaSeleccionado || cli.condicion_iva === filtroCliIvaSeleccionado) &&
        (!filtroCliCtaCteSeleccionado || (filtroCliCtaCteSeleccionado === 'si' ? cli.tiene_cuenta_corriente : !cli.tiene_cuenta_corriente))
    );

    if (ordenClientesCampo && ordenClientesDireccion) {
        filtrados = [...filtrados].sort((a, b) => {
            const va = a[ordenClientesCampo] || '';
            const vb = b[ordenClientesCampo] || '';
            const cmp = va.localeCompare(vb, 'es');
            return ordenClientesDireccion === 'asc' ? cmp : -cmp;
        });
    }

    actualizarIconosOrdenClientes();
    actualizarIconoFiltroCli('btn-filtro-cli-tipo-doc', 'opcion-filtro-cli-tipo-doc', filtroCliTipoDocSeleccionado);
    actualizarIconoFiltroCli('btn-filtro-cli-tipo', 'opcion-filtro-cli-tipo', filtroCliTipoSeleccionado);
    actualizarIconoFiltroCli('btn-filtro-cli-iva', 'opcion-filtro-cli-iva', filtroCliIvaSeleccionado);
    actualizarIconoFiltroCli('btn-filtro-cli-ctacte', 'opcion-filtro-cli-ctacte', filtroCliCtaCteSeleccionado);
    renderizarTablaClientes(filtrados);
}

function alternarOrdenClientes(campo) {
    if (ordenClientesCampo !== campo) { ordenClientesCampo = campo; ordenClientesDireccion = 'asc'; }
    else if (ordenClientesDireccion === 'asc') { ordenClientesDireccion = 'desc'; }
    else { ordenClientesCampo = null; ordenClientesDireccion = null; }
    aplicarFiltroClientes();
}

function actualizarIconosOrdenClientes() {
    ['nombre', 'apellido'].forEach(campo => {
        const boton = document.getElementById(`btn-orden-${campo}`);
        if (!boton) return;
        const activo = ordenClientesCampo === campo;
        const icono = activo && ordenClientesDireccion === 'asc' ? 'arrow-up' : activo && ordenClientesDireccion === 'desc' ? 'arrow-down' : 'arrow-up-down';
        boton.className = `normal-case transition ${activo ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`;
        boton.innerHTML = `<i data-lucide="${icono}" class="w-3.5 h-3.5"></i>`;
    });
    lucide.createIcons();
}

function actualizarIconoFiltroCli(idBoton, claseOpciones, valorSeleccionado) {
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

function elegirFiltroCliTipoDoc(valor) { filtroCliTipoDocSeleccionado = valor; document.getElementById('pop-cli-tipo-doc').classList.add('hidden'); aplicarFiltroClientes(); }
function elegirFiltroCliTipo(valor) { filtroCliTipoSeleccionado = valor; document.getElementById('pop-cli-tipo').classList.add('hidden'); aplicarFiltroClientes(); }
function elegirFiltroCliIva(valor) { filtroCliIvaSeleccionado = valor; document.getElementById('pop-cli-iva').classList.add('hidden'); aplicarFiltroClientes(); }
function elegirFiltroCliCtaCte(valor) { filtroCliCtaCteSeleccionado = valor; document.getElementById('pop-cli-ctacte').classList.add('hidden'); aplicarFiltroClientes(); }

// Muestra/oculta y marca como obligatorio el Límite de Crédito según si el cliente tiene cuenta corriente habilitada.
function actualizarVisibilidadLimiteCliente() {
    const tieneCtaCte = document.getElementById('cli-cuenta-corriente').checked;
    document.getElementById('wrap-cli-limite').classList.toggle('hidden', !tieneCtaCte);
    if (!tieneCtaCte) document.getElementById('cli-limite').value = 0;
    else if (!parseFloat(document.getElementById('cli-limite').value)) document.getElementById('cli-limite').value = 50000;
}

function guardarNuevoCliente() {
    const nombre = document.getElementById('cli-nombre').value.trim();
    const apellido = document.getElementById('cli-apellido').value.trim();
    const razonSocial = document.getElementById('cli-razon-social').value.trim();
    const tipoDocumento = document.getElementById('cli-tipo-documento').value;
    const numeroDocumento = document.getElementById('cli-numero-documento').value.trim();
    const calleObj = obtenerCalleSeleccionada('cli');
    const provincia = document.getElementById('cli-provincia').value;
    const localidad = document.getElementById('cli-localidad').value;
    const altura = document.getElementById('cli-altura').value.trim();
    const telefono = document.getElementById('cli-telefono').value.trim();
    const telefonosAdicionales = obtenerTelefonosAdicionales('cli');
    const email = document.getElementById('cli-email').value.trim();
    const iva = document.getElementById('cli-iva').value;
    const tipo = document.getElementById('cli-tipo').value;
    const fechaAlta = document.getElementById('cli-fecha-alta').value;
    const cuentaCorriente = document.getElementById('cli-cuenta-corriente').checked;
    const limite = parseFloat(document.getElementById('cli-limite').value) || 0;

    if (!nombre || !apellido || !numeroDocumento) {
        alert('Por favor complete Nombre, Apellido y Número de Documento del cliente.');
        return;
    }
    if (!provincia || !localidad || !calleObj || !altura) {
        alert('Por favor complete Provincia, Localidad, Calle y Altura.');
        return;
    }
    if (!telefono) { alert('Por favor complete el Teléfono.'); return; }
    if (!email) { alert('Por favor complete el Correo Electrónico.'); return; }
    if (!fechaAlta) { alert('Por favor seleccione la Fecha de Alta.'); return; }
    if (cuentaCorriente && limite <= 0) {
        alert('Indicá el Límite de Crédito Permitido para la cuenta corriente.');
        return;
    }

    if (clienteEnEdicionIdx !== null) {
        const cli = listaClientes[clienteEnEdicionIdx];
        Object.assign(cli, { nombre, apellido, razon_social: razonSocial, tipo_documento: tipoDocumento, numero_documento: numeroDocumento, calleObj, altura, telefono, telefonos_adicionales: telefonosAdicionales, email, condicion_iva: iva, tipo_cliente: tipo, fecha_alta: fechaAlta, tiene_cuenta_corriente: cuentaCorriente, limite_credito: limite });
        guardarDatos();
        clienteEnEdicionIdx = null;
        renderizarClientesUI();
        alert(`¡Cliente "${cli.nombreMostrado}" actualizado con éxito!`);
        volverAlHistorialClientes();
        return;
    }

    const nuevoCliente = new Cliente(nombre, apellido, tipoDocumento, numeroDocumento, calleObj, altura, telefono, email, iva, tipo, limite, razonSocial, fechaAlta, cuentaCorriente, telefonosAdicionales);
    listaClientes.unshift(nuevoCliente);
    guardarDatos();

    renderizarClientesUI();
    alert(`¡Cliente "${nuevoCliente.nombreMostrado}" guardado con éxito!`);
    volverAlHistorialClientes();
}

function resetFormularioCliente() {
    document.getElementById('cli-nombre').value = '';
    document.getElementById('cli-apellido').value = '';
    document.getElementById('cli-razon-social').value = '';
    document.getElementById('cli-numero-documento').value = '';
    document.getElementById('cli-altura').value = '';
    document.getElementById('cli-telefono').value = '';
    limpiarCamposTelefono('cli');
    document.getElementById('cli-email').value = '';
    document.getElementById('cli-limite').value = 0;
    document.getElementById('cli-fecha-alta').value = new Date().toISOString().slice(0, 10);
    document.getElementById('cli-cuenta-corriente').checked = false;
    document.getElementById('wrap-cli-limite').classList.add('hidden');
}

function initPaginaClientes() {
    inicializarCombosUbicacion();
    resetFormularioCliente();
    renderizarClientesUI();
    irASubvistaDesdeHashClientes();
    window.addEventListener('hashchange', irASubvistaDesdeHashClientes);
}
