'use strict';

const QRCode = require('qrcode');
const pool   = require('../../config/db');

/**
 * Generates a base64 PNG QR code from the product's SKU.
 * Logs the print event in qr_print_log and updates products.qr_printed_at.
 */
async function generateQR(productId, { copies, print_method }, userId) {
  const { rows } = await pool.query(
    'SELECT id, name, sku FROM products WHERE id = $1 AND is_active = TRUE',
    [productId]
  );
  if (!rows.length) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const product = rows[0];
  const method  = print_method || 'qr';
  const count   = parseInt(copies, 10) || 1;

  let qrDataUrl = null;

  if (method === 'qr') {
    qrDataUrl = await QRCode.toDataURL(product.sku, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
    });
  }

  await pool.query(
    `UPDATE products SET qr_code = $1, qr_printed_at = NOW() WHERE id = $2`,
    [product.sku, productId]
  );

  const { rows: logRows } = await pool.query(
    `INSERT INTO qr_print_log (product_id, printed_by, copies, print_method)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [productId, userId, count, method]
  );

  return {
    product: {
      id:   product.id,
      name: product.name,
      sku:  product.sku,
    },
    print_method: method,
    copies:       count,
    qr_image:     qrDataUrl,
    log:          logRows[0],
  };
}

async function getPrintLog(productId) {
  const { rows } = await pool.query(
    `SELECT q.*,
            u.full_name AS printed_by_name,
            p.name      AS product_name,
            p.sku       AS product_sku
     FROM qr_print_log q
     LEFT JOIN users    u ON u.id = q.printed_by
     LEFT JOIN products p ON p.id = q.product_id
     WHERE q.product_id = $1
     ORDER BY q.printed_at DESC`,
    [productId]
  );
  return rows;
}

module.exports = { generateQR, getPrintLog };
