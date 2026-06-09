import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, RefreshCw, Printer, AlertTriangle, X, ArrowRightLeft, Pencil, Trash2 } from 'lucide-react';
import { formatBirr } from '../utils/formatBirr';

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
  const getProductSupplierHint = (productId) => {
    try {
      const map = JSON.parse(localStorage.getItem('product_supplier_hints') || '{}');
      return map[productId] || '';
    } catch { return ''; }
  };
  const saveProductSupplierHint = (productId, name) => {
    if (!productId || !name?.trim()) return;
    try {
      const map = JSON.parse(localStorage.getItem('product_supplier_hints') || '{}');
      map[productId] = name.trim();
      localStorage.setItem('product_supplier_hints', JSON.stringify(map));
    } catch { /* ignore */ }
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
  const [editProduct, setEditProduct] = useState(null);
  const [editError, setEditError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStrategy, setDeleteStrategy] = useState('write_off');
  const [replacementName, setReplacementName] = useState('');

  const showToast = (message) => {
    setToast({ show: true, message });
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 2500);
  };

  const handleAddToCart = (product) => {
    addToCart(product);
    showToast(`"${product.name}" added to checkout`);
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
      if (newProduct.supplier_name?.trim()) {
        const name = newProduct.supplier_name.trim();
        const matched = suppliers.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (matched) body.supplier_id = matched.id;
        else body.supplier_name = name;
        saveSupplierToHistory(name);
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

      if (newProduct.supplier_name?.trim() && data.data?.id) {
        saveProductSupplierHint(data.data.id, newProduct.supplier_name.trim());
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

  const openEditModal = (product) => {
    setEditProduct({
      id: product.id,
      name: product.name,
      unit_price: String(product.unit_price),
      cost_price: product.cost_price != null ? String(product.cost_price) : '',
      category_id: product.category_id ? String(product.category_id) : '',
      supplier_name: product.supplier_name
        || getProductSupplierHint(product.id)
        || (!product.supplier_id ? getSupplierHistory()[0] : '')
        || '',
      size: product.size || '',
      color: product.color || '',
      low_stock_threshold: product.low_stock_threshold != null ? String(product.low_stock_threshold) : '5',
      description: product.description || '',
      sku: product.sku,
      quantity: product.quantity,
    });
    setEditError('');
    setShowEditModal(true);
  };

  const buildProductBody = (form, { includeQuantity = false } = {}) => {
    const body = { name: form.name.trim() };
    body.unit_price = parseFloat(form.unit_price);
    if (form.cost_price) body.cost_price = parseFloat(form.cost_price);
    if (form.category_id) body.category_id = parseInt(form.category_id, 10);
    if (form.supplier_name?.trim()) {
      const name = form.supplier_name.trim();
      const matched = suppliers.find(s => s.name.toLowerCase() === name.toLowerCase());
      if (matched) body.supplier_id = matched.id;
      else body.supplier_name = name;
      saveSupplierToHistory(name);
    }
    if (form.size) body.size = form.size.trim();
    if (form.color) body.color = form.color.trim();
    if (includeQuantity) {
      body.quantity = form.quantity ? parseInt(form.quantity, 10) : 0;
    }
    body.low_stock_threshold = form.low_stock_threshold ? parseInt(form.low_stock_threshold, 10) : 5;
    if (form.sku) body.sku = form.sku.trim();
    if (form.description) body.description = form.description.trim();
    return body;
  };

  const handleEditProduct = async () => {
    if (!editProduct) return;
    setEditError('');

    if (!editProduct.name.trim()) {
      setEditError('Product name is required');
      return;
    }
    if (!editProduct.unit_price || parseFloat(editProduct.unit_price) <= 0) {
      setEditError('Retail price must be greater than 0');
      return;
    }

    setIsEditing(true);
    try {
      const body = buildProductBody(editProduct);
      const res = await fetch(`/api/products/${editProduct.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        window.dispatchEvent(new Event('unauthorized'));
        return;
      }

      const data = await res.json();
      if (!data.success) {
        if (data.errors && Array.isArray(data.errors)) {
          throw new Error(data.errors.map(e => e.msg).join(', '));
        }
        throw new Error(data.message || 'Failed to update product');
      }

      if (editProduct.supplier_name?.trim()) {
        saveProductSupplierHint(editProduct.id, editProduct.supplier_name.trim());
      }

      setShowEditModal(false);
      setEditProduct(null);
      fetchData();
      showToast(`"${data.data.name}" updated`);
    } catch (err) {
      console.error('[EDIT PRODUCT ERR]', err);
      setEditError(err.message);
    } finally {
      setIsEditing(false);
    }
  };

  const openDeleteModal = (product) => {
    setActiveProduct(product);
    setDeleteStrategy('write_off');
    setReplacementName('');
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const handleDeleteProduct = async () => {
    if (!activeProduct) return;
    setDeleteError('');

    if (activeProduct.quantity > 0 && deleteStrategy === 'transfer' && !replacementName.trim()) {
      setDeleteError('Enter a name for the new product to receive the stock');
      return;
    }

    setIsDeleting(true);
    try {
      const body = activeProduct.quantity > 0
        ? {
            strategy: deleteStrategy,
            ...(deleteStrategy === 'transfer' ? { replacement_name: replacementName.trim() } : {}),
          }
        : undefined;

      const res = await fetch(`/api/products/${activeProduct.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 401) {
        window.dispatchEvent(new Event('unauthorized'));
        return;
      }

      const data = await res.json();
      if (!data.success) {
        if (data.errors && Array.isArray(data.errors)) {
          throw new Error(data.errors.map(e => e.msg).join(', '));
        }
        throw new Error(data.message || 'Failed to remove product');
      }

      setShowDeleteModal(false);
      setActiveProduct(null);
      fetchData();
      if (onStockAdjusted) onStockAdjusted();

      if (data.data.new_product) {
        showToast(`"${data.data.product.name}" removed — stock moved to "${data.data.new_product.name}"`);
      } else {
        showToast(data.data.message || `"${data.data.product.name}" removed from catalog`);
      }
    } catch (err) {
      console.error('[DELETE PRODUCT ERR]', err);
      setDeleteError(err.message);
    } finally {
      setIsDeleting(false);
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

  const isRestricted = userRole === 'sales';
  const isOwner = userRole === 'owner';

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

      <div className="inventory-filters-panel responsive-filter-bar bg-glass">
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

        <div className="filter-dropdown-wrap filter-dropdown-size">
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

      <div className="premium-table-card inventory-table-desktop">
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
                      <td className="mono" style={{ fontWeight: '700' }}>{formatBirr(p.unit_price)}</td>
                      {!isRestricted && <td className="mono" style={{ color: 'var(--text-muted)' }}>{p.cost_price ? formatBirr(p.cost_price) : '—'}</td>}
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

                          {isOwner && (
                            <>
                              <button
                                onClick={() => openEditModal(p)}
                                className="btn-secondary"
                                style={{ padding: '6px' }}
                                title="Edit Product"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => openDeleteModal(p)}
                                className="btn-secondary"
                                style={{ padding: '6px', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                                title="Remove Product"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
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

      <div className="inventory-card-list">
        {loading ? (
          <div className="inventory-card-empty">Loading inventory catalog...</div>
        ) : products.length === 0 ? (
          <div className="inventory-card-empty">No products matching your search criteria</div>
        ) : (
          products.map((p) => {
            const isLow = p.quantity <= p.low_stock_threshold;
            return (
              <div key={p.id} className="inventory-card bg-glass">
                <div className="inventory-card-header">
                  <div>
                    <div className="inventory-card-name">{p.name}</div>
                    <div className="inventory-card-sku mono">{p.sku}</div>
                  </div>
                  <span className="badge-ui gray">{p.category_name || 'General'}</span>
                </div>
                <div className="inventory-card-meta">
                  <span>{p.size || '—'} / {p.color || '—'}</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{formatBirr(p.unit_price)}</span>
                </div>
                <div className="inventory-card-stock">
                  <span className="mono" style={{ fontWeight: 700, fontSize: '15px' }}>{p.quantity} in stock</span>
                  {isLow ? (
                    <span className="badge-ui red"><AlertTriangle size={10} /> Low</span>
                  ) : (
                    <span className="badge-ui green">OK</span>
                  )}
                </div>
                <div className="inventory-card-actions">
                  <button
                    onClick={() => handleAddToCart(p)}
                    className="btn-secondary inventory-card-btn"
                    disabled={p.quantity <= 0}
                  >
                    Add to Cart
                  </button>
                  <button onClick={() => triggerQrGenerate(p)} className="btn-secondary inventory-card-icon-btn" title="Generate QR">
                    <Printer size={14} />
                  </button>
                  {!isRestricted && (
                    <button
                      onClick={() => { setActiveProduct(p); setShowAdjustModal(true); }}
                      className="btn-secondary inventory-card-icon-btn"
                      title="Adjust Stock"
                    >
                      <ArrowRightLeft size={14} />
                    </button>
                  )}
                  {isOwner && (
                    <>
                      <button onClick={() => openEditModal(p)} className="btn-secondary inventory-card-icon-btn" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => openDeleteModal(p)} className="btn-secondary inventory-card-icon-btn inventory-card-btn-danger" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
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
                  <label className="form-label">Retail Price (Br) *</label>
                  <input type="number" step="0.01" placeholder="29.99"
                    value={newProduct.unit_price}
                    onChange={(e) => setNewProduct({ ...newProduct, unit_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cost Price (Br)</label>
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

      {/* 1b. Modal: Edit Product (owner only) */}
      {showEditModal && editProduct && createPortal(
        <div className="modal-overlay">
          <div className="modal-content bg-glass">
            <div className="modal-header">
              <h3 style={{ fontSize: '18px' }}>Edit Product</h3>
              <button onClick={() => { setShowEditModal(false); setEditProduct(null); setEditError(''); }} className="modal-close-btn"><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">SKU</label>
                  <input type="text" value={editProduct.sku} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Current Stock</label>
                  <input type="text" value={editProduct.quantity} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                    Use the stock adjust button to change quantity
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input
                  type="text"
                  value={editProduct.name}
                  onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Retail Price (Br) *</label>
                  <input type="number" step="0.01"
                    value={editProduct.unit_price}
                    onChange={(e) => setEditProduct({ ...editProduct, unit_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cost Price (Br)</label>
                  <input type="number" step="0.01"
                    value={editProduct.cost_price}
                    onChange={(e) => setEditProduct({ ...editProduct, cost_price: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  value={editProduct.category_id}
                  onChange={(e) => {
                    const newCatId = e.target.value;
                    const sizeType = getSizeType(newCatId);
                    setEditProduct({
                      ...editProduct,
                      category_id: newCatId,
                      size: sizeType === 'none' ? 'One Size' : editProduct.size,
                    });
                  }}
                >
                  <option value="">Select Men's Category</option>
                  {[...new Map(categories.map(c => [c.id, c])).values()].map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Supplier <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-dim)' }}>(optional)</span></label>
                <input
                  type="text"
                  list="supplier-hints-edit"
                  value={editProduct.supplier_name}
                  onChange={(e) => setEditProduct({ ...editProduct, supplier_name: e.target.value })}
                  autoComplete="off"
                />
                <datalist id="supplier-hints-edit">
                  {suppliers.map(s => <option key={s.id} value={s.name} />)}
                </datalist>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  {getSizeType(editProduct.category_id) === 'clothing' && (
                    <>
                      <label className="form-label">Size</label>
                      <select value={editProduct.size}
                        onChange={(e) => setEditProduct({ ...editProduct, size: e.target.value })}>
                        <option value="">Select Clothing Size</option>
                        {CLOTHING_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </>
                  )}
                  {getSizeType(editProduct.category_id) === 'shoes' && (
                    <>
                      <label className="form-label">Shoe Size (EU)</label>
                      <select value={editProduct.size}
                        onChange={(e) => setEditProduct({ ...editProduct, size: e.target.value })}>
                        <option value="">Select EU Size</option>
                        {SHOE_SIZES_EU.map(s => (
                          <option key={s.eu} value={`EU ${s.eu}`}>EU {s.eu} — ≈{s.cm} cm</option>
                        ))}
                      </select>
                    </>
                  )}
                  {getSizeType(editProduct.category_id) === 'none' && (
                    <>
                      <label className="form-label">Size</label>
                      <input type="text" value="One Size Fits All" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                    </>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Color</label>
                  <input
                    type="text"
                    list="men-colors-edit"
                    value={editProduct.color}
                    onChange={(e) => setEditProduct({ ...editProduct, color: e.target.value })}
                    autoComplete="off"
                  />
                  <datalist id="men-colors-edit">
                    {MEN_COLORS.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Low Stock Warning Threshold</label>
                <input type="number"
                  value={editProduct.low_stock_threshold}
                  onChange={(e) => setEditProduct({ ...editProduct, low_stock_threshold: e.target.value })} />
              </div>

              {editError && (
                <div style={{ background: 'var(--danger-glow)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)', padding: '10px', borderRadius: '6px', fontSize: '12px', textAlign: 'center' }}>
                  {editError}
                </div>
              )}

              <button type="button" className="submit-btn" disabled={isEditing} onClick={handleEditProduct}>
                {isEditing ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* 1c. Modal: Delete Product (owner only) */}
      {showDeleteModal && activeProduct && createPortal(
        <div className="modal-overlay">
          <div className="modal-content bg-glass delete-product-modal">
            <div className="modal-header">
              <h3 style={{ fontSize: '18px' }}>Remove Product</h3>
              <button onClick={() => { setShowDeleteModal(false); setDeleteError(''); }} className="modal-close-btn"><X size={18} /></button>
            </div>

            {activeProduct.quantity === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Remove <strong>{activeProduct.name}</strong> ({activeProduct.sku}) from the catalog?
                  This product has no stock on hand.
                </p>
                {deleteError && (
                  <div style={{ background: 'var(--danger-glow)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)', padding: '10px', borderRadius: '6px', fontSize: '12px', textAlign: 'center' }}>
                    {deleteError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowDeleteModal(false)}>
                    Cancel
                  </button>
                  <button type="button" className="submit-btn" style={{ flex: 1, background: 'var(--danger-color)' }} disabled={isDeleting} onClick={handleDeleteProduct}>
                    {isDeleting ? 'Removing...' : 'Remove from Catalog'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <strong>{activeProduct.name}</strong> has <strong>{activeProduct.quantity}</strong> units in stock.
                  Choose how to handle the remaining inventory before removing this listing.
                </p>

                <div className="delete-choice-cards">
                  <label className={`delete-choice-card ${deleteStrategy === 'write_off' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="deleteStrategy"
                      value="write_off"
                      checked={deleteStrategy === 'write_off'}
                      onChange={() => setDeleteStrategy('write_off')}
                    />
                    <div>
                      <div className="delete-choice-title">Write off as waste</div>
                      <div className="delete-choice-desc">
                        Remove all {activeProduct.quantity} units as a store loss. Inventory is reduced and the product is removed from the catalog.
                      </div>
                    </div>
                  </label>

                  <label className={`delete-choice-card ${deleteStrategy === 'transfer' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="deleteStrategy"
                      value="transfer"
                      checked={deleteStrategy === 'transfer'}
                      onChange={() => setDeleteStrategy('transfer')}
                    />
                    <div>
                      <div className="delete-choice-title">Transfer to new product</div>
                      <div className="delete-choice-desc">
                        Create a new product listing and move all stock there. The current listing is then removed.
                      </div>
                    </div>
                  </label>
                </div>

                {deleteStrategy === 'transfer' && (
                  <div className="form-group">
                    <label className="form-label">New product name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Slim Fit Oxford Shirt — Revised"
                      value={replacementName}
                      onChange={(e) => setReplacementName(e.target.value)}
                    />
                  </div>
                )}

                {deleteError && (
                  <div style={{ background: 'var(--danger-glow)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)', padding: '10px', borderRadius: '6px', fontSize: '12px', textAlign: 'center' }}>
                    {deleteError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowDeleteModal(false)}>
                    Cancel
                  </button>
                  <button type="button" className="submit-btn" style={{ flex: 1, background: 'var(--danger-color)' }} disabled={isDeleting} onClick={handleDeleteProduct}>
                    {isDeleting ? 'Processing...' : 'Confirm Removal'}
                  </button>
                </div>
              </div>
            )}
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
