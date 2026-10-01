// ==========================================
// FÁBRICA DE PASTAS — SHELL (login, sidebar y control de acceso)
// Se incluye en todas las páginas del panel interno. Inyecta el login
// y la barra lateral, maneja la sesión (sessionStorage) y bloquea el
// acceso a un módulo si el rol logueado no tiene permiso.
// ==========================================

const USUARIOS_INTERNOS = [
    { usuario: 'admin', password: '1234', rol: 'Administrador', nombre: 'Josefina Silva', inicial: 'J' },
    { usuario: 'vendedor', password: '1234', rol: 'Vendedor', nombre: 'Eugenia Fernández', inicial: 'E' },
    { usuario: 'produccion', password: '1234', rol: 'Encargado de Producción', nombre: 'Carlos Gómez', inicial: 'C' }
];

const CLAVE_SESION = 'fabricaPastasSesion_v1';
let usuarioInternoActual = null;
let onLoginExitoso = null;

const ROLES_POR_MODULO = {
    inicio: ['Administrador', 'Vendedor', 'Encargado de Producción'],
    ventas: ['Administrador', 'Vendedor'],
    cobranzas: ['Administrador', 'Vendedor'],
    compras: ['Administrador'],
    produccion: ['Administrador', 'Encargado de Producción'],
    mantenimiento: ['Administrador', 'Encargado de Producción'],
    clientes: ['Administrador', 'Vendedor'],
    proveedores: ['Administrador'],
    empleados: ['Administrador']
};

const MODULOS = [
    { id: 'inicio', nombre: 'Inicio', icono: 'home', grupo: null },
    { id: 'ventas', nombre: 'Ventas', icono: 'receipt-text', grupo: 'Módulo', submenu: [
        { id: 'dashboard', nombre: 'Dashboard', icono: 'layout-dashboard' },
        { id: 'registrar', nombre: 'Registrar Pedido', icono: 'square-plus' }
    ] },
    { id: 'cobranzas', nombre: 'Cobranzas', icono: 'hand-coins', grupo: 'Módulo' },
    { id: 'compras', nombre: 'Compras', icono: 'shopping-basket', grupo: 'Módulo' },
    { id: 'produccion', nombre: 'Producción', icono: 'chef-hat', grupo: 'Módulo' },
    { id: 'mantenimiento', nombre: 'Mantenimiento', icono: 'wrench', grupo: 'Módulo' },
    { id: 'clientes', nombre: 'Clientes', icono: 'users-round', grupo: 'Gestión' },
    { id: 'proveedores', nombre: 'Proveedores', icono: 'warehouse', grupo: 'Gestión' },
    { id: 'empleados', nombre: 'Empleados', icono: 'id-card', grupo: 'Gestión' }
];

function urlDeModulo(id) { return `${id}.html`; }

function redirigirAModuloInicial(usuario) {
    window.location.href = urlDeModulo('inicio');
}

function plantillaLogin() {
    return `
    <div id="vista-login" class="fixed inset-0 bg-gradient-to-br from-red-700 via-red-800 to-red-900 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 space-y-5">
            <div class="text-center space-y-2">
                <div class="w-14 h-14 bg-red-600 text-white rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-red-200"><i data-lucide="utensils-crossed" class="w-7 h-7"></i></div>
                <h1 class="font-bold text-xl text-slate-900">Fábrica de Pastas</h1>
                <p class="text-xs text-slate-500">Panel interno de gestión</p>
            </div>
            <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Usuario</label>
                <input id="login-interno-usuario" type="text" placeholder="Ingresá tu usuario" class="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500">
            </div>
            <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Contraseña</label>
                <div class="relative">
                    <input id="login-interno-password" type="password" placeholder="••••••" class="w-full border border-slate-300 rounded-lg p-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-red-500">
                    <button type="button" onclick="togglePasswordInterno(this)" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <i data-lucide="eye" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
            <button onclick="validarUsuarioInterno()" class="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold">Ingresar</button>
            <p id="login-interno-error" class="hidden text-xs text-red-600 text-center">Usuario o contraseña incorrectos.</p>
        </div>
    </div>`;
}

