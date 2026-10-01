// ==========================================
// MÓDULO DE INICIO — panorama general y accesos rápidos según el rol logueado.
// ==========================================
const COLORES_TARJETA_INICIO = {
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    sky: 'bg-sky-100 text-sky-600',
    blue: 'bg-blue-100 text-blue-600',
    violet: 'bg-violet-100 text-violet-600',
    rose: 'bg-rose-100 text-rose-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    slate: 'bg-slate-100 text-slate-600'
};

// Catálogo completo de accesos rápidos posibles. "porDefecto" se muestra siempre (según el rol);
// el resto solo aparece si el usuario lo agrega desde el modal "Agregar acceso directo".
const CATALOGO_ACCESOS_INICIO = [
    { id: 'ventas-registrar', modulo: 'ventas', nombre: 'Registrar Pedido', descripcion: 'Cargar una nueva orden de pedido.', icono: 'square-plus', color: 'red', href: 'ventas.html#registrar', porDefecto: true },
    { id: 'cobranzas-registrar', modulo: 'cobranzas', nombre: 'Registrar Cobro', descripcion: 'Cobrar una orden de pedido confirmada.', icono: 'hand-coins', color: 'amber', href: 'cobranzas.html', porDefecto: true },
    { id: 'clientes-nuevo', modulo: 'clientes', nombre: 'Nuevo Cliente', descripcion: 'Dar de alta un cliente.', icono: 'user-plus', color: 'sky', href: 'clientes.html', porDefecto: true },
    { id: 'produccion-orden', modulo: 'produccion', nombre: 'Orden de Producción', descripcion: 'Planificar una nueva producción.', icono: 'chef-hat', color: 'blue', href: 'produccion.html', porDefecto: true },
    { id: 'mantenimiento-orden', modulo: 'mantenimiento', nombre: 'Orden de Mantenimiento', descripcion: 'Registrar un mantenimiento.', icono: 'wrench', color: 'violet', href: 'mantenimiento.html', porDefecto: true },
    { id: 'compras-orden', modulo: 'compras', nombre: 'Orden de Compra', descripcion: 'Generar un pedido a proveedores.', icono: 'shopping-basket', color: 'emerald', href: 'compras.html', porDefecto: true },
    { id: 'empleados-nuevo', modulo: 'empleados', nombre: 'Nuevo Empleado', descripcion: 'Registrar personal nuevo.', icono: 'id-card', color: 'rose', href: 'empleados.html', porDefecto: true },
    { id: 'proveedores-nuevo', modulo: 'proveedores', nombre: 'Nuevo Proveedor', descripcion: 'Dar de alta un proveedor.', icono: 'warehouse', color: 'indigo', href: 'proveedores.html', porDefecto: true },

    { id: 'ventas-dashboard', modulo: 'ventas', nombre: 'Dashboard de Ventas', descripcion: 'Ver estadísticas e historial de pedidos.', icono: 'layout-dashboard', color: 'red', href: 'ventas.html#dashboard', porDefecto: false },
    { id: 'clientes-ver', modulo: 'clientes', nombre: 'Ver Clientes', descripcion: 'Listado completo de clientes.', icono: 'users-round', color: 'sky', href: 'clientes.html', porDefecto: false },
    { id: 'proveedores-ver', modulo: 'proveedores', nombre: 'Ver Proveedores', descripcion: 'Listado completo de proveedores.', icono: 'warehouse', color: 'indigo', href: 'proveedores.html', porDefecto: false },
    { id: 'empleados-ver', modulo: 'empleados', nombre: 'Ver Empleados', descripcion: 'Nómina completa del personal.', icono: 'id-card', color: 'rose', href: 'empleados.html', porDefecto: false },
    { id: 'produccion-stock', modulo: 'produccion', nombre: 'Stock de Materia Prima', descripcion: 'Ver existencias disponibles.', icono: 'boxes', color: 'blue', href: 'produccion.html', porDefecto: false },
    { id: 'mantenimiento-maquinaria', modulo: 'mantenimiento', nombre: 'Ver Maquinaria', descripcion: 'Estado de las máquinas de la fábrica.', icono: 'cog', color: 'violet', href: 'mantenimiento.html', porDefecto: false },
    { id: 'compras-ver', modulo: 'compras', nombre: 'Ver Órdenes de Compra', descripcion: 'Historial de compras a proveedores.', icono: 'shopping-basket', color: 'emerald', href: 'compras.html', porDefecto: false },
    { id: 'tienda-online', modulo: null, nombre: 'Ir a la Tienda Online', descripcion: 'Abrir la tienda para clientes.', icono: 'external-link', color: 'slate', href: 'tienda-online.html', target: '_blank', porDefecto: false }
];

