const { app, BrowserWindow, Menu, dialog, ipcMain, safeStorage, session, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');

const isSquirrelStartup = handleSquirrelEvent();
const appRoot = path.resolve(__dirname, '..');
const rendererRoot = path.join(appRoot, 'dist');
const iconPath = path.join(__dirname, 'assets', 'easycart-admin.ico');
let mainWindow = null;
let localServer = null;
let localOrigin = '';
let serverOrigin = '';

if (isSquirrelStartup) {
    app.quit();
} else {
    startApplication();
}

function startApplication() {
    app.setName('EasyCart Admin');
    app.enableSandbox();

    if (!app.requestSingleInstanceLock()) {
        app.quit();
        return;
    }

    app.on('second-instance', () => {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    });

    app.whenReady().then(async () => {
        serverOrigin = loadConnectionConfig();
        registerSecureTokenBridge();
        configureSessionSecurity();
        localOrigin = await startLocalApplicationServer();
        createApplicationMenu();
        createWindow();
    }).catch((error) => {
        dialog.showErrorBox('EasyCart Admin could not start', error instanceof Error ? error.message : String(error));
        app.quit();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0 && localOrigin) createWindow();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });

    app.on('before-quit', () => {
        localServer?.close();
    });
}

function handleSquirrelEvent() {
    if (process.platform !== 'win32') return false;
    const event = process.argv[1];
    if (!event?.startsWith('--squirrel-')) return false;

    const applicationFolder = path.resolve(process.execPath, '..');
    const updateExe = path.resolve(applicationFolder, '..', 'Update.exe');
    const executableName = path.basename(process.execPath);
    const runUpdate = (args) => {
        try {
            spawn(updateExe, args, { detached: true, stdio: 'ignore' }).unref();
        } catch { /* The installer will surface Update.exe failures. */ }
    };

    if (event === '--squirrel-install' || event === '--squirrel-updated') {
        runUpdate(['--createShortcut', executableName]);
    } else if (event === '--squirrel-uninstall') {
        runUpdate(['--removeShortcut', executableName]);
    }
    return true;
}

function createWindow() {
    const savedBounds = readJson(windowStatePath(), {});
    mainWindow = new BrowserWindow({
        width: Number.isFinite(savedBounds.width) ? Math.max(1024, savedBounds.width) : 1440,
        height: Number.isFinite(savedBounds.height) ? Math.max(700, savedBounds.height) : 920,
        minWidth: 1024,
        minHeight: 700,
        show: false,
        backgroundColor: '#0B1F3A',
        icon: iconPath,
        title: 'EasyCart Admin',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            spellcheck: true,
        },
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (savedBounds.maximized) mainWindow.maximize();
    });

    mainWindow.on('close', () => {
        if (!mainWindow) return;
        const bounds = mainWindow.getNormalBounds();
        writeJson(windowStatePath(), { ...bounds, maximized: mainWindow.isMaximized() });
    });
    mainWindow.on('closed', () => { mainWindow = null; });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        openTrustedExternal(url);
        return { action: 'deny' };
    });
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith(`${localOrigin}/`)) return;
        event.preventDefault();
        openTrustedExternal(url);
    });
    mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
    mainWindow.loadURL(localOrigin);
}

function configureSessionSecurity() {
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
}

function createApplicationMenu() {
    const template = [
        {
            label: 'EasyCart',
            submenu: [
                { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.loadURL(localOrigin) },
                { type: 'separator' },
                { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.reload() },
                { label: 'Force reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow?.webContents.reloadIgnoringCache() },
                { type: 'separator' },
                { role: 'quit' },
            ],
        },
        {
            label: 'Connection',
            submenu: [
                { label: 'Edit server settings…', click: () => void shell.openPath(connectionConfigPath()) },
                { label: 'Open settings folder', click: () => void shell.openPath(app.getPath('userData')) },
                {
                    label: 'Apply settings and restart',
                    click: () => {
                        app.relaunch();
                        app.exit(0);
                    },
                },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }]),
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About EasyCart Admin',
                    click: () => void dialog.showMessageBox({
                        type: 'info',
                        title: 'EasyCart Admin',
                        message: `EasyCart Admin ${app.getVersion()}`,
                        detail: `Connected to ${serverOrigin}\n\nA secure desktop client for the EasyCart administration system.`,
                    }),
                },
            ],
        },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function startLocalApplicationServer() {
    return new Promise((resolve, reject) => {
        localServer = http.createServer((request, response) => {
            void handleLocalRequest(request, response);
        });
        localServer.once('error', reject);
        localServer.listen(0, '127.0.0.1', () => {
            const address = localServer.address();
            if (!address || typeof address === 'string') return reject(new Error('Could not bind the desktop application server.'));
            resolve(`http://127.0.0.1:${address.port}`);
        });
    });
}

