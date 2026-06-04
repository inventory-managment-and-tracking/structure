import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, SlidersHorizontal, RefreshCw, Printer, AlertTriangle, X, Check, ArrowRightLeft } from 'lucide-react';

export default function ProductList({ token, userRole, addToCart, onStockAdjusted }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '' });

  // Filters state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Active item for stock adjustment or QR view
  const [activeProduct, setActiveProduct] = useState(null);

  // Form states
  const [newProduct, setNewProduct] = useState({
    name: '',
    unit_price: '',
    cost_price: '',
    category_id: '',
    supplier_name: '', // free-text; matched to supplier_id on submit
    size: '',
    color: '',
    quantity: '',
    low_stock_threshold: '',
    description: '',
    sku: ''
  });

  const [adjustData, setAdjustData] = useState({
    quantity_change: '',
    notes: ''
  });

  const [generatedQr, setGeneratedQr] = useState(null);

  // ── Men's clothing constants ─────────────────────────────────
  const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const SHOE_SIZES_EU = [
    { eu: '38',   cm: '24.0' }, { eu: '38.5', cm: '24.3' },
    { eu: '39',   cm: '24.7' }, { eu: '39.5', cm: '25.0' },
    { eu: '40',   cm: '25.3' }, { eu: '40.5', cm: '25.7' },
    { eu: '41',   cm: '26.0' }, { eu: '41.5', cm: '26.3' },
    { eu: '42',   cm: '26.7' }, { eu: '42.5', cm: '27.0' },
    { eu: '43',   cm: '27.3' }, { eu: '43.5', cm: '27.7' },
    { eu: '44',   cm: '28.0' }, { eu: '44.5', cm: '28.3' },
    { eu: '45',   cm: '28.7' }, { eu: '45.5', cm: '29.0' },
    { eu: '46',   cm: '29.3' }, { eu: '46.5', cm: '29.7' },
    { eu: '47',   cm: '30.0' }
  ];
  const MEN_COLORS = [
    'Black', 'White', 'Navy Blue', 'Charcoal Gray', 'Light Gray',
    'Olive Green', 'Khaki / Beige', 'Burgundy', 'Brown', 'Camel',
    'Royal Blue', 'Sky Blue', 'Forest Green', 'Mustard Yellow',
    'Red', 'Off-White / Cream', 'Teal', 'Maroon', 'Dark Green', 'Coral'
  ];

  // Returns 'shoes' | 'none' | 'clothing' based on selected category
  const getSizeType = (categoryId) => {
    if (!categoryId) return 'clothing';
    const cat = categories.find(c => String(c.id) === String(categoryId));
    if (!cat) return 'clothing';
    const n = cat.name.toLowerCase();
    if (n.includes('shoe') || n.includes('boot')) return 'shoes';
    if (n.includes('neck tie') || n.includes('necktie') || n.includes('tie')) return 'none';
    return 'clothing';
  };

  // Supplier history backed by localStorage for autocomplete hints
  const getSupplierHistory = () => {
    try { return JSON.parse(localStorage.getItem('supplier_history') || '[]'); }
    catch { return []; }
  };
  const saveSupplierToHistory = (name) => {
    if (!name?.trim()) return;
    const hist = getSupplierHistory();
    const updated = [name.trim(), ...hist.filter(h => h !== name.trim())].slice(0, 10);
    localStorage.setItem('supplier_history', JSON.stringify(updated));
  };

  // Fetch all products, categories, suppliers
  const fetchData = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (categoryFilter) query.append('category_id', categoryFilter);
      if (sizeFilter) query.append('size', sizeFilter);
      if (colorFilter) query.append('color', colorFilter);

      const headers = { 'Authorization': `Bearer ${token}` };

      const [prodRes, catRes, supRes] = await Promise.all([
        fetch(`/api/products?${query.toString()}`, { headers }),
        fetch('/api/categories', { headers }),
        fetch('/api/suppliers', { headers })
      ]);

      if (prodRes.status === 401 || catRes.status === 401 || supRes.status === 401) {
        window.dispatchEvent(new Event('unauthorized'));
        return;
      }

      const prodData = await prodRes.json();
      const catData = await catRes.json();
      const supData = await supRes.json();

      if (prodData.success) setProducts(prodData.data);
      if (catData.success) setCategories(catData.data);
      if (supData.success) setSuppliers(supData.data);

    } catch (err) {
      console.error('[FETCH DATA ERR]', err);
      setError('Failed to fetch data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, categoryFilter, sizeFilter, colorFilter, token]);

  const [addError, setAddError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = (product) => {
    addToCart(product);
    setToast({ show: true, message: `"${product.name}" added to checkout` });
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 2500);
  };

  const handleAddProduct = async () => {
    setAddError('');

    // Manual validation for required fields
    if (!newProduct.name.trim()) {
      setAddError('Product name is required');
      return;
    }
    if (!newProduct.unit_price || parseFloat(newProduct.unit_price) <= 0) {
      setAddError('Retail price must be greater than 0');
      return;
    }

    setIsAdding(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Build a clean body — only include fields with actual values
      const body = { name: newProduct.name.trim() };
      body.unit_price = parseFloat(newProduct.unit_price);
      if (newProduct.cost_price) body.cost_price = parseFloat(newProduct.cost_price);
      if (newProduct.category_id) body.category_id = parseInt(newProduct.category_id, 10);
      // Match typed supplier name to a known DB supplier (optional)
      if (newProduct.supplier_name?.trim()) {
        const matched = suppliers.find(s => s.name.toLowerCase() === newProduct.supplier_name.trim().toLowerCase());
        if (matched) body.supplier_id = matched.id;
        saveSupplierToHistory(newProduct.supplier_name.trim());
      }
      if (newProduct.size) body.size = newProduct.size.trim();
      if (newProduct.color) body.color = newProduct.color.trim();
      body.quantity = newProduct.quantity ? parseInt(newProduct.quantity, 10) : 0;
      body.low_stock_threshold = newProduct.low_stock_threshold ? parseInt(newProduct.low_stock_threshold, 10) : 5;
      if (newProduct.sku) body.sku = newProduct.sku.trim();
      if (newProduct.description) body.description = newProduct.description.trim();

      const res = await fetch('/api/products', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!data.success) {
        // Handle express-validator array errors
        if (data.errors && Array.isArray(data.errors)) {
          throw new Error(data.errors.map(e => e.msg).join(', '));
        }
        throw new Error(data.message || 'Failed to create product');
      }

      setShowAddModal(false);
      setAddError('');
      setNewProduct({
        name: '', unit_price: '', cost_price: '', category_id: '',
        supplier_name: '', size: '', color: '', quantity: '',
        low_stock_threshold: '', description: '', sku: ''
      });
      fetchData();
    } catch (err) {
      console.error('[ADD PRODUCT ERR]', err);
      setAddError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const res = await fetch(`/api/products/${activeProduct.id}/adjust-stock`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          quantity_change: parseInt(adjustData.quantity_change, 10),
          notes: adjustData.notes
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Adjustment failed');

      setShowAdjustModal(false);
      setAdjustData({ quantity_change: '', notes: '' });
      fetchData();
      window.dispatchEvent(new Event('stock-changed'));
    } catch (err) {
      alert(err.message);
    }
  };

  const triggerQrGenerate = async (product) => {
    try {
      setActiveProduct(product);
      const res = await fetch(`/api/qr/generate/${product.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ copies: 1, print_method: 'qr' })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to generate QR');

      setGeneratedQr(data.data.qr_image);
      setShowQrModal(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const isRestricted = userRole === 'cashier';

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-title-section">
          <h2 className="page-title">Inventory Catalog</h2>
          <p className="page-description">Manage product details, SKU codes, manual adjustments and print labels</p>
        </div>
        {!isRestricted && (
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus size={16} /> Add Product
          </button>
        )}
      </div>

      <div className="inventory-filters-panel bg-glass" style={{ padding: '16px', borderRadius: '14px' }}>
        <div className="filter-input-wrap" style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-dim)' }} />
          <input
            type="text"
            placeholder="Search catalog by product name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        <div className="filter-dropdown-wrap">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="filter-dropdown-wrap" style={{ width: '100px' }}>
          <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
            <option value="">Size</option>
            <option value="S">S</option>
            <option value="M">M</option>
            <option value="L">L</option>
            <option value="XL">XL</option>
            <option value="XXL">XXL</option>
          </select>
        </div>

        <button 
          onClick={fetchData} 
          className="btn-secondary" 
          style={{ padding: '12px', borderRadius: '8px' }}
          title="Refresh table data"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="premium-table-card">
        <div className="premium-table-scroll">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Product Info</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Size / Color</th>
                <th>Price</th>
                {!isRestricted && <th>Cost Value</th>}
                <th>Current Stock</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isRestricted ? 7 : 8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                    Loading inventory catalog...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={isRestricted ? 7 : 8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                    No products matching your search criteria
                  </td>
                </tr>
              ) : (
                products.map(p => {
                  const isLow = p.quantity <= p.low_stock_threshold;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{p.supplier_name || 'No vendor'}</div>
                      </td>
                      <td className="mono" style={{ fontSize: '12px', fontWeight: '500' }}>{p.sku}</td>
                      <td>
                        <span className="badge-ui gray">{p.category_name || 'General'}</span>
                      </td>
                      <td style={{ fontSize: '13px' }}>
                        {p.size || '—'} / {p.color || '—'}
                      </td>
                      <td className="mono" style={{ fontWeight: '700' }}>${parseFloat(p.unit_price).toFixed(2)}</td>
                      {!isRestricted && <td className="mono" style={{ color: 'var(--text-muted)' }}>${p.cost_price ? parseFloat(p.cost_price).toFixed(2) : '—'}</td>}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="mono" style={{ fontWeight: '700', fontSize: '15px' }}>{p.quantity}</span>
                          {isLow ? (
                            <span className="badge-ui red" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', fontSize: '10px' }} title="Low stock threshold alert">
                              <AlertTriangle size={10} /> Low
                            </span>
                          ) : (
                            <span className="badge-ui green" style={{ padding: '2px 6px', fontSize: '10px' }}>OK</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleAddToCart(p)}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--primary-glow)', color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
                            disabled={p.quantity <= 0}
                          >
                            Add to Cart
                          </button>
                          
                          <button
                            onClick={() => triggerQrGenerate(p)}
                            className="btn-secondary"
                            style={{ padding: '6px' }}
                            title="Generate & View QR Label"
                          >
                            <Printer size={14} />
                          </button>

                          {!isRestricted && (
                            <button
                              onClick={() => {
                                setActiveProduct(p);
                                setShowAdjustModal(true);
                              }}
                              className="btn-secondary"
                              style={{ padding: '6px' }}
                              title="Manual Stock Adjustment"
                            >
                              <ArrowRightLeft size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Modal: Add Product */}
      {showAddModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content bg-glass">
            <div className="modal-header">
              <h3 style={{ fontSize: '18px' }}>Register New Product</h3>
              <button onClick={() => { setShowAddModal(false); setAddError(''); }} className="modal-close-btn"><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Product Name */}
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Slim Fit Oxford Shirt"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                />
              </div>

              {/* Retail + Cost Price */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Retail Price ($) *</label>
                  <input type="number" step="0.01" placeholder="29.99"
                    value={newProduct.unit_price}
                    onChange={(e) => setNewProduct({ ...newProduct, unit_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cost Price ($)</label>
                  <input type="number" step="0.01" placeholder="12.50"
                    value={newProduct.cost_price}
                    onChange={(e) => setNewProduct({ ...newProduct, cost_price: e.target.value })} />
                </div>
              </div>

              {/* Category — full width, drives size logic */}
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  value={newProduct.category_id}
                  onChange={(e) => {
                    const newCatId = e.target.value;
                    const sizeType = getSizeType(newCatId);
                    setNewProduct({ ...newProduct, category_id: newCatId, size: sizeType === 'none' ? 'One Size' : '' });
                  }}
                >
                  <option value="">Select Men's Category</option>
                  {[...new Map(categories.map(c => [c.id, c])).values()].map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Supplier — optional free-text with history hints */}
              <div className="form-group">
                <label className="form-label">
                  Supplier{' '}
                  <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-dim)' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  list="supplier-hints-list"
                  placeholder="Type supplier name — previous entries appear as hints"
                  value={newProduct.supplier_name}
                  onChange={(e) => setNewProduct({ ...newProduct, supplier_name: e.target.value })}
                  autoComplete="off"
                />
                <datalist id="supplier-hints-list">
                  {suppliers.map(s => <option key={s.id} value={s.name} />)}
                  {getSupplierHistory()
                    .filter(h => !suppliers.some(s => s.name === h))
                    .map(h => <option key={h} value={h} />)}
                </datalist>
              </div>

              {/* Size (category-aware) + Color */}
              <div className="form-grid-2">
                <div className="form-group">
                  {getSizeType(newProduct.category_id) === 'clothing' && (
                    <>
                      <label className="form-label">Size</label>
                      <select value={newProduct.size}
                        onChange={(e) => setNewProduct({ ...newProduct, size: e.target.value })}>
                        <option value="">Select Clothing Size</option>
                        {CLOTHING_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </>
                  )}
                  {getSizeType(newProduct.category_id) === 'shoes' && (
                    <>
                      <label className="form-label">Shoe Size (EU)</label>
                      <select value={newProduct.size}
                        onChange={(e) => setNewProduct({ ...newProduct, size: e.target.value })}>
                        <option value="">Select EU Size</option>
                        {SHOE_SIZES_EU.map(s => (
                          <option key={s.eu} value={`EU ${s.eu}`}>EU {s.eu} — ≈{s.cm} cm</option>
                        ))}
                      </select>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                        EU sizing — measure foot heel to toe
                      </span>
                    </>
                  )}
                  {getSizeType(newProduct.category_id) === 'none' && (
                    <>
                      <label className="form-label">Size</label>
                      <input type="text" value="One Size Fits All" disabled
                        style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                        Neck ties are one-size-fits-all
                      </span>
                    </>
                  )}
                </div>

                {/* Color — datalist with common men's colors, free-type allowed */}
                <div className="form-group">
                  <label className="form-label">Color</label>
                  <input
                    type="text"
                    list="men-colors-list"
                    placeholder="e.g. Navy Blue (or type custom)"
                    value={newProduct.color}
                    onChange={(e) => setNewProduct({ ...newProduct, color: e.target.value })}
                    autoComplete="off"
                  />
                  <datalist id="men-colors-list">
                    {MEN_COLORS.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              {/* Qty + Low Stock Threshold */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Initial Quantity</label>
                  <input type="number" placeholder="10"
                    value={newProduct.quantity}
                    onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Low Stock Warning Threshold</label>
                  <input type="number" placeholder="5"
                    value={newProduct.low_stock_threshold}
                    onChange={(e) => setNewProduct({ ...newProduct, low_stock_threshold: e.target.value })} />
                </div>
              </div>

              {/* SKU */}
              <div className="form-group">
                <label className="form-label">SKU (Leave blank to auto-generate)</label>
                <input type="text" placeholder="e.g. CLT-20250601-0001"
                  value={newProduct.sku}
                  onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} />
              </div>

              {addError && (
                <div style={{ background: 'var(--danger-glow)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)', padding: '10px', borderRadius: '6px', fontSize: '12px', textAlign: 'center' }}>
                  {addError}
                </div>
              )}

              <button type="button" className="submit-btn" style={{ marginTop: '10px' }}
                disabled={isAdding} onClick={handleAddProduct}>
                {isAdding ? 'Registering...' : 'Register Product'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* 2. Modal: Manual Stock Adjustment */}
      {showAdjustModal && activeProduct && createPortal(
        <div className="modal-overlay">
          <div className="modal-content bg-glass">
            <div className="modal-header">
              <h3 style={{ fontSize: '18px' }}>Adjust Stock levels</h3>
              <button onClick={() => setShowAdjustModal(false)} className="modal-close-btn"><X size={18} /></button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Modifying quantity of <strong>{activeProduct.name}</strong> (SKU: {activeProduct.sku})
            </p>
            <form onSubmit={handleAdjustStock} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Quantity Change (Use negative for subtraction) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 20 (or -5)"
                  value={adjustData.quantity_change}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity_change: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Adjustment Logs Note *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Replenishment shipment arrived from supplier"
                  value={adjustData.notes}
                  onChange={(e) => setAdjustData({ ...adjustData, notes: e.target.value })}
                />
              </div>

              <button type="submit" className="submit-btn">Apply Adjustment</button>
            </form>
          </div>
        </div>
      , document.body)}

      {/* 3. Modal: QR Preview */}
      {showQrModal && activeProduct && generatedQr && createPortal(
        <div className="modal-overlay">
          <div className="modal-content bg-glass" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px' }}>Product QR Label</h3>
              <button onClick={() => setShowQrModal(false)} className="modal-close-btn"><X size={18} /></button>
            </div>
            
            <div className="qr-preview-wrapper animate-fade">
              <div className="qr-image-frame">
                <img src={generatedQr} alt={`QR Code for ${activeProduct.sku}`} />
              </div>
              <div className="qr-print-tag-sku">{activeProduct.sku}</div>
              <div className="qr-print-tag-name">{activeProduct.name}</div>
            </div>

            <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '16px' }}>
              QR label generated from the unique SKU. This tag can be physically printed and attached to the clothing hangers.
            </p>

            <button 
              onClick={() => {
                const win = window.open();
                win.document.write(`<div style="display:flex; flex-direction:column; align-items:center; font-family:sans-serif; padding:20px;">
                  <img src="${generatedQr}" width="220" />
                  <div style="font-size:14px; font-weight:bold; margin-top:8px;">${activeProduct.sku}</div>
                  <div style="font-size:12px; color:#444;">${activeProduct.name}</div>
                </div>`);
                win.print();
              }}
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Print Label Tag
            </button>
          </div>
        </div>
      , document.body)}

      {toast.show && (
        <div className="custom-toast bg-glass animate-fade">
          <span className="toast-icon">✓</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