const CLAVE_ACCESOS_PERSONALIZADOS = 'fabricaPastasAccesosInicio_v1';

function esAccesoElegible(acceso, rol) {
    return !acceso.modulo || (ROLES_POR_MODULO[acceso.modulo] || []).includes(rol);
}

function obtenerAccesosPersonalizados() {
    try { return JSON.parse(sessionStorage.getItem(CLAVE_ACCESOS_PERSONALIZADOS)) || []; }
    catch (e) { return []; }
}

function guardarAccesosPersonalizados(lista) {
    sessionStorage.setItem(CLAVE_ACCESOS_PERSONALIZADOS, JSON.stringify(lista));
}

function tarjetaStatInicio({ icono, color, valor, label }) {
    return `
    <div class="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-3">
        <div class="p-2.5 rounded-lg shrink-0 ${COLORES_TARJETA_INICIO[color]}"><i data-lucide="${icono}" class="w-5 h-5"></i></div>
        <div class="min-w-0">
            <p class="text-lg font-bold text-slate-900 leading-tight break-words">${valor}</p>
            <p class="text-xs text-slate-500">${label}</p>
        </div>
    </div>`;
}

function renderizarStatsInicio() {
    const rol = usuarioInternoActual.rol;
    const stats = [];

    if ((ROLES_POR_MODULO.ventas || []).includes(rol)) {
        const pedidosFacturables = listaPedidos.filter(p => p.estado !== 'Cancelado');
        stats.push(tarjetaStatInicio({ icono: 'clock', color: 'amber', valor: listaPedidos.filter(p => p.estado === 'Pendiente').length, label: 'Pedidos Pendientes' }));
        stats.push(tarjetaStatInicio({ icono: 'banknote', color: 'red', valor: `$ ${pedidosFacturables.reduce((a, p) => a + p.total, 0).toLocaleString()}`, label: 'Facturado Total' }));
    }
    if ((ROLES_POR_MODULO.cobranzas || []).includes(rol)) {
        stats.push(tarjetaStatInicio({ icono: 'wallet', color: 'emerald', valor: `$ ${totalCajaAcumulado.toLocaleString()}`, label: 'Caja del Día' }));
    }
    if ((ROLES_POR_MODULO.clientes || []).includes(rol)) {
        stats.push(tarjetaStatInicio({ icono: 'users-round', color: 'sky', valor: listaClientes.length, label: 'Clientes Registrados' }));
    }
    if ((ROLES_POR_MODULO.produccion || []).includes(rol)) {
        const activas = listaOrdenesProduccion.filter(o => o.estado === 'Planificada' || o.estado === 'En Proceso').length;
        stats.push(tarjetaStatInicio({ icono: 'chef-hat', color: 'blue', valor: activas, label: 'Órdenes de Producción Activas' }));
    }
    if ((ROLES_POR_MODULO.mantenimiento || []).includes(rol)) {
        stats.push(tarjetaStatInicio({ icono: 'wrench', color: 'violet', valor: listaOrdenesMantenimiento.length, label: 'Órdenes de Mantenimiento' }));
    }
    if ((ROLES_POR_MODULO.empleados || []).includes(rol)) {
        stats.push(tarjetaStatInicio({ icono: 'id-card', color: 'rose', valor: listaEmpleados.length, label: 'Empleados Activos' }));
    }
    if ((ROLES_POR_MODULO.proveedores || []).includes(rol)) {
        stats.push(tarjetaStatInicio({ icono: 'warehouse', color: 'indigo', valor: listaProveedores.length, label: 'Proveedores Registrados' }));
    }

    document.getElementById('grid-stats-inicio').innerHTML = stats.join('') || `<p class="text-sm text-slate-400 col-span-full">No hay estadísticas disponibles para tu rol.</p>`;
}

