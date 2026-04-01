const { app, BrowserWindow } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
    },
  });


  win.loadURL('data:text/html;charset=utf-8,<h1 style="font-family:sans-serif; text-align:center; margin-top:20%;">Olá Desktop!<br>O Electron está a funcionar \uD83D\uDE80</h1>');
}


app.whenReady().then(createWindow);


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});