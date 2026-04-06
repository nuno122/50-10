const { app, BrowserWindow } = require('electron');
const path = require('path'); // <--- FALTA ESTA LINHA!

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Adiciona isto para o nodeIntegration funcionar bem
    },
  });

  // Isto vai buscar o index.html na pasta frontend que está fora da pasta electron
  win.loadFile(path.join(__dirname, '../frontend/index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});