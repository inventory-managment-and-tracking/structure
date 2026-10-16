/**
 * Web Bluetooth ESC/POS Direct Thermal Printer Utility
 * Supports 58mm Bluetooth thermal printers (including Bluepos, POS-58, MPT, etc.)
 *
 * The QR is drawn by the printer itself (GS ( k), so only the SKU text goes over
 * Bluetooth instead of a ~14KB bitmap. A large bitmap arrives slower than the head
 * prints, which makes the printer stop halfway and resume.
 * SKU and name are still rastered so any script (e.g. Amharic) prints with the
 * same fonts as the cable/system print.
 */

const CSS_DPI = 96;
const PAGE_WIDTH_MM = 58;
const HEAD_WIDTH = 384;
const DOTS_PER_MM = HEAD_WIDTH / PAGE_WIDTH_MM;

const mm = (value) => Math.round(value * DOTS_PER_MM);
const cssPx = (px) => mm((px / CSS_DPI) * 25.4);

// Printer QR module size in dots. 9 keeps a 21-module SKU code near the old raster size.
const QR_MODULE_DOTS = 9;

// Lines fed after the label so the name clears the tear bar above the print head.
const TEAR_FEED_LINES = 3;

const LABEL_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

function wrapText(ctx, text, maxWidth, breakAll) {
  const source = String(text || '');
  if (!source) return [''];

  const pushChars = (value, startLine) => {
    const lines = [];
    let line = startLine || '';
    for (const ch of value) {
      const next = line + ch;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = ch === ' ' ? '' : ch;
      } else {
        line = next;
      }
    }
    return { lines, line };
  };

  if (breakAll) {
    const { lines, line } = pushChars(source, '');
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  const lines = [];
  let line = '';
  for (const word of source.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    if (ctx.measureText(word).width > maxWidth) {
      const broken = pushChars(word, '');
      lines.push(...broken.lines);
      line = broken.line;
    } else {
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function canvasToRaster(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const widthBytes = Math.ceil(width / 8);
  const data = ctx.getImageData(0, 0, width, height).data;

  const xL = widthBytes % 256;
  const xH = Math.floor(widthBytes / 256);
  const yL = height % 256;
  const yH = Math.floor(height / 256);
  const rasterBytes = [0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < widthBytes; x++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const pixelX = x * 8 + bit;
        if (pixelX >= width) continue;
        const idx = (y * width + pixelX) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (gray < 160) byte |= (1 << (7 - bit));
      }
      rasterBytes.push(byte);
    }
  }
  return rasterBytes;
}

function nativeQrCommands(text) {
  const data = new TextEncoder().encode(text);
  const storeLen = data.length + 3;
  return [
    0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,                 // model 2
    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, QR_MODULE_DOTS,             // module size
    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31,                       // error correction M
    0x1D, 0x28, 0x6B, storeLen % 256, Math.floor(storeLen / 256), 0x31, 0x50, 0x30, ...data,
    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30,                       // print stored QR
  ];
}

function textBlockRaster({ sku, name, category }) {
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) throw new Error('Canvas 2D context not available');

  const skuSize = cssPx(13);
  const catSize = cssPx(9);
  const nameSize = cssPx(11);
  const skuLineH = Math.round(skuSize * 1.2);
  const catLineH = Math.round(catSize * 1.2);
  const nameLineH = Math.round(nameSize * 1.2);

  measure.font = `800 ${skuSize}px ${LABEL_FONT}`;
  const skuLines = wrapText(measure, sku, HEAD_WIDTH, true);

  const catText = String(category || '').trim();
  measure.font = `700 ${catSize}px ${LABEL_FONT}`;
  const catLines = catText ? wrapText(measure, catText, HEAD_WIDTH, false).slice(0, 1) : [];

  measure.font = `600 ${nameSize}px ${LABEL_FONT}`;
  const nameLines = wrapText(measure, name, HEAD_WIDTH, false);

  const gapAfterQr = 5;
  const beforeCat = catLines.length ? cssPx(1) : 0;
  const beforeName = cssPx(1);
  const height = gapAfterQr + (skuLines.length * skuLineH) + beforeCat + (catLines.length * catLineH) + beforeName + (nameLines.length * nameLineH);

  const canvas = document.createElement('canvas');
  canvas.width = HEAD_WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, HEAD_WIDTH, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#000000';
  ctx.font = `800 ${skuSize}px ${LABEL_FONT}`;
  let y = gapAfterQr;
  for (const line of skuLines) {
    ctx.fillText(line, HEAD_WIDTH / 2, y);
    y += skuLineH;
  }

  if (catLines.length) {
    y += beforeCat;
    ctx.fillStyle = '#333333';
    ctx.font = `700 ${catSize}px ${LABEL_FONT}`;
    for (const line of catLines) {
      ctx.fillText(line, HEAD_WIDTH / 2, y);
      y += catLineH;
    }
  }

  y += beforeName;
  ctx.fillStyle = '#000000';
  ctx.font = `600 ${nameSize}px ${LABEL_FONT}`;
  for (const line of nameLines) {
    ctx.fillText(line, HEAD_WIDTH / 2, y);
    y += nameLineH;
  }

  return canvasToRaster(canvas);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load QR image'));
    img.src = src;
  });
}

