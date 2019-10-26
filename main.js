const {app, BrowserWindow, Tray, Menu, dialog, remote } = require('electron');
const electronLocalshortcut = require('electron-localshortcut');

const path = require('path');

const configs = {
    facebook: {
        title: 'Messenger',
        path: 'https://www.messenger.com/login',
        icon: path.join(path.join(path.join(__dirname, 'icons'), 'facebook'), 'icon.ico'),
        tray: {
            main: path.join(path.join(path.join(__dirname, 'icons'), 'facebook'), 'white.ico'),
            notification: path.join(path.join(path.join(__dirname, 'icons'), 'facebook'), 'white_notif.ico')
        },
        webPreferences: {
            nodeIntegration: false,
            useContentSize: true,
            partition: "persist:main",
            webSecurity: false
        }
    },
    whatsapp: {
        title: 'WhatsApp',
        path: 'https://web.whatsapp.com/',
        icon: path.join(path.join(path.join(__dirname, 'icons'), 'whatsapp'), 'icon.ico'),
        tray: {
            main: path.join(path.join(path.join(__dirname, 'icons'), 'whatsapp'), 'white.ico'),
            notification: path.join(path.join(path.join(__dirname, 'icons'), 'whatsapp'), 'white_notif.ico')
        },
        webPreferences: {
            nodeIntegration: true,
            partition: "persist:main",
            webSecurity: false
        }
    }
};

let win;
let notifyTimer;
let iconIsNotify = false;

let cl_args = process.argv;
let start_min = false;

var service = 'whatsapp';

for(let ix = 1; ix < cl_args.length; ix++)
{
    let key = cl_args[ix].toLowerCase();

    if (key === "--tray")
        start_min = true;

    if (key === "--facebook")
        service = 'facebook';
}

const iconApp = configs[service].icon;
const iconTray = configs[service].tray.main;
const iconNotif = configs[service].tray.notification;

function start() {
    win = new BrowserWindow({
        width: 950,
        height: 600,
        icon: iconApp,
        title: configs[service].title,
        visible: true,
        show: !start_min,
        webPreferences: configs[service].webPreferences,
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
    win.loadURL(configs[service].path, {userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36'});

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
        if (title !== configs[service].title) {
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
            label: configs[service].title,
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
    icon.setToolTip(configs[service].title);
    icon.setContextMenu(menu);
    icon.on('double-click', function () {
        win.show();
    });
}

app.on('ready', start);