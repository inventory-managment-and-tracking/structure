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

function wrapGsV0(bitmapBytes, widthBytes, height) {
  const xL = widthBytes % 256;
  const xH = Math.floor(widthBytes / 256);
  const yL = height % 256;
  const yH = Math.floor(height / 256);
  return [0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...bitmapBytes];
}

function canvasToRaster(canvas, { bandRows } = {}) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const widthBytes = Math.ceil(width / 8);
  const data = ctx.getImageData(0, 0, width, height).data;
  const bitmap = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < widthBytes; x++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const pixelX = x * 8 + bit;
        if (pixelX >= width) continue;
        const idx = (y * width + pixelX) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        // Calibrated threshold of 225 captures all font edges and solidifies QR modules without blobbing
        if (gray < 225) byte |= (1 << (7 - bit));
      }
      bitmap.push(byte);
    }
  }

  if (!bandRows || bandRows >= height) {
    return wrapGsV0(bitmap, widthBytes, height);
  }

  const rasterBytes = [];
  for (let y = 0; y < height; y += bandRows) {
    const rows = Math.min(bandRows, height - y);
    const slice = bitmap.slice(y * widthBytes, (y + rows) * widthBytes);
    rasterBytes.push(...wrapGsV0(slice, widthBytes, rows));
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

function textBlockRaster({ sku, name, category }, rasterOpts) {
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

  return canvasToRaster(canvas, rasterOpts);
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
async function sideBySideLabelRaster({ sku, name, category, size, color, qrImage }, rasterOpts) {
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
  const qrY = 22; // Centered vertically in 200-dot canvas with ~2.75mm top/bottom margins

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

  // 1. Auto-fit SKU on a single line so it NEVER wraps or cuts off (bold 18px 900 weight like CK)
  let skuSize = 18;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.font = `900 ${skuSize}px ${LABEL_FONT}`;
  while (skuSize > 12 && ctx.measureText(sku).width > maxTextW) {
    skuSize -= 1;
    ctx.font = `900 ${skuSize}px ${LABEL_FONT}`;
  }
  const skuLineH = skuSize + 3;
  const skuLines = [sku]; // Single line guaranteed

  // 2. Category (uppercase, prominent 17px 900 extra-bold like CK)
  const catText = String(category || '').trim().toUpperCase();
  let catLines = [];
  let catSize = 17;
  if (catText) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = `900 ${catSize}px ${LABEL_FONT}`;
    while (catSize > 12 && ctx.measureText(catText).width > maxTextW) {
      catSize -= 1;
      ctx.font = `900 ${catSize}px ${LABEL_FONT}`;
    }
    catLines = [catText];
  }
  const catLineH = catSize + 3;

  // 3. Product Name (prominent 22px 900 extra-bold — bold & readable)
  let nameSize = 22;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.font = `900 ${nameSize}px ${LABEL_FONT}`;
  let nameLines = wrapText(ctx, name, maxTextW, false);
  while (nameLines.length > 2 && nameSize > 15) {
    nameSize -= 2;
    ctx.font = `900 ${nameSize}px ${LABEL_FONT}`;
    nameLines = wrapText(ctx, name, maxTextW, false);
  }
  const nameLineH = nameSize + 3;

  // 4. Size & Color (under Product Name: uppercase 17px 900 extra-bold like CK, e.g. "M • BLACK")
  const metaParts = [];
  if (size && String(size).trim() && String(size).trim() !== '—') {
    metaParts.push(String(size).trim().toUpperCase());
  }
  if (color && String(color).trim() && String(color).trim() !== '—') {
    metaParts.push(String(color).trim().toUpperCase());
  }
  const metaText = metaParts.join(' • ');
  let metaLines = [];
  let metaSize = 17;
  if (metaText) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = `900 ${metaSize}px ${LABEL_FONT}`;
    while (metaSize > 11 && ctx.measureText(metaText).width > maxTextW) {
      metaSize -= 1;
      ctx.font = `900 ${metaSize}px ${LABEL_FONT}`;
    }
    metaLines = [metaText];
  }
  const metaLineH = metaSize + 3;

  // Spacing between lines: 6 dots gives comfortable vertical separation
  const gap = 6;

  // Start text at y = 36: comfortably down ~4.5mm from top edge so it never spills over top perforation
  let textY = 36;

  // Draw SKU (extra-bold 900 like CK)
  ctx.fillStyle = '#000000';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.font = `900 ${skuSize}px ${LABEL_FONT}`;
  for (const line of skuLines) {
    ctx.fillText(line, textX, textY);
    textY += skuLineH;
  }

  // Draw Category (extra-bold 900 like CK)
  if (catLines.length > 0) {
    textY += gap;
    ctx.fillStyle = '#000000';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = `900 ${catSize}px ${LABEL_FONT}`;
    for (const line of catLines) {
      ctx.fillText(line, textX, textY);
      textY += catLineH;
    }
  }

  // Draw Product Name (extra-bold 900 like CK)
  textY += gap;
  ctx.fillStyle = '#000000';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.font = `900 ${nameSize}px ${LABEL_FONT}`;
  for (const line of nameLines) {
    ctx.fillText(line, textX, textY);
    textY += nameLineH;
  }

  // Draw Size & Color (extra-bold 900 like CK)
  if (metaLines.length > 0) {
    textY += gap;
    ctx.fillStyle = '#000000';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = `900 ${metaSize}px ${LABEL_FONT}`;
    for (const line of metaLines) {
      ctx.fillText(line, textX, textY);
      textY += metaLineH;
    }
  }

  return canvasToRaster(canvas, rasterOpts);
}

