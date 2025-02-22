// Icon utility functions
const path = require('path');

const getIconPath = (service, file = 'icon', ext = '.ico') => {
    return path.join(__dirname, '..', 'icons', service, `${file}${ext}`);
};

module.exports = { getIconPath };
