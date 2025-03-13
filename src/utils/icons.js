// Icon utility functions
const path = require('path');
const fs = require('fs');
const { nativeTheme, nativeImage } = require('electron');
const logger = require('../services/logging.service');

/**
 * Convert RGB to LAB color space for better perceptual processing
 */
function rgbToLab(r, g, b) {
    // Convert to XYZ first
    let rr = r / 255;
    let gg = g / 255;
    let bb = b / 255;

    rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
    gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
    bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;

    const x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) * 100;
    const y = (rr * 0.2126 + gg * 0.7152 + bb * 0.0722) * 100;
    const z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) * 100;

    // Convert XYZ to Lab
    const xn = 95.047;
    const yn = 100.0;
    const zn = 108.883;

    const fx = x / xn > 0.008856 ? Math.pow(x / xn, 1/3) : (7.787 * x / xn) + 16/116;
    const fy = y / yn > 0.008856 ? Math.pow(y / yn, 1/3) : (7.787 * y / yn) + 16/116;
    const fz = z / zn > 0.008856 ? Math.pow(z / zn, 1/3) : (7.787 * z / zn) + 16/116;

    return {
        l: (116 * fy) - 16,
        a: 500 * (fx - fy),
        b: 200 * (fy - fz)
    };
}

/**
 * Convert LAB back to RGB color space
 */
function labToRgb(l, a, b) {
    let y = (l + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;

    const yn = 100.0;
    const xn = 95.047;
    const zn = 108.883;

    x = xn * (x * x * x > 0.008856 ? x * x * x : (x - 16/116) / 7.787);
    y = yn * (y * y * y > 0.008856 ? y * y * y : (y - 16/116) / 7.787);
    z = zn * (z * z * z > 0.008856 ? z * z * z : (z - 16/116) / 7.787);

    // Convert XYZ back to RGB
    x = x / 100;
    y = y / 100;
    z = z / 100;

    let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    let b2 = x * 0.0557 + y * -0.2040 + z * 1.0570;

    r = r > 0.0031308 ? 1.055 * Math.pow(r, 1/2.4) - 0.055 : 12.92 * r;
    g = g > 0.0031308 ? 1.055 * Math.pow(g, 1/2.4) - 0.055 : 12.92 * g;
    b2 = b2 > 0.0031308 ? 1.055 * Math.pow(b2, 1/2.4) - 0.055 : 12.92 * b2;

    return {
        r: Math.max(0, Math.min(255, Math.round(r * 255))),
        g: Math.max(0, Math.min(255, Math.round(g * 255))),
        b: Math.max(0, Math.min(255, Math.round(b2 * 255)))
    };
}

/**
 * Apply bilateral filter to preserve edges while smoothing
 */
function bilateralFilter(labPixels, width, height, x, y, spatialSigma, colorSigma) {
    let weightedL = 0;
    let weightedA = 0;
    let weightedB = 0;
    let totalWeight = 0;
    
    const radius = Math.ceil(spatialSigma * 2);
    const center = labPixels[y * width + x];
    if (!center) return null;

    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const neighbor = labPixels[ny * width + nx];
                if (!neighbor) continue;

                // Spatial weight (Gaussian)
                const spatialDist = (dx * dx + dy * dy) / (2 * spatialSigma * spatialSigma);
                const spatialWeight = Math.exp(-spatialDist);

                // Color weight (LAB distance)
                const colorDist = Math.sqrt(
                    Math.pow(center.l - neighbor.l, 2) +
                    Math.pow(center.a - neighbor.a, 2) +
                    Math.pow(center.b - neighbor.b, 2)
                ) / (2 * colorSigma * colorSigma);
                const colorWeight = Math.exp(-colorDist);

                const weight = spatialWeight * colorWeight;
                weightedL += neighbor.l * weight;
                weightedA += neighbor.a * weight;
                weightedB += neighbor.b * weight;
                totalWeight += weight;
            }
        }
    }

    if (totalWeight === 0) return null;

    return {
        l: weightedL / totalWeight,
        a: weightedA / totalWeight,
        b: weightedB / totalWeight,
        alpha: center.alpha
    };
}

/**
 * Calculate adaptive parameters based on image size
 */
function getAdaptiveParameters(width, height) {
    const size = Math.min(width, height);
    return {
        spatialSigma: Math.max(0.5, Math.min(2.0, size / 32)),
        colorSigma: Math.max(10, Math.min(30, size / 8)),
        contrastFactor: Math.max(0.8, Math.min(1.2, size / 64)),
        saturationScale: Math.max(0.7, Math.min(1.0, size / 48))
    };
}

/**
 * Get weighted average of surrounding pixels
 */
function getSurroundingPixels(buffer, width, height, x, y) {
    const pixels = [];
    const weights = [];
    const radius = 1;
    
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const idx = (ny * width + nx) * 4;
                const weight = 1 / (1 + Math.sqrt(dx * dx + dy * dy)); // Distance-based weight
                
                pixels.push({
                    r: buffer[idx + 2],
                    g: buffer[idx + 1],
                    b: buffer[idx],
                    a: buffer[idx + 3],
                    weight
                });
                weights.push(weight);
            }
        }
    }
    
    return { pixels, weights };
}

/**
 * Invert colors of a native image while preserving transparency and edge quality
 * @param {Electron.NativeImage} image - The image to invert
 * @returns {Electron.NativeImage} The inverted image
 */
