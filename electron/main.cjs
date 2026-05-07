const { app, BrowserWindow } = require('electron');
const path = require('path');

const getProfileArg = () => {
  const profileArg = process.argv.find((arg) => arg.startsWith('--profile='));
  if (profileArg) {
    return profileArg.split('=')[1];
  }

  const profileIndex = process.argv.findIndex((arg) => arg === '--profile');
  if (profileIndex >= 0) {
    return process.argv[profileIndex + 1];
  }

  return process.env.APP_PROFILE || 'default';
};

const normalizeProfileName = (value) => {
  const normalized = String(value || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'default';
};

const profileName = normalizeProfileName(getProfileArg());
const profileRoot = path.join(app.getPath('appData'), 'EntArtes', `profile-${profileName}`);

app.setPath('userData', path.join(profileRoot, 'user-data'));
app.setPath('sessionData', path.join(profileRoot, 'session-data'));

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    title: `EntArtes - ${profileName}`,
    backgroundColor: '#f4efe7',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: `persist:entartes-${profileName}`,
    },
  });

  const frontendPath = path.join(__dirname, '..', 'dist', 'index.html');
  win.loadFile(frontendPath);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
