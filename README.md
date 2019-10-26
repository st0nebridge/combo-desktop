combo-desktop
========================
Combo Desktop app with Notification Area Icon for WhatsApp and Facebook Messenger

Electron window loads web.whatsapp.com/messenger.com and blinks with tray icon when a new messages arrives.

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

`yarn start` (WhatsApp)

`yarn fb-start` (Facebook Messenger)

or

`yarn tray` (minimized to tray - WhatsApp)

`yarn fb-tray` (minimized to tray - Messenger)

build
------------------------
`electron-builder ./`

or

`yarn dist`

arguments
------------------------
- **--tray** - will start electron in the tray
- **--facebook** - will start app for Facebook Messenger instead of default WhatsApp