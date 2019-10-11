whatsapp-desktop
========================
WhatsApp Windows Desktop app with Notification Area Icon

Electron window loads web.whatsapp.com and blinks with tray icon when a new messages arrives.

- Minimize the main window to the tray by closing it or by pressing ESC
- Start minimized using **--tray** argument
- Quit app use tray icon context menu

_* requires [NPM](https://www.w3schools.com/nodejs/nodejs_npm.asp) / [Yarn](/yarnpkg.com) *_

init
------------------------
`npm i`

or

`yarn install`

run
------------------------
`npm start`

or

`yarn start`

or

`yarn tray` (minimized to tray)

build
------------------------
`electron-builder ./`

or

`yarn dist`

arguments
------------------------
- **--tray** - will start electron in the tray