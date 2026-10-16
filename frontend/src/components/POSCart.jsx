import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingBag, Trash2, CheckCircle, RotateCcw, Pencil, Check, X, 
  AlertCircle, AlertTriangle, Printer, Banknote, CreditCard, RefreshCw, Tag
} from 'lucide-react';
import { formatBirr } from '../utils/formatBirr';
import { notifyInventoryChanged } from '../utils/inventoryEvents';

function refundPreviewForQty(openLine, returnQty) {
  const qty = parseInt(returnQty, 10);
  const lineQty = parseInt(openLine.quantity, 10);
  const subtotal = parseFloat(openLine.subtotal);
  if (qty >= lineQty) return subtotal;
  return parseFloat(((subtotal / lineQty) * qty).toFixed(2));
}

function formatSaleWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function POSCart({ 
  cart, 
  updateQty, 
  removeFromCart, 
  overrideLineTotal, 
  onCheckoutSuccess, 
  token,
  posMode = 'sell',
  onPosModeChange
}) {
  const [activeTab, setActiveTab] = useState(posMode);

  useEffect(() => {
    if (posMode && posMode !== activeTab) {
      setActiveTab(posMode);
    }
  }, [posMode]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    onPosModeChange?.(tab);
    setErrorMsg('');
    setRefundError('');
    if (tab === 'sell') setSelectedSaleByProduct({});
  };

  const [editingPriceId, setEditingPriceId] = useState(null);
  const [priceDraft, setPriceDraft] = useState('');

  const getLineTotal = (item) => (
    item.custom_subtotal != null
      ? item.custom_subtotal
      : item.unit_price * item.quantity
  );

  const getCatalogLineTotal = (item) => (
    (item.original_unit_price ?? item.unit_price) * item.quantity
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedSale, setCompletedSale] = useState(null);

  const [refundForm, setRefundForm] = useState({
    reason: 'wrong_size',
    condition: 'resellable',
    refund_type: 'cash',
    notes: ''
  });
  const [otherReasonText, setOtherReasonText] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [completedRefund, setCompletedRefund] = useState(null);

  const [openSalesByProduct, setOpenSalesByProduct] = useState({});
  const [openSalesLoading, setOpenSalesLoading] = useState(false);
  const [selectedSaleByProduct, setSelectedSaleByProduct] = useState({});

  const total = cart.reduce((sum, item) => sum + getLineTotal(item), 0);
  const catalogTotal = cart.reduce((sum, item) => sum + getCatalogLineTotal(item), 0);
  const totalDiscount = Math.max(0, catalogTotal - total);
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const loadOpenSales = useCallback(async () => {
    if (!token || activeTab !== 'refund' || !cart.length) {
      setOpenSalesByProduct({});
      return;
    }
    setOpenSalesLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const entries = await Promise.all(
        cart.map(async (item) => {
          const res = await fetch(`/api/sales/open-for-product/${item.id}`, { headers });
          const data = await res.json();
          return [item.id, data.success ? data.data : []];
        })
      );
      setOpenSalesByProduct(Object.fromEntries(entries));
    } catch {
      setOpenSalesByProduct({});
    } finally {
      setOpenSalesLoading(false);
    }
  }, [token, activeTab, cart]);

  useEffect(() => {
    loadOpenSales();
  }, [loadOpenSales]);

  // Clean up selected sales when items are removed
  useEffect(() => {
    setSelectedSaleByProduct((prev) => {
      const next = { ...prev };
      const ids = new Set(cart.map((i) => i.id));
      Object.keys(next).forEach((id) => {
        if (!ids.has(Number(id))) delete next[id];
      });
      return next;
    });
  }, [cart]);

  const pickSaleForProduct = (productId, openLine, itemQty) => {
    const returnQty = Math.min(parseInt(itemQty, 10), parseInt(openLine.remaining_qty, 10));
    const refundAmount = refundPreviewForQty(openLine, returnQty);
    setSelectedSaleByProduct((prev) => ({
      ...prev,
      [productId]: {
        sale_id: openLine.sale_id,
        sale_code: openLine.sale_code,
        refund_amount: refundAmount,
        return_qty: returnQty,
      },
    }));
  };

  // Auto-pick if there is only 1 open sale line and none selected yet
  useEffect(() => {
    if (activeTab !== 'refund') return;
    cart.forEach(item => {
      const openLines = openSalesByProduct[item.id] || [];
      if (openLines.length === 1 && !selectedSaleByProduct[item.id]) {
        pickSaleForProduct(item.id, openLines[0], item.quantity);
      }
    });
  }, [activeTab, cart, openSalesByProduct, selectedSaleByProduct]);

  // Recalculate refund amounts whenever quantity changes
  useEffect(() => {
    setSelectedSaleByProduct((prev) => {
      let changed = false;
      const next = { ...prev };
      cart.forEach((item) => {
        const currentPick = next[item.id];
        if (currentPick && currentPick.sale_id) {
          const openLines = openSalesByProduct[item.id] || [];
          const openLine = openLines.find((l) => l.sale_id === currentPick.sale_id);
          if (openLine) {
            const returnQty = Math.min(parseInt(item.quantity, 10), parseInt(openLine.remaining_qty, 10));
            const refundAmount = refundPreviewForQty(openLine, returnQty);
            if (currentPick.return_qty !== returnQty || currentPick.refund_amount !== refundAmount) {
              next[item.id] = {
                ...currentPick,
                return_qty: returnQty,
                refund_amount: refundAmount,
              };
              changed = true;
            }
          }
        }
      });
      return changed ? next : prev;
    });
  }, [cart, openSalesByProduct]);

  const allRefundSalesPicked = cart.length > 0 && cart.every((item) => {
    const pick = selectedSaleByProduct[item.id];
    return pick && pick.sale_id;
  });

  const refundTotal = cart.reduce((sum, item) => {
    const pick = selectedSaleByProduct[item.id];
    return sum + (pick?.refund_amount || 0);
  }, 0);

  const startPriceEdit = (item) => {
    setEditingPriceId(item.id);
    setPriceDraft(String(getLineTotal(item)));
  };

  const cancelPriceEdit = () => {
    setEditingPriceId(null);
    setPriceDraft('');
  };

  const savePriceEdit = (id) => {
    const parsed = parseFloat(priceDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    overrideLineTotal(id, parsed);
    cancelPriceEdit();
  };

  const isDiscounted = (item) => getLineTotal(item) < getCatalogLineTotal(item) - 0.005;

  const handleCheckout = async () => {
    if (!cart.length) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cart.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            ...(item.custom_subtotal != null ? { subtotal: item.custom_subtotal } : {}),
          })),
          payment_method: 'cash'
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Checkout failed');
      setCompletedSale(data.data);
      notifyInventoryChanged();
      onCheckoutSuccess();
    } catch (err) {
      setErrorMsg(err.message || 'Checkout failed. Check stock levels.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefund = async () => {
    if (!cart.length || !allRefundSalesPicked) return;
    setIsRefunding(true);
    setRefundError('');
    try {
      const results = [];
      const finalNotes = refundForm.reason === 'other'
        ? (otherReasonText ? `${otherReasonText}${refundForm.notes ? ` · ${refundForm.notes}` : ''}` : refundForm.notes || undefined)
        : (refundForm.notes || undefined);

      for (const item of cart) {
        const pick = selectedSaleByProduct[item.id];
        const res = await fetch('/api/returns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            product_id: item.id,
            sale_id: pick.sale_id,
            quantity: pick.return_qty,
            reason: refundForm.reason,
            condition: refundForm.condition,
            refund_type: refundForm.refund_type,
            notes: finalNotes
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || `Refund failed for ${item.name}`);
        results.push(data.data);
      }
      setCompletedRefund(results);
      setSelectedSaleByProduct({});
      notifyInventoryChanged();
      onCheckoutSuccess();
    } catch (err) {
      setRefundError(err.message);
    } finally {
      setIsRefunding(false);
    }
  };

  return (
    <>
      <div className={`pos-cart-panel animate-fade${activeTab === 'refund' ? ' pos-cart-panel--refund' : ''}`}>

        {/* 1. Header Segmented Mode Tabs */}
        <div className="pos-cart-mode-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sell'}
            className={`pos-cart-mode-tab${activeTab === 'sell' ? ' pos-cart-mode-tab--active' : ''}`}
            onClick={() => handleTabChange('sell')}
          >
            <ShoppingBag size={15} />
            <span>Sell Mode</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'refund'}
            className={`pos-cart-mode-tab${activeTab === 'refund' ? ' pos-cart-mode-tab--active pos-cart-mode-tab--refund' : ''}`}
            onClick={() => handleTabChange('refund')}
          >
            <RotateCcw size={15} />
            <span>Refund Mode</span>
          </button>
        </div>

        {/* 2. Cart Title & Counter Row */}
        <div className="cart-header">
          <div className="cart-title">
            <div className="cart-title-icon-wrapper">
              {activeTab === 'sell' ? <ShoppingBag size={18} /> : <RotateCcw size={18} />}
            </div>
            <div>
              <h3 className="cart-title-text">
                {activeTab === 'sell' ? 'Checkout Queue' : 'Return Queue'}
              </h3>
              <span className="cart-subtitle-text">
                {activeTab === 'sell' ? 'Items ready for sale' : 'Items being returned'}
              </span>
            </div>
          </div>
          <span className="cart-count-badge">
            {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* 3. Items List Area + Refund Config (scroll together) */}
        <div className="cart-items-scroll">
          {cart.length === 0 ? (
            <div className="cart-empty-state">
              <div className="cart-empty-icon-wrap">
                {activeTab === 'sell' ? (
                  <ShoppingBag size={32} className="cart-empty-state-icon" aria-hidden />
                ) : (
                  <RotateCcw size={32} className="cart-empty-state-icon" aria-hidden />
                )}
              </div>
              <p className="cart-empty-state-title">
                {activeTab === 'sell' ? 'No items in cart' : 'No items queued for refund'}
              </p>
              <p className="cart-empty-state-hint">
                {activeTab === 'sell' 
                  ? 'Scan a product barcode or enter SKU manually to start'
                  : 'Scan or lookup SKU of the item the customer wants to return'}
              </p>
            </div>
          ) : (
            cart.map(item => {
              const openLines = openSalesByProduct[item.id] || [];
              const selected = selectedSaleByProduct[item.id];

              if (activeTab === 'sell') {
                return (
                  <div key={item.id} className="cart-item-row animate-fade">
                    <div className="cart-item-meta">
                      <div className="cart-item-name" title={item.name}>{item.name}</div>
                      <div className="cart-item-sku mono">{item.sku}</div>
                      {isDiscounted(item) && (
                        <span className="discount-sale-badge cart-discount-badge">
                          <Tag size={10} /> Below catalog price
                        </span>
                      )}
                      {item.quantity > 1 && editingPriceId !== item.id && (
                        <span className="cart-line-unit-hint mono">
                          {formatBirr(item.unit_price)} each × {item.quantity}
                        </span>
                      )}
                    </div>

                    <div className="cart-item-controls">
                      {/* Quantity Stepper */}
                      <div className="cart-stepper">
                        <button 
                          type="button" 
                          onClick={() => updateQty(item.id, -1)} 
                          className="cart-stepper-btn"
                          title="Decrease quantity"
                        >
                          -
                        </button>
                        <span className="cart-stepper-qty mono">{item.quantity}</span>
                        <button 
                          type="button" 
                          onClick={() => updateQty(item.id, 1)} 
                          className="cart-stepper-btn"
                          title="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      {/* Price Calculation / Inline Edit */}
                      <div className="cart-item-price-col">
                        {editingPriceId === item.id ? (
                          <div className="cart-price-edit-inline">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={priceDraft}
                              onChange={(e) => setPriceDraft(e.target.value)}
                              className="cart-price-input"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') savePriceEdit(item.id);
                                if (e.key === 'Escape') cancelPriceEdit();
                              }}
                            />
                            <div className="cart-price-actions">
                              <button type="button" className="cart-price-btn save" onClick={() => savePriceEdit(item.id)} title="Save price">
                                <Check size={12} />
                              </button>
                              <button type="button" className="cart-price-btn cancel" onClick={cancelPriceEdit} title="Cancel">
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="cart-price-display-cluster">
                            <span className="cart-item-price mono">
                              {formatBirr(getLineTotal(item))}
                            </span>
                            <button
                              type="button"
                              className="cart-icon-btn cart-icon-btn--edit"
                              onClick={() => startPriceEdit(item)}
                              title={item.quantity > 1 ? 'Edit total price for line' : 'Override sale price'}
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Remove line */}
                      <button 
                        type="button" 
                        onClick={() => removeFromCart(item.id)} 
                        className="cart-icon-btn cart-icon-btn--delete"
                        title="Remove from cart"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              }

              // REFUND ITEM CARD
              const activeSaleLine = selected ? openLines.find(l => l.sale_id === selected.sale_id) : null;
              const maxReturnQty = activeSaleLine ? parseInt(activeSaleLine.remaining_qty, 10) : 999;

              return (
                <div 
                  key={item.id} 
                  className={`cart-item-row cart-item-row--refund animate-fade ${selected ? 'has-sale-picked' : 'missing-sale-picked'}`}
                >
                  {/* Top: Item Title, SKU, Return Quantity, Delete */}
                  <div className="refund-item-header">
                    <div className="refund-item-title-col">
                      <div className="refund-item-name" title={item.name}>{item.name}</div>
                      <div className="refund-item-meta-badges">
                        <span className="refund-sku-pill mono">{item.sku}</span>
                        <div className="refund-qty-stepper">
                          <button 
                            type="button"
                            className="refund-qty-btn"
                            onClick={() => updateQty(item.id, -1)}
                            disabled={item.quantity <= 1}
                            title="Decrease return quantity"
                          >
                            -
                          </button>
                          <span className="refund-qty-text">
                            Qty: <strong className="mono">{item.quantity}</strong>
                          </span>
                          <button 
                            type="button"
                            className="refund-qty-btn"
                            onClick={() => updateQty(item.id, 1)}
                            disabled={selected && item.quantity >= maxReturnQty}
                            title="Increase return quantity"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <button 
                      type="button" 
                      onClick={() => removeFromCart(item.id)} 
                      className="cart-icon-btn cart-icon-btn--delete"
                      title="Remove from return list"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Middle: Sale Match Box */}
                  <div className="refund-sale-box">
                    <div className="refund-sale-box-header">
                      <span className="refund-sale-box-title">Original Sale Match</span>
                      {openSalesLoading ? (
                        <span className="refund-sale-status-badge refund-sale-status-badge--loading">Checking sales…</span>
                      ) : selected ? (
                        <span className="refund-sale-status-badge refund-sale-status-badge--selected">✓ Sale matched</span>
                      ) : openLines.length > 0 ? (
                        <span className="refund-sale-status-badge refund-sale-status-badge--pending">Select a sale</span>
                      ) : (
                        <span className="refund-sale-status-badge refund-sale-status-badge--error">No sale found</span>
                      )}
                    </div>

                    {openSalesLoading && (
                      <div className="refund-sale-loading-state">
                        <span className="refund-mini-spinner" />
                        <span>Searching sales history for this product…</span>
                      </div>
                    )}

                    {!openSalesLoading && openLines.length === 0 && (
                      <div className="refund-sale-empty-state">
                        <AlertTriangle size={14} className="refund-sale-empty-icon" />
                        <div>
                          <strong>No refundable sale found</strong>
                          <p>All previous sales for this item have already been refunded or no sales recorded.</p>
                        </div>
                      </div>
                    )}

                    {!openSalesLoading && openLines.length > 0 && (
                      <ul className="refund-sale-options-list">
                        {openLines.map((line) => {
                          const isSelected = selected?.sale_id === line.sale_id;
                          const preview = refundPreviewForQty(line, Math.min(item.quantity, line.remaining_qty));
                          return (
                            <li key={`${line.sale_id}-${line.sale_item_id}`}>
                              <button
                                type="button"
                                className={`refund-sale-option-card${isSelected ? ' selected' : ''}`}
                                onClick={() => pickSaleForProduct(item.id, line, item.quantity)}
                              >
                                <div className="refund-sale-card-left">
                                  <div className="refund-radio-circle">
                                    {isSelected && <div className="refund-radio-dot" />}
                                  </div>
                                  <div className="refund-sale-card-details">
                                    <div className="refund-sale-code-text mono">{line.sale_code}</div>
                                    <div className="refund-sale-time-text">
                                      {formatSaleWhen(line.created_at)} · {line.sold_by_name || 'Staff'}
                                    </div>
                                  </div>
                                </div>

                                <div className="refund-sale-card-right">
                                  <div className="refund-sale-amount-text mono">
                                    {formatBirr(preview)}
                                  </div>
                                  <div className="refund-sale-qty-info">
                                    {line.remaining_qty} available
                                    {line.is_discounted && <span className="refund-sale-discount-tag"> · discounted</span>}
                                  </div>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Bottom: Item Refund Subtotal */}
                  <div className="refund-item-footer">
                    <span className="refund-item-footer-label">Item Refund Amount:</span>
                    <span className="refund-item-footer-amount mono">
                      {selected ? formatBirr(selected.refund_amount) : '— (Pending sale match)'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
           {/* 4. Refund Return Config (inside scroll area) */}
          {activeTab === 'refund' && cart.length > 0 && (
            <div className="refund-config-panel animate-fade">
              <div className="refund-config-header">
                <RotateCcw size={13} style={{ color: 'var(--danger-color)' }} />
                <span>Return Policy &amp; Settlement Details</span>
              </div>

              <div className="refund-config-grid">
                <div className="refund-field">
                  <label className="refund-field-label">Return Reason</label>
                  <select 
                    className="refund-select"
                    value={refundForm.reason} 
                    onChange={e => setRefundForm({ ...refundForm, reason: e.target.value })}
                  >
                    <option value="wrong_size">Wrong Size</option>
                    <option value="defective">Defective / Damaged</option>
                    <option value="changed_mind">Customer Changed Mind</option>
                    <option value="other">Other Reason…</option>
                  </select>
                </div>

                <div className="refund-field">
                  <label className="refund-field-label">Item Condition</label>
                  <select 
                    className="refund-select"
                    value={refundForm.condition} 
                    onChange={e => setRefundForm({ ...refundForm, condition: e.target.value })}
                  >
                    <option value="resellable">Resellable (Restock to Inventory)</option>
                    <option value="damaged">Damaged (Do Not Restock)</option>
                    <option value="missing_tags">Missing Tags (Do Not Restock)</option>
                  </select>
                </div>
              </div>

              {/* Condition Feedback Hint */}
              <div className={`refund-condition-hint ${refundForm.condition === 'resellable' ? 'refund-condition-hint--restock' : 'refund-condition-hint--norestock'}`}>
                {refundForm.condition === 'resellable' ? (
                  <>✓ Returned items will be restored to sellable inventory automatically.</>
                ) : (
                  <>⚠️ Items marked damaged/missing tags will NOT be added back to sellable stock.</>
                )}
              </div>

              {/* Refund Method Chips */}
              <div className="refund-field">
                <label className="refund-field-label">Refund Settlement Method</label>
                <div className="refund-methods-row">
                  {[
                    { id: 'cash', label: 'Cash', icon: Banknote },
                    { id: 'store_credit', label: 'Store Credit', icon: CreditCard },
                    { id: 'exchange', label: 'Exchange', icon: RefreshCw },
                  ].map(m => {
                    const Icon = m.icon;
                    const isActive = refundForm.refund_type === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`refund-method-chip${isActive ? ' active' : ''}`}
                        onClick={() => setRefundForm({ ...refundForm, refund_type: m.id })}
                      >
                        <Icon size={13} />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Other reason description */}
              {refundForm.reason === 'other' && (
                <div className="refund-field animate-fade">
                  <label className="refund-field-label">Describe Reason (Required)</label>
                  <input
                    type="text"
                    placeholder="e.g. Color mismatch, seam stitching flaw…"
                    value={otherReasonText}
                    onChange={e => setOtherReasonText(e.target.value)}
                    className="refund-input"
                  />
                </div>
              )}

              {/* Staff notes */}
              <div className="refund-field">
                <label className="refund-field-label">Internal Staff Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Customer receipt # or manager approval"
                  value={refundForm.notes}
                  onChange={e => setRefundForm({ ...refundForm, notes: e.target.value })}
                  className="refund-input"
                />
              </div>
            </div>
          )}
        </div>{/* end cart-items-scroll */}

        {/* 5. Sticky Footer: Summary + Alerts + Action Button */}
        <div className="pos-cart-footer">
        <div className="cart-summary-calculations">
          {activeTab === 'sell' ? (
            <>
              {totalDiscount > 0 && (
                <div className="calc-row">
                  <span>Regular Total</span>
                  <span className="mono">{formatBirr(catalogTotal)}</span>
                </div>
              )}
              {totalDiscount > 0 && (
                <div className="calc-row" style={{ color: 'var(--success-color)' }}>
                  <span>Discounts Applied</span>
                  <span className="mono">- {formatBirr(totalDiscount)}</span>
                </div>
              )}
              <div className="calc-row total">
                <span>Total Due</span>
                <span className="mono">{formatBirr(total)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="calc-row">
                <span>Items Returning</span>
                <span>{totalItemCount} unit{totalItemCount > 1 ? 's' : ''}</span>
              </div>
              <div className="calc-row">
                <span>Settlement Method</span>
                <span style={{ textTransform: 'capitalize', fontWeight: '600' }}>
                  {refundForm.refund_type.replace('_', ' ')}
                </span>
              </div>
              <div className="calc-row total total--refund">
                <span>Total Refund</span>
                <span className="mono" style={{ color: 'var(--danger-color)' }}>
                  {formatBirr(refundTotal)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* 6. Alert Notices */}
        {activeTab === 'sell' && errorMsg && (
          <div className="pos-cart-alert">
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {activeTab === 'refund' && refundError && (
          <div className="pos-cart-alert">
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{refundError}</span>
          </div>
        )}

        {activeTab === 'refund' && cart.length > 0 && !allRefundSalesPicked && (
          <div className="pos-cart-notice">
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            <span>Please select a matched sale for every item above.</span>
          </div>
        )}

        {/* 7. Action Checkout Button */}
        {activeTab === 'sell' && (
          <button 
            type="button" 
            onClick={handleCheckout} 
            disabled={cart.length === 0 || isSubmitting} 
            className="checkout-btn"
          >
            <ShoppingBag size={18} />
            <span>
              {isSubmitting ? 'Processing Sale…' : `Confirm Sale — ${formatBirr(total)}`}
            </span>
          </button>
        )}

        {activeTab === 'refund' && (
          <button
            type="button"
            onClick={handleRefund}
            disabled={cart.length === 0 || isRefunding || !allRefundSalesPicked}
            className="checkout-btn checkout-btn--refund"
          >
            <RotateCcw size={18} />
            <span>
              {isRefunding
                ? 'Processing Refund…'
                : allRefundSalesPicked
                  ? `Process Refund — ${formatBirr(refundTotal)}`
                  : 'Select Sale for Each Item'}
            </span>
          </button>
        )}
        </div>{/* end pos-cart-footer */}
      </div>{/* end pos-cart-panel */}

      {/* Sale Complete Thermal Receipt Modal */}
      {completedSale && (
        <div className="receipt-overlay">
          <div className="receipt-card animate-fade">
            <div className="receipt-status-icon receipt-status-icon--success">
              <CheckCircle size={36} />
            </div>
            <div className="receipt-title">Sale Complete</div>
            <div className="receipt-meta">
              <div>Receipt #{completedSale.sale_code}</div>
              <div>{new Date(completedSale.created_at).toLocaleString()}</div>
            </div>

            <div className="receipt-items">
              {completedSale.items.map((item, idx) => (
                <div key={idx} className="receipt-item">
                  <span className="receipt-item-name">{item.product_name} ×{item.quantity}</span>
                  <span className="receipt-item-subtotal mono">{formatBirr(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="receipt-dashed-line" />

            <div className="receipt-totals">
              <span>Total Paid:</span>
              <span className="mono">{formatBirr(completedSale.total_amount)}</span>
            </div>

            <div className="receipt-actions">
              <button 
                type="button" 
                onClick={() => window.print()} 
                className="receipt-btn receipt-btn--secondary"
              >
                <Printer size={14} /> Print Receipt
              </button>
              <button 
                type="button" 
                onClick={() => setCompletedSale(null)} 
                className="receipt-btn receipt-btn--primary"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Processed Thermal Receipt Modal */}
      {completedRefund && (
        <div className="receipt-overlay">
          <div className="receipt-card animate-fade">
            <div className="receipt-status-icon receipt-status-icon--refund">
              <RotateCcw size={36} />
            </div>
            <div className="receipt-title">Refund Processed</div>
            <div className="receipt-meta">
              <div>{completedRefund.length} item(s) returned</div>
              <div>{new Date().toLocaleString()}</div>
            </div>

            <div className="receipt-items">
              {completedRefund.map((r, idx) => (
                <div key={idx} className="receipt-item">
                  <span className="receipt-item-name">{r.product_name} ×{r.quantity}</span>
                  <span className="receipt-item-subtotal mono">{formatBirr(r.refund_amount)}</span>
                </div>
              ))}
            </div>

            <div className="receipt-dashed-line" />

            <div className="receipt-totals">
              <span>Total Refunded:</span>
              <span className="mono" style={{ color: 'var(--danger-color)' }}>
                {formatBirr(completedRefund.reduce((s, r) => s + parseFloat(r.refund_amount || 0), 0))}
              </span>
            </div>

            <div className="receipt-actions">
              <button 
                type="button" 
                onClick={() => window.print()} 
                className="receipt-btn receipt-btn--secondary"
              >
                <Printer size={14} /> Print Slip
              </button>
              <button 
                type="button" 
                onClick={() => setCompletedRefund(null)} 
                className="receipt-btn receipt-btn--primary"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

