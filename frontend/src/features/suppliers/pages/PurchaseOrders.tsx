import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Plus, Package, Truck, Warehouse, Calendar,
  Clock, CheckCircle2, FileText,
  AlertTriangle, DollarSign, X
} from 'lucide-react';
import { API_BASE_URL } from '../../../services/api';
import { cn } from '../../../lib/utils';
import type { Product } from '../../../types';

interface Supplier {
  id: number;
  name: string;
}

interface WarehouseData {
  id: number;
  name: string;
}

interface PurchaseOrder {
  id: number;
  supplier_id: number;
  supplier_name: string;
  product_id: number;
  product_name: string;
  product_sku: string;
  warehouse_id: number | null;
  warehouse_name: string | null;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  status: string;
  order_date: string;
  expected_delivery: string | null;
  notes: string | null;
  created_at: string;
}

interface POForm {
  supplier_id: number;
  product_id: number;
  warehouse_id: number | '';
  quantity: number;
  unit_cost: number;
  notes: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-secondary/50 text-muted-foreground border-border',
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  shipped: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  delivered: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
};

export default function PurchaseOrders() {
  const { isLoaded, isSignedIn } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<POForm>({ supplier_id: 0, product_id: 0, warehouse_id: '', quantity: 100, unit_cost: 0, notes: '' });

  const fetchData = async () => {
    try {
      const [poRes, supRes, prodRes, whRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/purchase-orders`),
        fetch(`${API_BASE_URL}/api/suppliers`),
        fetch(`${API_BASE_URL}/api/products`),
        fetch(`${API_BASE_URL}/api/warehouses`)
      ]);
      
      if (poRes.ok) setOrders(await poRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
      if (whRes.ok) setWarehouses(await whRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetchData();
  }, [isLoaded, isSignedIn]);

  const handleProductSelect = (productId: number) => {
    const product = products.find(p => p.id === productId);
    setForm(prev => ({ ...prev, product_id: productId, unit_cost: product ? product.price * 0.6 : prev.unit_cost }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          warehouse_id: form.warehouse_id === '' ? null : form.warehouse_id
        })
      });
      if (res.ok) {
        setShowModal(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/purchase-orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen px-4 md:px-8 py-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage inbound inventory from suppliers</p>
        </div>
        <button
          onClick={() => {
            setForm({ supplier_id: suppliers[0]?.id || 0, product_id: products[0]?.id || 0, warehouse_id: '', quantity: 100, unit_cost: (products[0]?.price || 100) * 0.6, notes: '' });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background font-medium text-sm hover:opacity-90 transition-all"
        >
          <Plus size={16} /> Create PO
        </button>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingCart size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No purchase orders yet. Create one to restock inventory.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order, idx) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-2xl border border-border bg-card p-4 hover:border-foreground/20 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Product & Supplier Info */}
                <div className="flex items-center gap-4 min-w-[300px]">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <FileText size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">PO-{(1000 + order.id).toString()}</h3>
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wide", STATUS_COLORS[order.status] || STATUS_COLORS['draft'])}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-0.5">{order.product_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Truck size={12} /> {order.supplier_name}</span>
                      <span>•</span>
                      <span>SKU: {order.product_sku}</span>
                    </div>
                  </div>
                </div>

                {/* Quantities & Dates */}
                <div className="flex flex-row md:flex-col gap-4 md:gap-2 text-sm md:text-right">
                  <div className="flex items-center md:justify-end gap-1.5 text-foreground">
                    <Package size={14} className="text-muted-foreground" />
                    <span className="font-semibold">{order.quantity}</span> units
                  </div>
                  <div className="flex items-center md:justify-end gap-1.5 text-muted-foreground text-xs">
                    <DollarSign size={12} />
                    {(order.total_cost || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} total
                  </div>
                </div>

                {/* Logistics */}
                <div className="hidden lg:flex flex-col gap-2 text-xs text-muted-foreground border-l border-border pl-6">
                  <div className="flex items-center gap-2">
                    <Warehouse size={12} /> {order.warehouse_name || 'Unassigned'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={12} /> Ordered: {new Date(order.order_date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={12} /> ETA: {order.expected_delivery ? new Date(order.expected_delivery).toLocaleDateString() : 'N/A'}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 border-t md:border-t-0 pt-4 md:pt-0">
                  <select
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    disabled={order.status === 'delivered' || order.status === 'cancelled'}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-medium border border-border bg-secondary/50 focus:outline-none focus:border-foreground/30 appearance-none pr-8 relative",
                      (order.status === 'delivered' || order.status === 'cancelled') && "opacity-50 cursor-not-allowed"
                    )}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                  >
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <ShoppingCart size={18} /> Create Purchase Order
                </h3>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-secondary/50"><X size={18} /></button>
              </div>

              {suppliers.length === 0 || products.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm flex gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <p>You need to add at least one Supplier and one Product before creating a Purchase Order.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Supplier</label>
                    <select
                      value={form.supplier_id}
                      onChange={e => setForm({ ...form, supplier_id: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                    >
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Product</label>
                    <select
                      value={form.product_id}
                      onChange={e => handleProductSelect(parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                    >
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Quantity (Units)</label>
                      <input
                        type="number" min="1"
                        value={form.quantity}
                        onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                        className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Unit Cost (₹)</label>
                      <input
                        type="number" step="0.01" min="0"
                        value={form.unit_cost}
                        onChange={e => setForm({ ...form, unit_cost: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Destination Warehouse</label>
                    <select
                      value={form.warehouse_id}
                      onChange={e => setForm({ ...form, warehouse_id: e.target.value ? parseInt(e.target.value) : '' })}
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                    >
                      <option value="">-- No specific warehouse --</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                    <textarea
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30 min-h-[80px] resize-none"
                      placeholder="Optional order notes..."
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 mt-2 rounded-xl bg-secondary/20 border border-border">
                    <span className="text-sm font-medium text-foreground">Estimated Total:</span>
                    <span className="text-lg font-bold text-foreground">
                      {(form.quantity * form.unit_cost).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mt-6 justify-end">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-secondary/50 transition-all">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={saving || suppliers.length === 0 || products.length === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  <CheckCircle2 size={14} /> {saving ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
