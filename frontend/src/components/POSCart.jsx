import React, { useState } from 'react';
import { ShoppingBag, Trash2, CheckCircle, X } from 'lucide-react';

export default function POSCart({ cart, updateQty, removeFromCart, onCheckoutSuccess, token }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedSale, setCompletedSale] = useState(null);

  const total = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const handleCheckout = async () => {
    if (!cart.length) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: cart.map(item => ({
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.unit_price
          })),
          payment_method: 'cash'
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Checkout failed');

      setCompletedSale(data.data);
      onCheckoutSuccess();
    } catch (err) {
      setErrorMsg(err.message || 'Checkout failed. Check stock levels.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="pos-cart-panel bg-glass animate-fade">
        <div className="cart-header">
          <div className="cart-title">
            <ShoppingBag size={20} className="text-gold" />
            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Scanned Items</h3>
          </div>
          <span className="cart-count-badge">{cart.reduce((s, i) => s + i.quantity, 0)} items</span>
        </div>

        <div className="cart-items-scroll">
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '40px 10px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
              <ShoppingBag size={32} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: '13px' }}>No items scanned yet</p>
              <p style={{ fontSize: '11px' }}>Scan a QR code or enter SKU manually</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="cart-item-row">
                <div className="cart-item-meta">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-sku mono">{item.sku}</div>
                </div>

                <div className="cart-item-controls">
                  <button onClick={() => updateQty(item.id, -1)} className="qty-btn">-</button>
                  <span style={{ fontSize: '13px', fontWeight: '600', minWidth: '16px', textAlign: 'center' }}>{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="qty-btn">+</button>

                  <div className="cart-item-price-calc">
                    <div className="cart-item-price mono">${(item.unit_price * item.quantity).toFixed(2)}</div>
                  </div>

                  <button onClick={() => removeFromCart(item.id)} style={{ color: 'var(--text-dim)', padding: '4px' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart-summary-calculations">
          <div className="calc-row total">
            <span>Total</span>
            <span className="mono">${total.toFixed(2)}</span>
          </div>
        </div>

        {errorMsg && (
          <div style={{ background: 'var(--danger-glow)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={cart.length === 0 || isSubmitting}
          className="checkout-btn"
        >
          {isSubmitting ? 'Processing...' : `Confirm Sale — $${total.toFixed(2)}`}
        </button>
      </div>

      {/* Sale confirmed dialog */}
      {completedSale && (
        <div className="receipt-overlay">
          <div className="receipt-card animate-fade" style={{ maxWidth: '340px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--success-color)', marginBottom: '12px' }}>
              <CheckCircle size={40} />
            </div>
            <div className="receipt-title" style={{ marginBottom: '4px' }}>Sale Complete</div>
            <div style={{ fontSize: '12px', color: '#555', marginBottom: '16px' }}>
              {completedSale.sale_code} · {new Date(completedSale.created_at).toLocaleTimeString()}
            </div>

            <div className="receipt-items" style={{ textAlign: 'left', marginBottom: '12px' }}>
              {completedSale.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                  <span>{item.product_name} ×{item.quantity}</span>
                  <span>${parseFloat(item.subtotal).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="receipt-dashed-line" />
            <div className="receipt-totals" style={{ fontSize: '15px', marginTop: '8px' }}>
              <span>Total Deducted:</span>
              <span>${parseFloat(completedSale.total_amount).toFixed(2)}</span>
            </div>

            <button onClick={() => setCompletedSale(null)} className="receipt-dismiss-btn" style={{ marginTop: '20px' }}>
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
