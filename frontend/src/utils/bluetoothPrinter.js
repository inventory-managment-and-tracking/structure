/**
 * Web Bluetooth ESC/POS Direct Thermal Printer Utility
 * Supports 58mm/80mm Bluetooth thermal printers (including Bluepos, POS-58, MPT, etc.)
 */

/**
 * Converts a base64 PNG image (QR code) to ESC/POS raster bitmap commands (GS v 0).
 * Fits a 58mm printer with 384-dot printable width (or targetWidth ~240px).
 */
export async function qrImageToEscPos(dataUrl, targetWidth = 240) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const width = targetWidth;
        const height = Math.round((img.height / img.width) * targetWidth);
        const widthBytes = Math.ceil(width / 8);
        const actualWidth = widthBytes * 8;

        const canvas = document.createElement('canvas');
        canvas.width = actualWidth;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas 2D context not available'));

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, actualWidth, height);

        const xOffset = Math.floor((actualWidth - width) / 2);
        ctx.drawImage(img, xOffset, 0, width, height);

        const imgData = ctx.getImageData(0, 0, actualWidth, height);
        const data = imgData.data;

        const rasterBytes = [];
        // ESC @: Initialize printer
        rasterBytes.push(0x1B, 0x40);
        // ESC a 1: Center alignment
        rasterBytes.push(0x1B, 0x61, 0x01);

        // GS v 0 0 xL xH yL yH: Print raster bit image
        const xL = widthBytes % 256;
        const xH = Math.floor(widthBytes / 256);
        const yL = height % 256;
        const yH = Math.floor(height / 256);

        rasterBytes.push(0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH);

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < widthBytes; x++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
              const pixelX = x * 8 + bit;
              const idx = (y * actualWidth + pixelX) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              if (gray < 160) {
                byte |= (1 << (7 - bit));
              }
            }
            rasterBytes.push(byte);
          }
        }
        resolve(rasterBytes);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load QR code image for printing'));
    img.src = dataUrl;
  });
}

/**
 * Connects to a Bluetooth Thermal Printer via Web Bluetooth and prints the QR label.
 * @param {Object} params
 * @param {string} params.sku - Product SKU code
 * @param {string} params.name - Product Name
 * @param {string} params.qrDataUrl - Data URL (base64 image) of the QR code
 */
export async function printQrLabelViaBluetooth({ sku, name, qrDataUrl }) {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error('Web Bluetooth is not supported on this browser. Please use Chrome, Edge, or Samsung Internet on Android/PC.');
  }

  // 1. Request Bluetooth Device (supports standard BLE thermal printer GATT services)
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Bluepos / Standard Chinese BLE printer service
      '000018f0-0000-1000-8000-00805f9b34fb', // Standard thermal printer service
      '0000ffe0-0000-1000-8000-00805f9b34fb', // Common serial BLE
      '0000ff00-0000-1000-8000-00805f9b34fb', // Alternative serial BLE
      '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent service
    ],
  });

  if (!device.gatt) {
    throw new Error('Bluetooth GATT server unavailable on selected device.');
  }

  // 2. Connect to GATT Server
  const server = await device.gatt.connect();

  try {
    // 3. Find writable characteristic
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

    // 4. Generate ESC/POS commands
    // - Raster QR image
    const imageBytes = await qrImageToEscPos(qrDataUrl, 240);

    const encoder = new TextEncoder();
    const commands = [...imageBytes];

    // Center alignment
    commands.push(0x1B, 0x61, 0x01);

    // Bold SKU
    commands.push(0x1B, 0x45, 0x01);
    commands.push(...encoder.encode(`${sku}\n`));
    commands.push(0x1B, 0x45, 0x00);

    // Product Name
    commands.push(...encoder.encode(`${name}\n\n\n\n`));

    // Feed lines & optional cut
    commands.push(0x1B, 0x64, 0x03);

    // 5. Send data in safe BLE MTU chunks (64 bytes each with short pause)
    const CHUNK_SIZE = 64;
    const buffer = new Uint8Array(commands);

    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
      const chunk = buffer.slice(i, i + CHUNK_SIZE);
      if (targetChar.properties.writeWithoutResponse) {
        await targetChar.writeValueWithoutResponse(chunk);
      } else {
        await targetChar.writeValue(chunk);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    return true;
  } finally {
    // Graceful disconnect after print transmission
    setTimeout(() => {
      try {
        if (device.gatt && device.gatt.connected) {
          device.gatt.disconnect();
        }
      } catch {
        // ignore
      }
    }, 500);
  }
}