function tarjetaAccesoInicio(acceso) {
    const esPersonalizado = !acceso.porDefecto;
    return `
    <div class="relative group">
        <a href="${acceso.href}" ${acceso.target ? `target="${acceso.target}"` : ''} class="h-full bg-white border border-slate-200 rounded-xl p-4 flex items-start space-x-3 hover:border-red-300 hover:shadow-sm transition">
            <div class="p-2.5 rounded-lg shrink-0 ${COLORES_TARJETA_INICIO[acceso.color]}"><i data-lucide="${acceso.icono}" class="w-5 h-5"></i></div>
            <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-800">${acceso.nombre}</p>
                <p class="text-xs text-slate-500">${acceso.descripcion}</p>
            </div>
        </a>
        ${esPersonalizado ? `<button type="button" onclick="quitarAccesoPersonalizado(event, '${acceso.id}')" title="Quitar acceso" class="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-white border border-slate-300 text-slate-400 hover:text-red-600 hover:border-red-300 opacity-0 group-hover:opacity-100 transition shadow-sm"><i data-lucide="x" class="w-3 h-3"></i></button>` : ''}
    </div>`;
}

function renderizarAccesosRapidosInicio() {
    const rol = usuarioInternoActual.rol;
    const personalizados = obtenerAccesosPersonalizados();
    const accesos = CATALOGO_ACCESOS_INICIO.filter(a => esAccesoElegible(a, rol) && (a.porDefecto || personalizados.includes(a.id)));

    const tarjetaAgregar = `
        <button type="button" onclick="abrirModalAgregarAcceso()" class="h-full min-h-[76px] bg-white border-2 border-dashed border-slate-300 rounded-xl p-4 flex items-center justify-center space-x-2 text-slate-400 hover:border-red-300 hover:text-red-500 transition">
            <i data-lucide="plus" class="w-5 h-5"></i>
            <span class="text-sm font-semibold">Agregar acceso directo</span>
        </button>`;

    document.getElementById('grid-accesos-inicio').innerHTML = accesos.map(tarjetaAccesoInicio).join('') + tarjetaAgregar;
    lucide.createIcons();
}

function quitarAccesoPersonalizado(event, id) {
    event.preventDefault();
    event.stopPropagation();
    guardarAccesosPersonalizados(obtenerAccesosPersonalizados().filter(x => x !== id));
    renderizarAccesosRapidosInicio();
}

function abrirModalAgregarAcceso() {
    renderizarListaModalAccesos();
    document.getElementById('modal-agregar-acceso').classList.remove('hidden');
}

function cerrarModalAgregarAcceso() {
    document.getElementById('modal-agregar-acceso').classList.add('hidden');
}

function renderizarListaModalAccesos() {
    const rol = usuarioInternoActual.rol;
    const personalizados = obtenerAccesosPersonalizados();
    const disponibles = CATALOGO_ACCESOS_INICIO.filter(a => esAccesoElegible(a, rol) && !a.porDefecto && !personalizados.includes(a.id));

    const cont = document.getElementById('lista-modal-accesos');
    if (!disponibles.length) {
        cont.innerHTML = `<p class="text-sm text-slate-400 text-center py-8">Ya agregaste todas las funcionalidades disponibles para tu rol.</p>`;
        return;
    }
    cont.innerHTML = disponibles.map(a => `
        <div class="flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-lg">
            <div class="flex items-center space-x-3 min-w-0">
                <div class="p-2 rounded-lg shrink-0 ${COLORES_TARJETA_INICIO[a.color]}"><i data-lucide="${a.icono}" class="w-4 h-4"></i></div>
                <div class="min-w-0">
                    <p class="text-sm font-semibold text-slate-800 truncate">${a.nombre}</p>
                    <p class="text-xs text-slate-500 truncate">${a.descripcion}</p>
                </div>
            </div>
            <button type="button" onclick="agregarAccesoPersonalizado('${a.id}')" class="shrink-0 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition">Agregar</button>
        </div>`).join('');
    lucide.createIcons();
}

function agregarAccesoPersonalizado(id) {
    const lista = obtenerAccesosPersonalizados();
    if (!lista.includes(id)) lista.push(id);
    guardarAccesosPersonalizados(lista);
    renderizarAccesosRapidosInicio();
    renderizarListaModalAccesos();
}

function initPaginaInicio() {
    document.getElementById('inicio-saludo').innerText = `¡Hola, ${usuarioInternoActual.nombre.split(' ')[0]}!`;
    renderizarStatsInicio();
    renderizarAccesosRapidosInicio();
    lucide.createIcons();
}