function plantillaNav(moduloActivo) {
    let html = '';
    let grupoActual = null;
    MODULOS.forEach(m => {
        if (m.grupo && m.grupo !== grupoActual) {
            grupoActual = m.grupo;
            html += `<p class="sidebar-texto px-4 text-[10px] font-bold uppercase tracking-wider text-red-200/60 mb-1 ${m.grupo === 'Gestión' ? '!mt-5' : '!mt-4'}">${m.grupo}</p>`;
        }
        const activo = m.id === moduloActivo;

        if (m.submenu && m.submenu.length) {
            html += `
            <div data-modulo="${m.id}">
                <button type="button" onclick="toggleSubmenuNav('${m.id}')" title="${m.nombre}" data-abierto="${activo}" class="nav-link nav-group-toggle ${activo ? 'active-tab' : ''} w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors">
                    <span class="flex items-center space-x-3 min-w-0">
                        <span class="nav-icon-badge w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"><i data-lucide="${m.icono}" class="w-4 h-4"></i></span>
                        <span class="sidebar-texto truncate">${m.nombre}</span>
                    </span>
                    <span id="chevron-wrap-${m.id}" class="sidebar-texto shrink-0 ml-2 transition-transform duration-200 ${activo ? 'rotate-180' : ''}">
                        <i data-lucide="chevron-down" class="w-4 h-4"></i>
                    </span>
                </button>
                <div id="submenu-${m.id}" class="sidebar-texto nav-submenu ${activo ? '' : 'hidden'} mt-1 mb-2">
                    ${m.submenu.map(s => `
                        <a href="${urlDeModulo(m.id)}#${s.id}" data-modulo="${m.id}" data-submodulo="${s.id}" class="nav-sublink flex items-center px-3 py-2 text-[13px] rounded-lg transition-colors">${s.nombre}</a>`).join('')}
                </div>
            </div>`;
        } else {
            html += `
            <a href="${urlDeModulo(m.id)}" id="tab-${m.id}" title="${m.nombre}" data-modulo="${m.id}" class="nav-link ${activo ? 'active-tab' : ''} flex items-center space-x-3 px-3 py-2 text-sm rounded-lg transition-colors">
                <span class="nav-icon-badge w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"><i data-lucide="${m.icono}" class="w-4 h-4"></i></span>
                <span class="sidebar-texto truncate">${m.nombre}</span>
            </a>`;
        }
    });
    return html;
}

function toggleSubmenuNav(moduloId) {
    if (sidebarColapsado) { window.location.href = urlDeModulo(moduloId); return; }
    const submenu = document.getElementById(`submenu-${moduloId}`);
    const abierto = submenu.classList.toggle('hidden') === false;
    document.getElementById(`chevron-wrap-${moduloId}`).classList.toggle('rotate-180', abierto);
    const toggle = document.querySelector(`[data-modulo="${moduloId}"] .nav-group-toggle`);
    if (toggle) toggle.dataset.abierto = abierto;
}

let sidebarColapsado = sessionStorage.getItem('fabricaPastasSidebarColapsado') === '1';

function alternarSidebarColapsado() {
    sidebarColapsado = !sidebarColapsado;
    sessionStorage.setItem('fabricaPastasSidebarColapsado', sidebarColapsado ? '1' : '0');
    aplicarEstadoColapsado();
}

function aplicarEstadoColapsado() {
    const aside = document.getElementById('app-sidebar');
    if (!aside) return;
    aside.classList.toggle('sidebar-colapsado', sidebarColapsado);
    const boton = document.getElementById('btn-colapsar-sidebar');
    if (boton) {
        boton.title = sidebarColapsado ? 'Expandir menú' : 'Contraer menú';
        boton.innerHTML = `<i data-lucide="${sidebarColapsado ? 'panel-left-open' : 'panel-left-close'}" class="w-4 h-4"></i>`;
        lucide.createIcons();
    }
}

function plantillaSidebar(moduloActivo) {
    return `
    <aside id="app-sidebar" class="sidebar-shell bg-gradient-to-b from-red-700 to-red-900 flex flex-col justify-between no-print shadow-xl">
        <div class="overflow-y-auto overflow-x-hidden flex-1">
            <div class="sidebar-header p-4 border-b border-white/10 flex items-center justify-between">
                <div class="flex items-center space-x-3 min-w-0">
                    <div class="p-2 bg-white text-red-700 rounded-lg shadow-sm shrink-0">
                        <i data-lucide="utensils-crossed" class="w-4 h-4"></i>
                    </div>
                    <div class="sidebar-texto min-w-0">
                        <h1 class="font-bold text-white leading-tight text-sm truncate">Fábrica de Pastas</h1>
                        <span class="text-xs text-red-200">Gestión Integrada</span>
                    </div>
                </div>
                <button type="button" id="btn-colapsar-sidebar" onclick="alternarSidebarColapsado()" title="Contraer menú" class="shrink-0 p-1.5 rounded-lg text-red-200 hover:bg-white/10 hover:text-white transition">
                    <i data-lucide="panel-left-close" class="w-4 h-4"></i>
                </button>
            </div>
            <nav class="mt-3 px-3 space-y-0.5">${plantillaNav(moduloActivo)}</nav>
            <div class="px-3 mt-3 pb-2">
                <a href="tienda-online.html" target="_blank" title="Ver Tienda Online" class="flex items-center space-x-3 px-3 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/15 text-white border border-dashed border-white/25">
                    <i data-lucide="external-link" class="w-4 h-4 shrink-0"></i>
                    <span class="sidebar-texto truncate">Ver Tienda Online</span>
                </a>
            </div>
        </div>
        <div class="sidebar-footer p-3 border-t border-white/10 flex items-center justify-between bg-black/10 shrink-0">
            <div class="flex items-center space-x-3 min-w-0">
                <div id="footer-avatar" class="w-8 h-8 shrink-0 rounded-full bg-white text-red-700 flex items-center justify-center font-bold text-sm">?</div>
                <div class="sidebar-texto text-xs min-w-0">
                    <p id="footer-nombre" class="font-semibold text-white truncate">-</p>
                    <p id="footer-rol" class="text-red-200 truncate">-</p>
                </div>
            </div>
            <button onclick="cerrarSesionInterna()" title="Cerrar sesión" class="p-2 hover:bg-white/10 rounded-lg text-red-200 hover:text-white shrink-0">
                <i data-lucide="log-out" class="w-4 h-4"></i>
            </button>
        </div>
    </aside>`;
}

