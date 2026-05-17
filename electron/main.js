const path = require('path');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { createDatabaseStore } = require('./database');
const { createCustomersWorkbook, createRoomingWorkbook } = require('./exporter');
const { writeRoomingPdf } = require('./pdf-exporter');

let mainWindow;
let store;

function resolveAppIconPath() {
  return path.join(__dirname, 'assets', 'kabe.png');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: 'Ham Umre Kayıt Sistemi',
    icon: resolveAppIconPath(),
    backgroundColor: '#f4f0e8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function resolveSqlWasmPath() {
  const relativePath = path.join('node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', relativePath);
  }
  return path.join(app.getAppPath(), relativePath);
}

function channel(name, handler) {
  ipcMain.handle(name, async (_event, payload) => {
    try {
      return { ok: true, data: await handler(payload || {}) };
    } catch (error) {
      return {
        ok: false,
        error: error && error.message ? error.message : String(error),
      };
    }
  });
}

function registerIpc() {
  channel('customers:list', () => store.listCustomers());
  channel('customers:create', (payload) => store.createCustomer(payload));
  channel('customers:update', ({ id, payload }) => store.updateCustomer(id, payload));
  channel('customers:delete', ({ id }) => store.deleteCustomer(id));

  channel('hotels:list', () => store.listHotels());
  channel('hotels:create', (payload) => store.createHotel(payload));
  channel('hotels:update', ({ id, payload }) => store.updateHotel(id, payload));
  channel('hotels:delete', ({ id }) => store.deleteHotel(id));

  channel('tours:list', () => store.listTours());
  channel('tours:create', (payload) => store.createTour(payload));
  channel('tours:update', ({ id, payload }) => store.updateTour(id, payload));
  channel('tours:delete', ({ id }) => store.deleteTour(id));

  channel('rooms:list', () => store.listRooms());
  channel('rooms:create', (payload) => store.createRoom(payload));
  channel('rooms:update', ({ id, payload }) => store.updateRoom(id, payload));
  channel('rooms:delete', ({ id }) => store.deleteRoom(id));

  channel('assignments:list', () => store.listAssignments());
  channel('assignments:assign', ({ customerId, roomId }) => store.assignCustomer(customerId, roomId));
  channel('assignments:move', ({ customerId, roomId }) => store.moveCustomer(customerId, roomId));
  channel('assignments:unassign', ({ customerId }) => store.unassignCustomer(customerId));

  channel('exports:excel', async ({ kind }) => {
    const defaultName = kind === 'rooming' ? 'oda-yerlesimi.xlsx' : 'musteriler.xlsx';
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Excel olarak kaydet',
      defaultPath: defaultName,
      filters: [{ name: 'Excel Dosyası', extensions: ['xlsx'] }],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    const workbook =
      kind === 'rooming'
        ? await createRoomingWorkbook(store.listRooms(), store.listAssignments())
        : await createCustomersWorkbook(store.listCustomers());

    await workbook.xlsx.writeFile(result.filePath);
    return { canceled: false, filePath: result.filePath };
  });

  channel('exports:pdf', async ({ kind }) => {
    if (kind !== 'rooming') {
      throw new Error('PDF çıktısı yalnızca oda yerleşimi için hazırlanır.');
    }
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'PDF olarak kaydet',
      defaultPath: 'oda-yerlesimi.pdf',
      filters: [{ name: 'PDF Dosyası', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    await writeRoomingPdf(result.filePath, store.listRooms(), store.listAssignments());
    return { canceled: false, filePath: result.filePath };
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.hamumre.kayitsistemi');
  const dbPath = path.join(app.getPath('userData'), 'hac-umre.sqlite');
  const wasmFilePath = resolveSqlWasmPath();
  store = await createDatabaseStore({ dbPath, wasmFilePath }).init();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (store) {
    store.close();
  }
});