function invertImageColors(image) {
    const size = image.getSize();
    const width = size.width;
    const height = size.height;
    const buffer = image.toBitmap();
    const invertedBuffer = Buffer.alloc(buffer.length);
    
    // Get adaptive parameters based on image size
    const params = getAdaptiveParameters(width, height);
    
    // First pass: Convert all pixels to LAB and store
    const labPixels = new Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = buffer[i + 2];
            const g = buffer[i + 1];
            const b = buffer[i];
            const alpha = buffer[i + 3];
            
            if (alpha > 0) {
                const lab = rgbToLab(r, g, b);
                labPixels[y * width + x] = {
                    ...lab,
                    alpha
                };
            }
        }
    }
    
    // Second pass: Apply bilateral filtering and adaptive inversion
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const alpha = buffer[i + 3];
            
            if (alpha > 0) {
                // Apply bilateral filter
                const filtered = bilateralFilter(labPixels, width, height, x, y, 
                    params.spatialSigma, params.colorSigma);
                
                if (!filtered) continue;

                // Adaptive contrast preservation
                const luminanceFactor = filtered.l / 100; // Normalized luminance
                const contrastAdjust = params.contrastFactor * 
                    (1 + 0.2 * Math.sin(Math.PI * luminanceFactor)); // Oscillating adjustment

                // Invert lightness with contrast preservation
                const newL = 100 - (filtered.l * contrastAdjust);

                // Luminance-dependent saturation adjustment
                const saturationFactor = params.saturationScale * 
                    (1 - Math.pow(Math.abs(50 - filtered.l) / 50, 2)); // Parabolic adjustment

                const newA = filtered.a * saturationFactor;
                const newB = filtered.b * saturationFactor;

                // Convert back to RGB
                const rgb = labToRgb(newL, newA, newB);
                
                // Apply the result
                invertedBuffer[i] = rgb.b;
                invertedBuffer[i + 1] = rgb.g;
                invertedBuffer[i + 2] = rgb.r;
                invertedBuffer[i + 3] = alpha;
            } else {
                // Fully transparent pixels remain unchanged
                invertedBuffer[i] = 0;
                invertedBuffer[i + 1] = 0;
                invertedBuffer[i + 2] = 0;
                invertedBuffer[i + 3] = 0;
            }
        }
    }
    
    return nativeImage.createFromBitmap(invertedBuffer, size);
}

/**
 * Get the appropriate icon for the current theme and notification state
 * @param {string} serviceName - The name of the service (e.g., 'whatsapp', 'facebook')
 * @param {boolean} hasNotification - Whether there is a notification
 * @param {boolean} isMinimized - Whether the window is minimized to tray
 * @returns {Object} Object containing icon path and theme info
 */
function getIconPath(serviceName, hasNotification = false, isMinimized = false) {
    if (!serviceName) {
        logger.error('Service name is required for icon lookup');
        return null;
    }

    const isDarkMode = nativeTheme.shouldUseDarkColors;
    const baseDir = path.resolve(__dirname, '..', '..', 'assets', 'icons', serviceName.toLowerCase());

    if (!fs.existsSync(baseDir)) {
        logger.error(`Icon directory not found for service: ${serviceName}`);
        return null;
    }

    logger.info(`Getting icon for service: ${serviceName}`, { 
        hasNotification, 
        isDarkMode,
        isMinimized,
        themeSource: nativeTheme.themeSource,
        baseDir
    });

    // Define icon variants to try in order of preference
    const iconVariants = [];
    const themeFolder = isDarkMode ? 'dark' : 'light';
    
    // Add notification icon if needed
    if (hasNotification) {
        iconVariants.push(
            path.join(baseDir, themeFolder, 'tray_notif.ico'),
            path.join(baseDir, 'tray_notif.ico')
        );
    }

    // Add minimized icon if needed
    if (isMinimized) {
        iconVariants.push(
            path.join(baseDir, themeFolder, 'tray_min.ico'),
            path.join(baseDir, 'tray_min.ico')
        );
    }

    // Add regular tray icons
    iconVariants.push(
        path.join(baseDir, themeFolder, 'tray.ico'),
        path.join(baseDir, themeFolder, 'icon.ico'),
        path.join(baseDir, 'tray.ico'),
        path.join(baseDir, 'icon.ico')
    );

    // Try each variant
    for (const iconPath of iconVariants) {
        if (fs.existsSync(iconPath)) {
            logger.info(`Using icon: ${iconPath}`);
            return {
                image: nativeImage.createFromPath(iconPath),
                isDarkMode,
                hasNotification,
                isMinimized
            };
        }
    }

    // Final fallback to app.ico
    const appIconPath = path.resolve(__dirname, '..', '..', 'assets', 'icons', 'app.ico');
    if (fs.existsSync(appIconPath)) {
        logger.warn(`No service-specific icon found for ${serviceName}, falling back to app.ico`);
        return {
            image: nativeImage.createFromPath(appIconPath),
            isDarkMode,
            hasNotification,
            isMinimized
        };
    }

    logger.error(`No suitable icon found for ${serviceName} and app.ico fallback is missing`);
    return null;
}

/**
 * Get the app icon path for a service
 * @param {string} serviceName - The name of the service
 * @returns {string} Path to the app icon
 */
function getAppIconPath(serviceName) {
    if (!serviceName) {
        return path.resolve(__dirname, '..', '..', 'assets', 'icons', 'app.ico');
    }

    const baseDir = path.resolve(__dirname, '..', '..', 'assets', 'icons', serviceName.toLowerCase());
    const iconPath = path.join(baseDir, 'app.ico');

    return fs.existsSync(iconPath) ? iconPath : path.resolve(__dirname, '..', '..', 'assets', 'icons', 'app.ico');
}

module.exports = {
    getIconPath,
    getAppIconPath
};
