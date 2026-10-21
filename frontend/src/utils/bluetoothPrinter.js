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
        // Threshold of 235 captures all anti-aliased font edges so strokes remain solid, thick, and continuous
        if (gray < 235) byte |= (1 << (7 - bit));
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
async function sideBySideLabelRaster({ sku, name, category, size, color, qrImage }) {
  const CANVAS_W = 384;
  const CANVAS_H = 200; // Exact 25mm height at 8 dots/mm

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Left: 148x148 dots (18.5mm x 18.5mm), centered vertically on the 200-dot canvas
  const qrSize = 148;
  const qrX = 14;
  const qrY = 24; // (200 - 148) / 2 = 26; positioned at 24 to align top with the first line of text

  if (qrImage) {
    try {
      ctx.imageSmoothingEnabled = false;
      const qrImg = await loadImage(qrImage);
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch (e) {
      console.warn('Could not load QR image on canvas:', e);
    }
  }

  // Right: SKU, Category, Product Name & Size/Color
  const textX = 172;
  const maxTextW = CANVAS_W - textX - 8; // ~204 dots wide

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Helper to draw text with thermal stroke mass so thin letters burn jet-black without white speckles
  const drawSolidText = (text, x, y, strokeW = 0.7) => {
    ctx.lineWidth = strokeW;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = '#000000';
    ctx.fillText(text, x, y);
  };

  // 1. Auto-fit SKU on a single line so it NEVER wraps or cuts off
  let skuSize = 18;
  ctx.font = `900 ${skuSize}px ${LABEL_FONT}`;
  while (skuSize > 12 && ctx.measureText(sku).width > maxTextW) {
    skuSize -= 1;
    ctx.font = `900 ${skuSize}px ${LABEL_FONT}`;
  }
  const skuLineH = skuSize + 3;
  const skuLines = [sku]; // Single line guaranteed

  // 2. Category (middle, uppercase, bold 15px, solid black)
  const catText = String(category || '').trim().toUpperCase();
  let catLines = [];
  const catSize = 15;
  const catLineH = catSize + 3;
  if (catText) {
    ctx.font = `900 ${catSize}px ${LABEL_FONT}`;
    catLines = wrapText(ctx, catText, maxTextW, false).slice(0, 1);
  }

  // 3. Product Name (placed under the category, prominent 24px extra-bold)
  let nameSize = 24;
  ctx.font = `900 ${nameSize}px ${LABEL_FONT}`;
  let nameLines = wrapText(ctx, name, maxTextW, false);
  while (nameLines.length > 2 && nameSize > 16) {
    nameSize -= 2;
    ctx.font = `900 ${nameSize}px ${LABEL_FONT}`;
    nameLines = wrapText(ctx, name, maxTextW, false);
  }
  const nameLineH = nameSize + 4;

  // 4. Size & Color (under Product Name: simple format e.g. "M • Black")
  const metaParts = [];
  if (size && String(size).trim() && String(size).trim() !== '—') {
    metaParts.push(String(size).trim());
  }
  if (color && String(color).trim() && String(color).trim() !== '—') {
    metaParts.push(String(color).trim());
  }
  const metaText = metaParts.join(' • ');
  let metaLines = [];
  let metaSize = 16;
  if (metaText) {
    ctx.font = `800 ${metaSize}px ${LABEL_FONT}`;
    while (metaSize > 11 && ctx.measureText(metaText).width > maxTextW) {
      metaSize -= 1;
      ctx.font = `800 ${metaSize}px ${LABEL_FONT}`;
    }
    metaLines = [metaText];
  }
  const metaLineH = metaSize + 3;

  // Spacing between lines: 7 dots gives balanced distribution matching QR height
  const gap = 7;
  const catBlockH = catLines.length > 0 ? (gap + catLineH) : 0;
  const nameBlockH = gap + (nameLines.length * nameLineH);
  const metaBlockH = metaLines.length > 0 ? (gap + metaLineH) : 0;
  const textBlockH = (skuLines.length * skuLineH) + catBlockH + nameBlockH + metaBlockH;

  // Start text aligned with the top of the QR code (qrY = 24)
  let textY = Math.max(16, Math.min(qrY, Math.floor((CANVAS_H - textBlockH) / 2)));

  // Draw SKU
  ctx.font = `900 ${skuSize}px ${LABEL_FONT}`;
  for (const line of skuLines) {
    drawSolidText(line, textX, textY, 0.7);
    textY += skuLineH;
  }

  // Draw Category (solid black)
  if (catLines.length > 0) {
    textY += gap;
    ctx.font = `900 ${catSize}px ${LABEL_FONT}`;
    for (const line of catLines) {
      drawSolidText(line, textX, textY, 0.7);
      textY += catLineH;
    }
  }

  // Draw Product Name
  textY += gap;
  ctx.font = `900 ${nameSize}px ${LABEL_FONT}`;
  for (const line of nameLines) {
    drawSolidText(line, textX, textY, 0.8);
    textY += nameLineH;
  }

  // Draw Size & Color under Name
  if (metaLines.length > 0) {
    textY += gap;
    ctx.font = `800 ${metaSize}px ${LABEL_FONT}`;
    for (const line of metaLines) {
      drawSolidText(line, textX, textY, 0.7);
      textY += metaLineH;
    }
  }

  return canvasToRaster(canvas);
}

/**
 * Builds a single 50x25mm tag.
 * If qrImage is provided, uses the side-by-side landscape format.
 */
export async function buildSingleLabelEscPos({ sku, name, category, size, color, qrImage }) {
  if (qrImage) {
    const raster = await sideBySideLabelRaster({ sku, name, category, size, color, qrImage });
    return [
      0x1B, 0x40,             // initialize
      0x1B, 0x37, 7, 240, 40, // ESC 7: maximum thermal heating density & time
      0x12, 0x23, 0xFF,       // DC2 #: max print density on POS-58
      0x1D, 0x7C, 0x08,       // GS |: max density mode
      0x1B, 0x61, 0x01,       // center
      ...raster,
      0x1B, 0x33, 22,         // ESC 3 22: exact 22-dot feed (200 + 22 = 222 dots total cycle)
      0x0A,                   // LF: feed 1 line of 22 dots
      0x1B, 0x32,             // ESC 2: reset line spacing to default
    ];
  }

  return [
    0x1B, 0x40,
    0x1B, 0x37, 7, 240, 40,
    0x1B, 0x61, 0x01,
    ...nativeQrCommands(sku),
    ...textBlockRaster({ sku, name, category }),
    0x1B, 0x33, 22,
    0x0A,
    0x1B, 0x32,
  ];
}

/**
 * Builds the full 58mm tag payload.
 */
export async function labelToEscPos({ sku, name, category, size, color, qrImage, copies = 1 }) {
  const singleLabel = await buildSingleLabelEscPos({ sku, name, category, size, color, qrImage });
  const fullBytes = [];
  const count = Math.max(1, parseInt(copies, 10) || 1);
  for (let i = 0; i < count; i++) {
    fullBytes.push(...singleLabel);
  }
  return fullBytes;
}

// Module-level timer to prevent rapid re-clicks from severing connections
let disconnectTimer = null;

async function writePrinterBytes(characteristic, bytes, chunkSize = 120) {
  const canWriteWithoutResponse = !!characteristic.properties.writeWithoutResponse;
  const write = canWriteWithoutResponse
    ? (chunk) => characteristic.writeValueWithoutResponse(chunk)
    : (chunk) => characteristic.writeValue(chunk);

  // 6ms delay gives the thermal capacitor time to recharge between bursts for jet-black burn
  const delayMs = canWriteWithoutResponse ? 6 : 0;

  for (let offset = 0; offset < bytes.length;) {
    const end = Math.min(offset + chunkSize, bytes.length);
    const chunk = bytes.subarray(offset, end);
    try {
      await write(chunk);
      offset = end;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (err) {
      if (chunkSize <= 20) throw err;
      chunkSize = 20;
      await new Promise((resolve) => setTimeout(resolve, 15));
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

// Target thermal printers and eliminate all nearby iPhones, Apple Watches, and unnamed BLE beacons
const PRINTER_NAME_PREFIXES = [
  'Blue', 'blue', 'BLUE',
  'POS', 'pos',
  'Print', 'print',
  'Thermal', 'thermal',
  'MPT', 'mpt',
  'MTP', 'mtp',
  'PT', 'pt',
  'RP', 'rp',
  'ZJ', 'zj',
  'XP', 'xp',
  'P58', 'p58',
  '58'
];

const PRINTER_FILTERS = [
  ...PRINTER_NAME_PREFIXES.map((prefix) => ({ namePrefix: prefix })),
  { services: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] },
  { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
  { services: ['49535343-fe7d-4ae5-8fa9-9fafd205e455'] },
  { services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] },
  { services: ['0000ff00-0000-1000-8000-00805f9b34fb'] },
];

function connectWithTimeout(gatt, ms = 6000) {
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
        : await connectWithTimeout(inMemoryPrinterDevice.gatt, 6000);
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
              : await connectWithTimeout(candidate.gatt, 6000);
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

  // 3. Prompt user to select device.
  // We first use printer filters to filter out all nearby iPhones and random-character devices.
  let device;
  try {
    device = await navigator.bluetooth.requestDevice({
      filters: PRINTER_FILTERS,
      optionalServices: PRINTER_OPTIONAL_SERVICES,
    });
  } catch (err) {
    // If user cancelled, rethrow directly
    if (err.name === 'NotFoundError' && err.message && err.message.toLowerCase().includes('cancelled')) {
      throw err;
    }
    // Fallback: If no device matched the filter or browser doesn't support filter combo, prompt with acceptAll
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_OPTIONAL_SERVICES,
    });
  }

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
 * @param {string} [params.size] - Product Size
 * @param {string} [params.color] - Product Color
 * @param {number} [params.copies=1] - Number of copies to print
 * @param {boolean} [params.forceSelect=false] - Force showing the device chooser popup
 */
export async function printQrLabelViaBluetooth({ sku, name, category, size, color, qrImage, copies = 1, forceSelect = false }) {
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
    const singleLabelBytes = new Uint8Array(await buildSingleLabelEscPos({ sku, name, category, size, color, qrImage }));

    // 4. Send each copy sequentially with a brief pause for smooth continuous printing
    for (let i = 0; i < copyCount; i++) {
      await writePrinterBytes(targetChar, singleLabelBytes, 100);
      if (i < copyCount - 1) {
        // Brief pause to allow physical paper tear line advance
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }


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

function buildBlankRasterLabelEscPos(gapDots = 22) {
  const widthBytes = 48; // 384 dots width
  const height = 200;    // 200 dots height (exact 25mm label)
  const header = [
    0x1B, 0x40,        // initialize
    0x1B, 0x61, 0x01,  // center
    0x1D, 0x76, 0x30, 0x00, 48, 0, 200, 0 // GS v 0 0: 48 bytes wide, 200 rows tall
  ];
  const footer = [
    0x1B, 0x33, gapDots, // ESC 3 gapDots
    0x0A,               // LF
    0x1B, 0x32          // ESC 2 reset
  ];

  const totalLen = header.length + (widthBytes * height) + footer.length;
  const payload = new Uint8Array(totalLen);
  payload.set(header, 0);
  // 9,600 bytes in the middle are automatically 0x00 (pure white pixels, zero ink)
  payload.set(footer, header.length + (widthBytes * height));
  return payload;
}

/**
 * Advances the printer motor by N label cycles using a true 200-row blank raster.
 * Physically identical to a real print job with zero ink and zero waste.
 */
export async function testBlankFeedViaBluetooth({ copies = 1, gapDots = 22, forceSelect = false } = {}) {
  const { device, server } = await getOrSelectPrinter(forceSelect);
  const copyCount = Math.max(1, parseInt(copies, 10) || 1);

  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }

  try {
    const services = await server.getPrimaryServices();
    let targetChar = null;
    for (const service of services) {
      try {
        const chars = await service.getCharacteristics();
        for (const char of chars) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            targetChar = char;
            break;
          }
        }
      } catch {
        // continue
      }
      if (targetChar) break;
    }

    if (!targetChar) {
      throw new Error('No writable printing characteristic found on printer.');
    }

    // Exact true-to-life 200-row blank raster + gapDots feed
    const blankCycleBytes = buildBlankRasterLabelEscPos(gapDots);

    for (let i = 0; i < copyCount; i++) {
      await writePrinterBytes(targetChar, blankCycleBytes, 120);
      if (i < copyCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

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
    const disconnectDelay = Math.max(3000, copyCount * 1200 + 1500);
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