/**
 * Detect iOS (iPhone/iPad/iPod). Bluefy + CoreBluetooth can retransmit BLE
 * writes; a duplicated chunk in a large GS v 0 block is parsed as feed commands.
 */
function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

const IOS_NUL_TAIL = new Array(20).fill(0);
const IOS_BAND_ROWS = 20;

/**
 * Builds a single 50x25mm tag as two separate parts:
 *   raster — the init + image data (sent first)
 *   gap    — feed past the sticker gap (sent after raster is fully consumed)
 *
 * iPhone: image is 20-row GS v 0 bands so a replayed BLE chunk cannot turn
 * the remaining bitmap into runaway feed. Gap is one-shot ESC J, then ESC @
 * and 20 NULs so a replayed tail resets instead of feeding.
 * Android/PC: one full raster and ESC 3 + LF + ESC 2 (already stops cleanly).
 */
export async function buildSingleLabelParts({ sku, name, category, size, color, qrImage }) {
  const ios = isIOS();
  const header = [
    0x1B, 0x40,             // ESC @: initialize printer
    0x1B, 0x37, 7, 240, 40, // ESC 7: max thermal density for jet-black
    0x1B, 0x61, 0x01,       // ESC a 1: center alignment
  ];

  const gap = ios
    ? [
        0x1B, 0x4A, 22,     // ESC J 22: feed 22 dots once (does not change line spacing)
        0x1B, 0x40,         // ESC @: reset
        ...IOS_NUL_TAIL,    // replay of this packet is a no-op
      ]
    : [
        0x1B, 0x33, 22,     // ESC 3 22: set line spacing to 22 dots
        0x0A,               // LF: advance 22 dots (sticker gap)
        0x1B, 0x32,         // ESC 2: restore default line spacing
      ];

  const rasterOpts = ios ? { bandRows: IOS_BAND_ROWS } : undefined;

  if (qrImage) {
    const raster = await sideBySideLabelRaster({ sku, name, category, size, color, qrImage }, rasterOpts);
    return {
      raster: [...header, ...raster],
      gap,
    };
  }

  return {
    raster: [...header, ...nativeQrCommands(sku), ...textBlockRaster({ sku, name, category }, rasterOpts)],
    gap,
  };
}