/**
 * Renders a 50mm x 25mm label in side-by-side layout:
 * Left: 20x20mm QR Code
 * Right: SKU (top, pushed up ~1mm) -> Category (middle) -> Product Name (under category)
 */
async function sideBySideLabelRaster({ sku, name, category, qrImage }) {
  const CANVAS_W = 384;
  const CANVAS_H = 196; // ~24.5mm at 8 dots/mm, fits inside 25mm sticker

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Left: 152x152 dots (~19mm x 19mm)
  // Shifted to y=16 to center vertically on the pre-cut sticker
  const qrSize = 152;
  const qrX = 10;
  const qrY = 16;

  if (qrImage) {
    try {
      const qrImg = await loadImage(qrImage);
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch (e) {
      console.warn('Could not load QR image on canvas:', e);
    }
  }

  // Right: SKU, Category & Product Name
  const textX = 168;
  const maxTextW = CANVAS_W - textX - 6; // ~210 dots wide

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // 1. Auto-fit SKU on a single line so it NEVER wraps
  let skuSize = 18;
  ctx.font = `900 ${skuSize}px ${LABEL_FONT}`;
  while (skuSize > 12 && ctx.measureText(sku).width > maxTextW) {
    skuSize -= 1;
    ctx.font = `900 ${skuSize}px ${LABEL_FONT}`;
  }
  const skuLineH = skuSize + 3;
  const skuLines = [sku]; // Single line guaranteed

  // 2. Category (middle, single line)
  const catText = String(category || '').trim();
  let catLines = [];
  const catSize = 13;
  const catLineH = catSize + 3;
  if (catText) {
    ctx.font = `700 ${catSize}px ${LABEL_FONT}`;
    catLines = wrapText(ctx, catText, maxTextW, false).slice(0, 1);
  }

  // 3. Product Name (placed under the category)
  let nameSize = Math.min(skuSize, 17);
  ctx.font = `800 ${nameSize}px ${LABEL_FONT}`;
  let nameLines = wrapText(ctx, name, maxTextW, false);
  if (nameLines.length > 2 && nameSize > 14) {
    nameSize = 14;
    ctx.font = `800 ${nameSize}px ${LABEL_FONT}`;
    nameLines = wrapText(ctx, name, maxTextW, false);
  }
  const nameLineH = nameSize + 3;

  const catBlockH = catLines.length > 0 ? (4 + catLineH) : 0;
  const textBlockH = (skuLines.length * skuLineH) + catBlockH + 4 + (nameLines.length * nameLineH);

  // Vertically align the text block evenly with the QR code
  let textY = qrY + Math.max(0, Math.round((qrSize - textBlockH) / 2));

  // Draw SKU
  ctx.fillStyle = '#000000';
  ctx.font = `900 ${skuSize}px ${LABEL_FONT}`;
  for (const line of skuLines) {
    ctx.fillText(line, textX, textY);
    textY += skuLineH;
  }

  // Draw Category (if present)
  if (catLines.length > 0) {
    textY += 4;
    ctx.fillStyle = '#333333';
    ctx.font = `700 ${catSize}px ${LABEL_FONT}`;
    for (const line of catLines) {
      ctx.fillText(line, textX, textY);
      textY += catLineH;
    }
  }

  // Draw Product Name (under the category)
  textY += 4;
  ctx.fillStyle = '#000000';
  ctx.font = `800 ${nameSize}px ${LABEL_FONT}`;
  for (const line of nameLines) {
    ctx.fillText(line, textX, textY);
    textY += nameLineH;
  }

  return canvasToRaster(canvas);
}

/**
 * Builds a single 50x25mm tag.
 * If qrImage is provided, uses the side-by-side landscape format.
 */
export async function buildSingleLabelEscPos({ sku, name, category, qrImage }) {
  if (qrImage) {
    const raster = await sideBySideLabelRaster({ sku, name, category, qrImage });
    return [
      0x1B, 0x40,        // initialize
      0x1B, 0x61, 0x01,  // center
      ...raster,
      0x1B, 0x64, 0x01,  // feed 1 line (matches pre-cut sticker gap)
    ];
  }

  return [
    0x1B, 0x40,
    0x1B, 0x61, 0x01,
    ...nativeQrCommands(sku),
    ...textBlockRaster({ sku, name, category }),
    0x1B, 0x64, 0x01,
  ];
}

/**
 * Builds the full 58mm tag payload.
 */
export async function labelToEscPos({ sku, name, category, qrImage, copies = 1 }) {
  const singleLabel = await buildSingleLabelEscPos({ sku, name, category, qrImage });
  const fullBytes = [];
  const count = Math.max(1, parseInt(copies, 10) || 1);
  for (let i = 0; i < count; i++) {
    fullBytes.push(...singleLabel);
  }
  return fullBytes;
}

// Module-level timer to prevent rapid re-clicks from severing connections
let disconnectTimer = null;

async function writePrinterBytes(characteristic, bytes, chunkSize = 100) {
  const write = characteristic.properties.writeWithoutResponse
    ? (chunk) => characteristic.writeValueWithoutResponse(chunk)
    : (chunk) => characteristic.writeValue(chunk);

  for (let offset = 0; offset < bytes.length;) {
    const end = Math.min(offset + chunkSize, bytes.length);
    const chunk = bytes.subarray(offset, end);
    try {
      await write(chunk);
      offset = end;
      // 10ms throttle provides fluid motor feeding while protecting BLE UART buffer
      await new Promise((resolve) => setTimeout(resolve, 10));
    } catch (err) {
      if (chunkSize <= 20) throw err;
      chunkSize = 20;
    }
  }
}

const LAST_PRINTER_KEY = 'last_bt_printer_id';
const LAST_PRINTER_NAME_KEY = 'last_bt_printer_name';

const PRINTER_OPTIONAL_SERVICES = [
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Bluepos / Standard Chinese BLE printer service
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard thermal printer service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Common serial BLE
  '0000ff00-0000-1000-8000-00805f9b34fb', // Alternative serial BLE
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent service
];

function connectWithTimeout(gatt, ms = 4000) {
  return Promise.race([
    gatt.connect(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Bluetooth connection timed out')), ms)
    ),
  ]);
}

/**
 * Returns saved printer name if any exists in localStorage.
 */
export function getSavedBluetoothPrinterName() {
  try {
    return localStorage.getItem(LAST_PRINTER_NAME_KEY) || '';
  } catch {
    return '';
  }
}

// In-memory cache for the current browser session
let inMemoryPrinterDevice = null;

/**
 * Clears saved printer ID and name from localStorage and in-memory cache.
 */
export function clearSavedBluetoothPrinter() {
  inMemoryPrinterDevice = null;
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  try {
    localStorage.removeItem(LAST_PRINTER_KEY);
    localStorage.removeItem(LAST_PRINTER_NAME_KEY);
  } catch {
    // ignore
  }
}

async function getOrSelectPrinter(forceSelect = false) {
  // 1. Try to reuse the in-memory cached device from the current session
  if (!forceSelect && inMemoryPrinterDevice && inMemoryPrinterDevice.gatt) {
    try {
      const server = inMemoryPrinterDevice.gatt.connected
        ? inMemoryPrinterDevice.gatt
        : await connectWithTimeout(inMemoryPrinterDevice.gatt, 4000);
      return { device: inMemoryPrinterDevice, server };
    } catch (inMemErr) {
      console.warn('In-memory printer reconnect failed, attempting other methods:', inMemErr);
      inMemoryPrinterDevice = null;
    }
  }

  // 2. Try to reconnect to an already-permitted printer from getDevices()
  if (!forceSelect && typeof navigator !== 'undefined' && navigator.bluetooth?.getDevices) {
    try {
      const devices = await navigator.bluetooth.getDevices();
      if (devices && devices.length > 0) {
        const savedId = localStorage.getItem(LAST_PRINTER_KEY);
        // Match by saved ID, or fallback to the first permitted device
        const candidate = devices.find((d) => d.id === savedId) || devices[0];

        if (candidate && candidate.gatt) {
          try {
            const server = candidate.gatt.connected
              ? candidate.gatt
              : await connectWithTimeout(candidate.gatt, 4000);
            inMemoryPrinterDevice = candidate;
            return { device: candidate, server };
          } catch (autoErr) {
            console.warn('Auto-reconnect via getDevices failed, falling back to chooser:', autoErr);
          }
        }
      }
    } catch (e) {
      console.warn('navigator.bluetooth.getDevices error:', e);
    }
  }

  // 3. Prompt user to select device
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_OPTIONAL_SERVICES,
  });

  if (!device || !device.gatt) {
    throw new Error('Bluetooth GATT server unavailable on selected device.');
  }

  const server = await device.gatt.connect();
  inMemoryPrinterDevice = device;

  if (device.id) {
    try {
      localStorage.setItem(LAST_PRINTER_KEY, device.id);
      if (device.name) {
        localStorage.setItem(LAST_PRINTER_NAME_KEY, device.name);
      }
    } catch {
      // ignore
    }
  }

  return { device, server };
}

