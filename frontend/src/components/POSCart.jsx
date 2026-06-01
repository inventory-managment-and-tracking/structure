import React, { useState } from 'react';
import { ShoppingBag, Trash2, Smartphone, CreditCard, Coins, ChevronRight, FileText, CheckCircle } from 'lucide-react';

export default function POSCart({ cart, updateQty, removeFromCart, onCheckoutSuccess, token }) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedSale, setCompletedSale] = useState(null);

  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const total = parseFloat(subtotal.toFixed(2));

  const handleCheckout = async () => {
    if (!cart.length) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const items = cart.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.unit_price
      }));

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items,
          payment_method: paymentMethod,
          notes: notes || undefined
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Checkout failed');
      }

      setCompletedSale(data.data);
      onCheckoutSuccess();
      setNotes('');
    } catch (err) {
      console.error('[CHECKOUT ERR]', err);
      setErrorMsg(err.message || 'Checkout failed. Check stock levels.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const paymentMethods = [
    { id: 'cash', label: 'Cash', icon: <Coins size={18} /> },
    { id: 'card', label: 'Card', icon: <CreditCard size={18} /> },
    { id: 'mobile_money', label: 'Mobile Money', icon: <Smartphone size={18} /> },
    { id: 'other', label: 'Other', icon: <ChevronRight size={18} /> }
  ];

  return (
    <>
      <div className="pos-cart-panel bg-glass animate-fade">
        <div className="cart-header">
          <div className="cart-title">
            <ShoppingBag size={20} className="text-gold" />
            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Active Checkout</h3>
          </div>
          <span className="cart-count-badge">{cart.reduce((s, i) => s + i.quantity, 0)} items</span>
        </div>

        <div className="cart-items-scroll">
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '40px 10px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
              <ShoppingBag size={32} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: '13px' }}>Cart is empty</p>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Scan a QR code or search to add clothing products</p>
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
                    <div className="cart-item-price mono">${parseFloat(item.unit_price * item.quantity).toFixed(2)}</div>
                  </div>

                  <button 
                    onClick={() => removeFromCart(item.id)} 
                    style={{ color: 'var(--text-dim)', padding: '4px' }}
                    title="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label className="form-label" style={{ fontSize: '12px' }}>Sales Note (Optional)</label>
          <input 
            type="text" 
            placeholder="Add customer info or internal references" 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ padding: '8px 12px', fontSize: '12px' }}
          />
        </div>

        <div className="cart-summary-calculations">
          <div className="calc-row">
            <span>Subtotal</span>
            <span className="mono">${subtotal.toFixed(2)}</span>
          </div>
          <div className="calc-row">
            <span>Tax (0.00%)</span>
            <span className="mono">$0.00</span>
          </div>
          <div className="calc-row total">
            <span>Total Payable</span>
            <span className="mono">${total.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label className="form-label" style={{ fontSize: '12px' }}>Payment Channel</label>
          <div className="payment-methods-grid">
            {paymentMethods.map(method => (
              <button
                key={method.id}
                onClick={() => setPaymentMethod(method.id)}
                className={`payment-method-card ${paymentMethod === method.id ? 'active' : ''}`}
              >
                {method.icon}
                <span style={{ fontSize: '11px', fontWeight: '600' }}>{method.label}</span>
              </button>
            ))}
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
          {isSubmitting ? 'Processing sale...' : `Pay & Print Receipt ($${total.toFixed(2)})`}
        </button>
      </div>

      {/* Modern Thermal Receipt Dialog */}
      {completedSale && (
        <div className="receipt-overlay">
          <div className="receipt-card animate-fade">
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--success-color)', marginBottom: '10px' }}>
              <CheckCircle size={32} />
            </div>
            <div className="receipt-title">CLOTHTRACK POS</div>
            <div className="receipt-meta">
              100 Fashion Blvd, Addis Ababa<br />
              TEL: +251 911 000 000<br />
              DATE: {new Date(completedSale.created_at).toLocaleString()}<br />
              CODE: {completedSale.sale_code}<br />
              STAFF: {completedSale.sold_by_name || 'Cashier'}
            </div>

            <div className="receipt-items">
              {completedSale.items.map((item, idx) => (
                <div key={idx} style={{ marginBottom: '8px' }}>
                  <div style={{ fontWeight: 'bold' }}>{item.product_name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span>{item.quantity} x ${parseFloat(item.unit_price).toFixed(2)}</span>
                    <span>${parseFloat(item.subtotal).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="receipt-dashed-line" />

            <div className="receipt-totals">
              <span>SUBTOTAL:</span>
              <span>${parseFloat(completedSale.total_amount).toFixed(2)}</span>
            </div>
            <div className="receipt-totals">
              <span>TAX (0.00%):</span>
              <span>$0.00</span>
            </div>
            <div className="receipt-totals" style={{ fontSize: '15px' }}>
              <span>TOTAL PAID:</span>
              <span>${parseFloat(completedSale.total_amount).toFixed(2)}</span>
            </div>

            <div className="receipt-dashed-line" />
            
            <div style={{ fontSize: '11px', margin: '4px 0' }}>
              <span>METHOD: </span>
              <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{completedSale.payment_method.replace('_', ' ')}</span>
            </div>

            {completedSale.notes && (
              <div style={{ fontSize: '11px', color: '#444', fontStyle: 'italic', marginTop: '6px' }}>
                Note: {completedSale.notes}
              </div>
            )}

            <div className="receipt-footer-msg">
              *** Thank You for Shopping! ***<br />
              Items in resellable condition with tag intact can be returned within 7 days.
            </div>

            <button 
              onClick={() => setCompletedSale(null)} 
              className="receipt-dismiss-btn"
            >
              Done & Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
