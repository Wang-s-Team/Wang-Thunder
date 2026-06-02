const { BrowserWindow, app, net, protocol, shell } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

const protocolName = "wang-thunder";
const appRoot = path.resolve(__dirname, "..", "..");

protocol.registerSchemesAsPrivileged([
  {
    scheme: protocolName,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
]);

function resolveAssetPath(requestUrl) {
  const url = new URL(requestUrl);
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(appRoot, requestedPath));
  const relativePath = path.relative(appRoot, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return path.join(appRoot, "index.html");
  }

  return filePath;
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: "#05070c",
    title: "Wang Thunder",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }

    return { action: "deny" };
  });

  await mainWindow.loadURL(`${protocolName}://app/index.html`);
}

app.whenReady().then(async () => {
  protocol.handle(protocolName, (request) => {
    const filePath = resolveAssetPath(request.url);
    return net.fetch(pathToFileURL(filePath).toString());
  });

  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