/**
 * Connects to a Bluetooth Thermal Printer via Web Bluetooth and prints the QR label.
 * Automatically re-connects to the previously selected printer to skip the device picker popup.
 * @param {Object} params
 * @param {string} params.sku - Product SKU code (encoded into the QR by the printer)
 * @param {string} params.name - Product Name
 * @param {string} [params.category] - Product Category
 * @param {number} [params.copies=1] - Number of copies to print
 * @param {boolean} [params.forceSelect=false] - Force showing the device chooser popup
 */
export async function printQrLabelViaBluetooth({ sku, name, category, qrImage, copies = 1, forceSelect = false }) {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error('Web Bluetooth is not supported on this browser. Please use Chrome, Edge, or Samsung Internet on Android/PC.');
  }

  // Cancel any pending disconnect from a previous print
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }

  const copyCount = Math.max(1, parseInt(copies, 10) || 1);

  // 1. Get or prompt for printer device
  const { device, server } = await getOrSelectPrinter(forceSelect);

  try {
    // 2. Find writable characteristic
    let targetChar = null;
    const services = await server.getPrimaryServices();

    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            targetChar = char;
            break;
          }
        }
      } catch {
        // service may not be accessible, continue searching
      }
      if (targetChar) break;
    }

    if (!targetChar) {
      throw new Error('No writable printing characteristic found on printer.');
    }

    // 3. Build single label binary payload (side-by-side if qrImage passed)
    const singleLabelBytes = new Uint8Array(await buildSingleLabelEscPos({ sku, name, category, qrImage }));

    // 4. Send each copy sequentially with a brief pause for smooth continuous printing
    for (let i = 0; i < copyCount; i++) {
      await writePrinterBytes(targetChar, singleLabelBytes, 100);
      if (i < copyCount - 1) {
        // Brief pause to allow physical paper tear line advance
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    // End-of-job feed: advance the last printed sticker right to the tear bar without over-feeding
    const END_JOB_FEED = new Uint8Array([0x1B, 0x64, 0x01]);
    await writePrinterBytes(targetChar, END_JOB_FEED, 100);

    // Update saved name on successful print
    if (device.id) {
      try {
        localStorage.setItem(LAST_PRINTER_KEY, device.id);
        if (device.name) {
          localStorage.setItem(LAST_PRINTER_NAME_KEY, device.name);
        }
      } catch {
        // ignore
      }
    }

    return true;
  } finally {
    // Dynamic disconnect: scale delay based on number of copies so motor finishes completely
    const disconnectDelay = Math.max(3000, copyCount * 1800 + 1500);
    disconnectTimer = setTimeout(() => {
      try {
        if (device.gatt && device.gatt.connected) {
          device.gatt.disconnect();
        }
      } catch {
        // ignore
      }
      disconnectTimer = null;
    }, disconnectDelay);
  }
}