/** Convenience: single flat array for callers that don't need the split (e.g. labelToEscPos). */
export async function buildSingleLabelEscPos(params) {
  const { raster, gap } = await buildSingleLabelParts(params);
  return [...raster, ...gap];
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

// Module-level guard to prevent overlapping print jobs (especially from iOS double-tap)
let printInProgress = false;

async function writePrinterBytes(characteristic, bytes, chunkSize = 120) {
  const ios = isIOS();
  const canWrite = !!characteristic.properties.write;
  const canWriteWithoutResponse = !!characteristic.properties.writeWithoutResponse;

  if (!canWrite && !canWriteWithoutResponse) {
    throw new Error('Printer characteristic is not writable.');
  }

  let writeWithoutResponse = false;
  let write;
  if (ios) {
    // Prefer writeWithoutResponse (same as working Android). writeValue waits
    // for an ACK these printers never send, so CoreBluetooth retransmits.
    if (canWriteWithoutResponse) {
      write = (chunk) => characteristic.writeValueWithoutResponse(chunk);
      writeWithoutResponse = true;
    } else {
      write = (chunk) => characteristic.writeValue(chunk);
    }
  } else if (canWriteWithoutResponse) {
    write = (chunk) => characteristic.writeValueWithoutResponse(chunk);
    writeWithoutResponse = true;
  } else {
    write = (chunk) => characteristic.writeValue(chunk);
  }

  // -----------------------------------------------------------------
  // iOS BLE is very sensitive to lost ACKs. A lost ACK triggers the
  // OS to *re-send the whole characteristic write*, which can duplicate
  // the raster data and cause an endless print loop.
  // -----------------------------------------------------------------
  // - Use a tiny chunk size (<= 10 bytes) on iOS to minimise the amount
  //   of data that may be retransmitted.
  // - Insert a short pause after each chunk to give the printer time
  //   to process it before the next packet arrives.
  // - Fall back to the original `chunkSize` on non-iOS platforms.
  let effectiveChunk = ios ? Math.min(10, chunkSize) : chunkSize;
  const delayMs = ios ? 60 : (writeWithoutResponse ? 6 : 0);

  for (let offset = 0; offset < bytes.length;) {
    const end = Math.min(offset + effectiveChunk, bytes.length);
    const chunk = bytes.subarray(offset, end);
    try {
      await write(chunk);
      offset = end;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (err) {
      if (ios) {
        try {
          await write(new Uint8Array([0x1B, 0x40]));
        } catch {
          // ignore
        }
        try {
          characteristic.service?.device?.gatt?.disconnect();
        } catch {
          // ignore
        }
        throw err;
      }
      if (effectiveChunk <= 10) throw err;
      effectiveChunk = 20;
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
export async function printQrLabelViaBluetooth({ sku, name, category, size, color, qrImage, copies = 1, forceSelect = false, forceSingleCopy = false }) {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error('Web Bluetooth is not supported on this browser. Please use Chrome, Edge, or Samsung Internet on Android/PC.');
  }

  // -----------------------------------------------------------------
  // Synchronous guard: set the flag *before* any async work so two
  // rapid UI events can't both think they have exclusive access.
  // -----------------------------------------------------------------
  if (printInProgress) {
    console.warn('Print already in progress, ignoring duplicate call');
    return true;
  }
  // Set immediately (no await in between)
  printInProgress = true;

  // Cancel any pending disconnect from a previous print
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }

  const copyCount = Math.max(1, parseInt(copies, 10) || 1);
  let device = null;

  try {
    const selected = await getOrSelectPrinter(forceSelect);
    device = selected.device;
    const { server } = selected;

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

    const { raster, gap } = await buildSingleLabelParts({ sku, name, category, size, color, qrImage });
    const rasterBytes = new Uint8Array(raster);
    const gapBytes = new Uint8Array(gap);

    const ios = isIOS();
    const rasterPauseMs = ios ? 450 : 150;
    const betweenCopyMs = ios ? 500 : 350;

    for (let i = 0; i < copyCount; i++) {
      await writePrinterBytes(targetChar, rasterBytes, ios ? 20 : 100);
      await new Promise((resolve) => setTimeout(resolve, rasterPauseMs));
      await writePrinterBytes(targetChar, gapBytes, ios ? 20 : 100);
      // If iOS requested a forced single copy, stop after the first iteration
      if (ios && forceSingleCopy) break;
      if (i < copyCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, betweenCopyMs));
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
    printInProgress = false;
    if (device) {
      const ios = isIOS();
      const disconnectDelay = ios
        ? 400
        : Math.max(3000, copyCount * 1800 + 1500);
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
}

function buildBlankRasterLabelEscPos(gapDots = 22) {
  const ios = isIOS();
  const widthBytes = 48; // 384 dots width
  const height = 200;    // 200 dots height (exact 25mm label)
  const header = [
    0x1B, 0x40,        // initialize
    0x1B, 0x61, 0x01,  // center
  ];

  if (ios) {
    const parts = [...header];
    for (let y = 0; y < height; y += IOS_BAND_ROWS) {
      const rows = Math.min(IOS_BAND_ROWS, height - y);
      parts.push(0x1D, 0x76, 0x30, 0x00, widthBytes, 0, rows, 0);
      for (let i = 0; i < widthBytes * rows; i++) parts.push(0);
    }
    parts.push(0x1B, 0x4A, gapDots, 0x1B, 0x40, ...IOS_NUL_TAIL);
    return new Uint8Array(parts);
  }

  const rasterHeader = [0x1D, 0x76, 0x30, 0x00, 48, 0, 200, 0];
  const footer = [
    0x1B, 0x33, gapDots, // ESC 3 gapDots
    0x0A,               // LF
    0x1B, 0x32          // ESC 2 reset
  ];

  const totalLen = header.length + rasterHeader.length + (widthBytes * height) + footer.length;
  const payload = new Uint8Array(totalLen);
  payload.set(header, 0);
  payload.set(rasterHeader, header.length);
  payload.set(footer, header.length + rasterHeader.length + (widthBytes * height));
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
    const ios = isIOS();
    const disconnectDelay = ios
      ? 400
      : Math.max(3000, copyCount * 1200 + 1500);
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