function togglePasswordInterno(btnEl) {
    const input = document.getElementById('login-interno-password');
    const mostrar = input.type === 'password';
    input.type = mostrar ? 'text' : 'password';
    btnEl.innerHTML = `<i data-lucide="${mostrar ? 'eye-off' : 'eye'}" class="w-4 h-4"></i>`;
    lucide.createIcons();
}

function validarUsuarioInterno() {
    const usuario = document.getElementById('login-interno-usuario').value.trim().toLowerCase();
    const password = document.getElementById('login-interno-password').value;
    const encontrado = USUARIOS_INTERNOS.find(u => u.usuario === usuario && u.password === password);
    if (!encontrado) { document.getElementById('login-interno-error').classList.remove('hidden'); return; }

    usuarioInternoActual = encontrado;
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify(encontrado));
    document.getElementById('login-interno-error').classList.add('hidden');
    if (window.PAGINA_MODULO) {
        mostrarAppInterno();
    } else {
        redirigirAModuloInicial(encontrado);
    }
}

function cerrarSesionInterna() {
    usuarioInternoActual = null;
    sessionStorage.removeItem(CLAVE_SESION);
    window.location.href = 'index.html';
}

function aplicarVisibilidadNav() {
    document.getElementById('footer-nombre').innerText = usuarioInternoActual.nombre;
    document.getElementById('footer-rol').innerText = usuarioInternoActual.rol;
    document.getElementById('footer-avatar').innerText = usuarioInternoActual.inicial;
    document.querySelectorAll('nav [data-modulo]').forEach(el => {
        if (el.dataset.submodulo) return;
        const roles = ROLES_POR_MODULO[el.dataset.modulo] || [];
        el.classList.toggle('hidden', !roles.includes(usuarioInternoActual.rol));
    });
    actualizarSubnavActivo();
}

function actualizarSubnavActivo() {
    const hashActual = (window.location.hash || '').replace('#', '') || 'dashboard';
    document.querySelectorAll('.nav-sublink').forEach(a => {
        const esActivo = a.dataset.modulo === window.PAGINA_MODULO && a.dataset.submodulo === hashActual;
        a.classList.toggle('active-subtab', esActivo);
    });
}

function mostrarAppInterno() {
    document.getElementById('vista-login').classList.add('hidden');
    document.getElementById('app-interno').classList.remove('hidden');
    document.getElementById('app-interno').classList.add('flex');
    aplicarVisibilidadNav();
    lucide.createIcons();

    const rolesPermitidos = ROLES_POR_MODULO[window.PAGINA_MODULO] || [];
    if (!rolesPermitidos.includes(usuarioInternoActual.rol)) {
        document.getElementById('contenido-modulo').innerHTML = `
            <div class="max-w-md mx-auto text-center py-24 space-y-3">
                <i data-lucide="shield-alert" class="w-10 h-10 text-red-300 mx-auto"></i>
                <h2 class="text-lg font-bold text-slate-800">No tenés permiso para ver este módulo</h2>
                <p class="text-sm text-slate-500">Tu rol (${usuarioInternoActual.rol}) no tiene acceso a esta sección. Elegí otra opción del menú.</p>
            </div>`;
        lucide.createIcons();
        return;
    }
    if (typeof onLoginExitoso === 'function') onLoginExitoso();
}

function initShellLogin() {
    lucide.createIcons();

    const sesionGuardada = sessionStorage.getItem(CLAVE_SESION);
    if (sesionGuardada) {
        try {
            redirigirAModuloInicial(JSON.parse(sesionGuardada));
        } catch (e) {
            sessionStorage.removeItem(CLAVE_SESION);
        }
    }
}

function initShell(moduloActual, callbackAutorizado) {
    window.PAGINA_MODULO = moduloActual;
    onLoginExitoso = callbackAutorizado;

    document.body.insertAdjacentHTML('afterbegin', plantillaLogin());
    const placeholder = document.getElementById('sidebar-placeholder');
    if (placeholder) placeholder.outerHTML = plantillaSidebar(moduloActual);
    aplicarEstadoColapsado();
    lucide.createIcons();
    window.addEventListener('hashchange', actualizarSubnavActivo);

    const sesionGuardada = sessionStorage.getItem(CLAVE_SESION);
    if (sesionGuardada) {
        try {
            usuarioInternoActual = JSON.parse(sesionGuardada);
            mostrarAppInterno();
        } catch (e) {
            sessionStorage.removeItem(CLAVE_SESION);
        }
    }
}
