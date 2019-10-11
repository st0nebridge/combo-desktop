const {app, BrowserWindow, Tray, Menu, dialog, remote } = require('electron');
const electronLocalshortcut = require('electron-localshortcut');

const path = require('path');

const iconGreen = path.join(__dirname, 'icon.ico');
const iconTray = path.join(__dirname, 'white.ico');
const iconNotif = path.join(__dirname, 'white_notif.ico');

let win;
let notifyTimer;
let iconIsNotify = false;

let cl_args = process.argv;
let start_min = false;

for(let ix = 1; ix < cl_args.length; ix++)
{
    if (cl_args[ix].toLowerCase() === "--tray")
        start_min = true;
}

function start() {
    win = new BrowserWindow({
        width: 950,
        height: 600,
        icon: iconGreen,
        title: 'WhatsApp',
        visible: true,
        show: !start_min,
        webPreferences: {
            nodeIntegration: true,
            partition: "persist:main",
            webSecurity: false
        },
        autoHideMenuBar: true
    });

    electronLocalshortcut.register(win, 'Esc', () => {
        win.hide();
    });

    win.webContents.on('new-window', function(event, url) {
        event.preventDefault();
        require('electron').shell.openExternal(url)
    });

    win.webContents.setUserAgent(win.webContents.getUserAgent().replace(/(Electron|Chrome)\/([0-9\.]+)\ /g, ""));
    win.loadURL('https://web.whatsapp.com/', {userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36'});

    win.webContents.on('did-finish-load', function () {
        win.webContents.executeJavaScript(`
            window.navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.unregister();
                }
            });
            const titleEl = document.querySelector('.window-title');
            if (titleEl && titleEl.innerHTML.includes('Google Chrome 36+')) {
                window.location.reload();
            }
            
            const onLoad = function()
            {
                var divs = document.querySelectorAll('#side > span > div > div > div > div > span > span');
                for (var i = 0; i < divs.length; i++) {
                    if (divs[i].innerText.toLowerCase().includes('click to update whatsapp'))
                    {
                        divs[i].click(); // update the whatsapp window if available
                        break;
                    }
                }
            };
            
            const hasLoaded = setInterval(function()
            {
                var anchors = document.querySelectorAll('div > a');
                for (var i = 0; i < anchors.length; i++) {
                    // if the download link exists, we can assume whatsapp has loaded
                    if (anchors[i].attributes.href.value.includes('whatsapp.com/download'))
                    {
                        clearInterval(hasLoaded);
                        anchors[i].parentNode.parentNode.parentNode.remove(); // remove download link
                        onLoad();
                    }
                }
            }, 1000);
        `);
    });

    win.on('closed', () => {
        win = null;
    });

    win.on('page-title-updated', function (e, title) {
        if (title !== 'WhatsApp') {
            icon.setImage(iconNotif);
            if (notifyTimer) {
                clearInterval(notifyTimer);
            }
            notifyTimer = setInterval(function () {
                icon.setImage(iconIsNotify ? iconNotif : iconTray);
                iconIsNotify = !iconIsNotify;
            }, 1000)
        } else {
            icon.setImage(iconTray);
            if (notifyTimer) {
                clearInterval(notifyTimer);
            }
        }
    });

    win.on('show', function () {
        icon.setHighlightMode('always');
    });

    win.on('minimize', function (event) {
        event.preventDefault();
        win.minimize();
    });

    win.on('close', function (event) {
        event.preventDefault();
        win.hide();
        return false
    });

    win.on('closed', function () {
        app.quit();
    });

    const menu = Menu.buildFromTemplate([
        {
            label: 'WhatsApp',
            click: function () {
                win.show();
            }
        },
        {
            label: 'Exit',
            click: function () {
                app.exit(0);
            }
        }
    ]);

    const icon = new Tray(iconTray);
    icon.setToolTip('WhatsApp');
    icon.setContextMenu(menu);
    icon.on('double-click', function () {
        win.show();
    });
}

app.on('ready', start);