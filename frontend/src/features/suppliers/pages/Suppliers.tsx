import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Plus, Star, Mail, Phone, MapPin, Clock, Package,
  ShoppingCart, Edit2, Trash2, X, Check
} from 'lucide-react';
import { API_BASE_URL } from '../../../services/api';


interface Supplier {
  id: number;
  name: string;
  contact_email: string | null;
  phone: string | null;
  address: string | null;
  lead_time_days: number;
  rating: number;
  product_count: number;
  active_orders: number;
  created_at: string;
}

interface SupplierForm {
  name: string;
  contact_email: string;
  phone: string;
  address: string;
  lead_time_days: number;
  rating: number;
}

const emptyForm: SupplierForm = { name: '', contact_email: '', phone: '', address: '', lead_time_days: 7, rating: 4.0 };

export default function Suppliers() {
  const { isLoaded, isSignedIn } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/suppliers`);
      if (res.ok) setSuppliers(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetchSuppliers();
  }, [isLoaded, isSignedIn]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editId
        ? `${API_BASE_URL}/api/suppliers/${editId}`
        : `${API_BASE_URL}/api/suppliers`;
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setShowModal(false);
        setEditId(null);
        setForm(emptyForm);
        fetchSuppliers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;
    try {
      await fetch(`${API_BASE_URL}/api/suppliers/${id}`, { method: 'DELETE' });
      fetchSuppliers();
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (supplier: Supplier) => {
    setEditId(supplier.id);
    setForm({
      name: supplier.name,
      contact_email: supplier.contact_email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      lead_time_days: supplier.lead_time_days,
      rating: supplier.rating
    });
    setShowModal(true);
  };

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={12} className={i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-border'} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  );

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
          <h1 className="text-3xl font-bold text-foreground">Suppliers</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your supply chain partners</p>
        </div>
        <button
          onClick={() => { setEditId(null); setForm(emptyForm); setShowModal(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background font-medium text-sm hover:opacity-90 transition-all"
        >
          <Plus size={16} /> Add Supplier
        </button>
      </div>

      {/* Supplier Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-20">
          <Truck size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No suppliers yet. Add your first supplier to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map((supplier, idx) => (
            <motion.div
              key={supplier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-2xl border border-border bg-card p-6 hover:border-foreground/20 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center text-violet-400">
                    <Truck size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{supplier.name}</h3>
                    {renderStars(supplier.rating)}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(supplier)} className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-all">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(supplier.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 mb-4">
                {supplier.contact_email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail size={12} /> {supplier.contact_email}
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone size={12} /> {supplier.phone}
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin size={12} /> {supplier.address}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock size={12} /> Lead time: <span className="font-medium text-foreground">{supplier.lead_time_days} days</span>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Package size={12} className="text-violet-400" />
                  <span className="font-medium text-foreground">{supplier.product_count}</span> products
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShoppingCart size={12} className="text-emerald-400" />
                  <span className="font-medium text-foreground">{supplier.active_orders}</span> active POs
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
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
                <h3 className="text-lg font-semibold text-foreground">{editId ? 'Edit Supplier' : 'Add Supplier'}</h3>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-secondary/50"><X size={18} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Supplier Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                    placeholder="e.g., Acme Wholesale"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                    <input
                      value={form.contact_email}
                      onChange={e => setForm({ ...form, contact_email: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                      placeholder="orders@example.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
                    <input
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                      placeholder="+1-555-0101"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Address</label>
                  <input
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                    placeholder="123 Commerce Dr, City, State"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Lead Time (days)</label>
                    <input
                      type="number"
                      value={form.lead_time_days}
                      onChange={e => setForm({ ...form, lead_time_days: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Rating (1-5)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1" max="5"
                      value={form.rating}
                      onChange={e => setForm({ ...form, rating: parseFloat(e.target.value) || 1 })}
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-6 justify-end">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-secondary/50 transition-all">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={!form.name || saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  <Check size={14} /> {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
