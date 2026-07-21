import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Warehouse, Plus, MapPin, Package, ArrowRightLeft,
  X, Box
} from 'lucide-react';
import { API_BASE_URL } from '../../../services/api';
import { cn } from '../../../lib/utils';


interface WarehouseData {
  id: number;
  name: string;
  location: string | null;
  capacity: number;
  is_primary: boolean;
  total_stock: number;
  utilization_pct: number;
  product_count: number;
}

interface StockItem {
  product_id: number;
  product_name: string;
  product_sku: string;
  category: string;
  quantity: number;
}

interface TransferForm {
  product_id: number;
  from_warehouse_id: number;
  to_warehouse_id: number;
  quantity: number;
}

export default function Warehouses() {
  const { isLoaded, isSignedIn } = useAuth();
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [stockMap, setStockMap] = useState<Record<number, StockItem[]>>({});

  
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  
  const [newWarehouse, setNewWarehouse] = useState({ name: '', location: '', capacity: 10000, is_primary: false });
  const [transferForm, setTransferForm] = useState<TransferForm>({ product_id: 0, from_warehouse_id: 0, to_warehouse_id: 0, quantity: 1 });
  const [saving, setSaving] = useState(false);
  
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [whRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/warehouses`)
      ]);
      
      if (whRes.ok) {
        const whData = await whRes.json();
        setWarehouses(whData);
        if (whData.length > 0 && !selectedWarehouseId) {
          setSelectedWarehouseId(whData[0].id);
        }
        
        // Fetch stock for all warehouses
        const sMap: Record<number, StockItem[]> = {};
        for (const w of whData) {
          const sRes = await fetch(`${API_BASE_URL}/api/warehouses/${w.id}/stock`);
          if (sRes.ok) sMap[w.id] = await sRes.json();
        }
        setStockMap(sMap);
      }
      

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

  const handleCreateWarehouse = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/warehouses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWarehouse)
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewWarehouse({ name: '', location: '', capacity: 10000, is_primary: false });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleTransfer = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/warehouses/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transferForm)
      });
      if (res.ok) {
        setShowTransferModal(false);
        fetchData(); // refresh stocks
      } else {
        const err = await res.json();
        alert(err.detail || 'Transfer failed');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Helper for transfer form validation
  const getAvailableStock = () => {
    if (!transferForm.from_warehouse_id || !transferForm.product_id) return 0;
    const stock = stockMap[transferForm.from_warehouse_id]?.find(s => s.product_id === transferForm.product_id);
    return stock ? stock.quantity : 0;
  };
  const availableToTransfer = getAvailableStock();

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
          <h1 className="text-3xl font-bold text-foreground">Warehouses</h1>
          <p className="text-muted-foreground text-sm mt-1">Multi-location inventory tracking & transfers</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (warehouses.length < 2) {
                alert("You need at least 2 warehouses to transfer stock.");
                return;
              }
              setTransferForm({
                product_id: stockMap[warehouses[0].id]?.[0]?.product_id || 0,
                from_warehouse_id: warehouses[0].id,
                to_warehouse_id: warehouses[1].id,
                quantity: 1
              });
              setShowTransferModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card text-foreground font-medium text-sm hover:bg-secondary/50 transition-all"
          >
            <ArrowRightLeft size={16} /> Transfer Stock
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background font-medium text-sm hover:opacity-90 transition-all"
          >
            <Plus size={16} /> Add Location
          </button>
        </div>
      </div>

      {/* Warehouse Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl border border-border bg-card animate-pulse" />)}
        </div>
      ) : warehouses.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl mb-8">
          <Warehouse size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No warehouses configured yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {warehouses.map((w, idx) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => setSelectedWarehouseId(w.id)}
              className={cn(
                "rounded-2xl border bg-card p-5 cursor-pointer transition-all hover:border-foreground/30 relative overflow-hidden group",
                selectedWarehouseId === w.id ? "border-violet-500/50 shadow-[0_0_15px_-3px_rgba(139,92,246,0.1)]" : "border-border"
              )}
            >
              {w.is_primary && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-violet-500 text-white text-[10px] font-bold rounded-bl-xl uppercase tracking-wider">
                  Primary
                </div>
              )}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                  <Warehouse size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{w.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin size={12} /> {w.location || 'No location set'}
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Capacity Utilization</span>
                    <span className="font-medium text-foreground">{w.utilization_pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(w.utilization_pct, 100)}%` }}
                      transition={{ duration: 1, delay: 0.2 }}
                      className={cn(
                        "h-full rounded-full",
                        w.utilization_pct > 90 ? "bg-red-500" : w.utilization_pct > 75 ? "bg-amber-500" : "bg-emerald-500"
                      )}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground border-t border-border pt-3">
                  <span className="flex items-center gap-1.5"><Package size={14} /> {w.total_stock} / {w.capacity} units</span>
                  <span className="flex items-center gap-1.5"><Box size={14} /> {w.product_count} unique items</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Selected Warehouse Stock Table */}
      {selectedWarehouseId && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card overflow-hidden"
        >
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Package size={18} className="text-violet-400" />
              Stock Breakdown: {warehouses.find(w => w.id === selectedWarehouseId)?.name}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-muted-foreground">
              <thead className="text-xs uppercase bg-secondary/50 text-muted-foreground/80">
                <tr>
                  <th className="px-6 py-4 font-medium">Product Name</th>
                  <th className="px-6 py-4 font-medium">SKU</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium text-right">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {(stockMap[selectedWarehouseId] || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                      No stock currently stored in this warehouse.
                    </td>
                  </tr>
                ) : (
                  (stockMap[selectedWarehouseId] || []).map((item) => (
                    <tr key={item.product_id} className="border-b border-border hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{item.product_name}</td>
                      <td className="px-6 py-4">{item.product_sku}</td>
                      <td className="px-6 py-4">{item.category}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full font-medium text-xs border",
                          item.quantity > 50 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          item.quantity > 15 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          "bg-red-500/10 text-red-400 border-red-500/20"
                        )}>
                          {item.quantity} units
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Add Warehouse Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground">Add New Warehouse</h3>
                <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-secondary/50"><X size={18} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Warehouse Name</label>
                  <input
                    value={newWarehouse.name}
                    onChange={e => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                    placeholder="e.g., East Distribution Center"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Location</label>
                  <input
                    value={newWarehouse.location}
                    onChange={e => setNewWarehouse({ ...newWarehouse, location: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                    placeholder="City, State"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Max Unit Capacity</label>
                  <input
                    type="number" min="100" step="100"
                    value={newWarehouse.capacity}
                    onChange={e => setNewWarehouse({ ...newWarehouse, capacity: parseInt(e.target.value) || 1000 })}
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                  />
                </div>
                <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/20 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newWarehouse.is_primary}
                    onChange={e => setNewWarehouse({ ...newWarehouse, is_primary: e.target.checked })}
                    className="w-4 h-4 rounded text-violet-500 focus:ring-violet-500/20 bg-secondary border-border"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">Set as Primary Warehouse</span>
                    <span className="text-[10px] text-muted-foreground">Default destination for new POs if not specified</span>
                  </div>
                </label>
              </div>
              <div className="flex items-center gap-3 mt-6 justify-end">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-secondary/50 transition-all">Cancel</button>
                <button
                  onClick={handleCreateWarehouse}
                  disabled={saving || !newWarehouse.name}
                  className="px-5 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Modal */}
      <AnimatePresence>
        {showTransferModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowTransferModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <ArrowRightLeft size={18} /> Transfer Stock
                </h3>
                <button onClick={() => setShowTransferModal(false)} className="p-1 rounded-lg hover:bg-secondary/50"><X size={18} /></button>
              </div>
              
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">From Warehouse</label>
                    <select
                      value={transferForm.from_warehouse_id}
                      onChange={e => setTransferForm({ ...transferForm, from_warehouse_id: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                    >
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">To Warehouse</label>
                    <select
                      value={transferForm.to_warehouse_id}
                      onChange={e => setTransferForm({ ...transferForm, to_warehouse_id: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                    >
                      {warehouses.filter(w => w.id !== transferForm.from_warehouse_id).map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Product to Transfer</label>
                  <select
                    value={transferForm.product_id}
                    onChange={e => setTransferForm({ ...transferForm, product_id: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                  >
                    <option value={0} disabled>Select a product...</option>
                    {(stockMap[transferForm.from_warehouse_id] || []).filter(s => s.quantity > 0).map(s => (
                      <option key={s.product_id} value={s.product_id}>{s.product_name} ({s.quantity} available)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Quantity to Transfer</label>
                  <input
                    type="number" min="1" max={availableToTransfer}
                    value={transferForm.quantity}
                    onChange={e => setTransferForm({ ...transferForm, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary/30 border border-border text-sm text-foreground focus:outline-none focus:border-foreground/30"
                  />
                  <div className="flex justify-between mt-1 text-[10px]">
                    <span className="text-muted-foreground">Available to transfer: {availableToTransfer}</span>
                    {transferForm.quantity > availableToTransfer && (
                      <span className="text-red-400">Exceeds available stock</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-8 justify-end">
                <button onClick={() => setShowTransferModal(false)} className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-secondary/50 transition-all">Cancel</button>
                <button
                  onClick={handleTransfer}
                  disabled={saving || !transferForm.product_id || transferForm.quantity > availableToTransfer || transferForm.quantity <= 0}
                  className="px-5 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {saving ? 'Processing...' : 'Confirm Transfer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