async function handleLocalRequest(request, response) {
    try {
        const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
        if (requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/') || requestUrl.pathname.startsWith('/uploads/')) {
            proxyBackendRequest(request, response, requestUrl);
            return;
        }
        serveRendererFile(response, requestUrl.pathname);
    } catch (error) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(error instanceof Error ? error.message : 'Desktop request failed.');
    }
}

function proxyBackendRequest(request, response, requestUrl) {
    const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, `${serverOrigin}/`);
    const transport = target.protocol === 'https:' ? https : http;
    const headers = { ...request.headers, host: target.host };
    delete headers.origin;
    delete headers.referer;

    const proxy = transport.request(target, { method: request.method, headers }, (backendResponse) => {
        const responseHeaders = { ...backendResponse.headers };
        delete responseHeaders['access-control-allow-origin'];
        delete responseHeaders['access-control-allow-credentials'];
        response.writeHead(backendResponse.statusCode || 502, responseHeaders);
        backendResponse.pipe(response);
    });
    proxy.setTimeout(245_000, () => proxy.destroy(new Error('The EasyCart backend timed out.')));
    proxy.on('error', (error) => {
        if (response.headersSent) return response.destroy(error);
        response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({ success: false, message: 'The EasyCart backend is unavailable.' }));
    });
    request.pipe(proxy);
}

function serveRendererFile(response, pathname) {
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(pathname);
    } catch {
        response.writeHead(400).end();
        return;
    }

    const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
    let filePath = path.resolve(rendererRoot, relativePath);
    if (!filePath.startsWith(`${rendererRoot}${path.sep}`) && filePath !== rendererRoot) {
        response.writeHead(403).end();
        return;
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) filePath = path.join(rendererRoot, 'index.html');

    const extension = path.extname(filePath).toLowerCase();
    const types = {
        '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
        '.woff': 'font/woff', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
    };
    const isHashedAsset = filePath.includes(`${path.sep}assets${path.sep}`);
    response.writeHead(200, {
        'Content-Type': types[extension] || 'application/octet-stream',
        'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
    });
    fs.createReadStream(filePath).pipe(response);
}

function loadConnectionConfig() {
    const configPath = connectionConfigPath();
    if (!fs.existsSync(configPath)) {
        writeJson(configPath, {
            serverUrl: process.env.EASYCART_ADMIN_SERVER_URL || 'http://localhost:5188',
            note: 'Use a public HTTPS URL in production. Restart EasyCart Admin after changing this file.',
        });
    }

    const config = readJson(configPath, {});
    const configured = process.env.EASYCART_ADMIN_SERVER_URL || config.serverUrl || 'http://localhost:5188';
    return normalizeServerOrigin(configured);
}

function normalizeServerOrigin(value) {
    const url = new URL(String(value).trim());
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Desktop serverUrl must use HTTPS or HTTP.');
    if (url.username || url.password || url.search || url.hash) throw new Error('Desktop serverUrl cannot contain credentials, a query, or a fragment.');
    url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/api$/i, '') || '/';
    return url.toString().replace(/\/+$/, '');
}

function registerSecureTokenBridge() {
    ipcMain.on('easycart:token:get', (event) => {
        event.returnValue = isTrustedSender(event) ? readSecureToken() : null;
    });
    ipcMain.on('easycart:token:set', (event, token) => {
        if (!isTrustedSender(event) || typeof token !== 'string' || token.length > 16_000) {
            event.returnValue = false;
            return;
        }
        writeSecureToken(token);
        event.returnValue = true;
    });
    ipcMain.on('easycart:token:clear', (event) => {
        if (!isTrustedSender(event)) {
            event.returnValue = false;
            return;
        }
        try { fs.rmSync(tokenPath(), { force: true }); } catch { /* Best-effort logout cleanup. */ }
        event.returnValue = true;
    });
}

function isTrustedSender(event) {
    return Boolean(localOrigin && event.senderFrame?.url.startsWith(`${localOrigin}/`));
}

function readSecureToken() {
    try {
        if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(tokenPath())) return null;
        return safeStorage.decryptString(fs.readFileSync(tokenPath()));
    } catch {
        return null;
    }
}

function writeSecureToken(token) {
    if (!safeStorage.isEncryptionAvailable()) return;
    fs.writeFileSync(tokenPath(), safeStorage.encryptString(token));
}

function openTrustedExternal(value) {
    try {
        const url = new URL(value);
        if (url.protocol === 'https:' || url.protocol === 'mailto:') void shell.openExternal(url.toString());
    } catch { /* Ignore invalid or untrusted navigation. */ }
}

function connectionConfigPath() { return path.join(app.getPath('userData'), 'easycart-admin.config.json'); }
function windowStatePath() { return path.join(app.getPath('userData'), 'window-state.json'); }
function tokenPath() { return path.join(app.getPath('userData'), 'admin-token.bin'); }

function readJson(filePath, fallback) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
