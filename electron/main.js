const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    title: 'NutriGuide 專業營養菜單系統',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // localStorage works without any extra flags in Electron
    },
    // Show a nice loading experience
    show: false,
    backgroundColor: '#F4EFE8',
  });

  // Hide the default menu bar (cleaner look for non-developers)
  win.setMenuBarVisibility(false);

  // Load the built Vite app
  win.loadFile(path.join(__dirname, '../dist/index.html'));

  // Show window when content is ready (avoids white flash)
  win.once('ready-to-show', () => {
    win.show();
  });

  // Open external links in the default browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
