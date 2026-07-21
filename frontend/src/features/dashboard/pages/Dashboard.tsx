import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Package, AlertTriangle, DollarSign,
  Activity, ShoppingCart, Warehouse, Truck, ArrowUpRight,
  ArrowDownRight, BarChart3, ShieldCheck, Boxes,
  Download, RefreshCw
} from 'lucide-react';
import {
  Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { API_BASE_URL } from '../../../services/api';
import { cn } from '../../../lib/utils';

interface DashboardStats {
  total_products: number;
  total_categories: number;
  total_stock_value: number;
  total_stock_units: number;
  low_stock_count: number;
  out_of_stock_count: number;
  reorder_needed: number;
  inventory_health_pct: number;
  total_forecasts: number;
  total_suppliers: number;
  total_warehouses: number;
  active_purchase_orders: number;
}

interface TopMover {
  product_id: number;
  product_name: string;
  sku: string;
  category: string;
  total_sales: number;
  current_stock: number;
  avg_daily_sales: number;
}

interface Alert {
  product_id: number;
  product_name: string;
  sku: string;
  current_stock: number;
  severity: string;
  message: string;
}

const StatCard = ({ icon: Icon, label, value, subtext, trend, color, delay }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 hover:border-foreground/20 transition-all duration-300 group"
  >
    <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-[0.07] group-hover:opacity-[0.12] transition-opacity" style={{ background: color }} />
    <div className="flex items-center justify-between mb-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, color }}>
        <Icon size={20} />
      </div>
      {trend !== undefined && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
          trend >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
        )}>
          {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground mt-1">{label}</p>
    {subtext && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{subtext}</p>}
  </motion.div>
);

const HealthGauge = ({ percentage }: { percentage: number }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 70 ? '#10b981' : percentage >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-border" />
        <motion.circle
          cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ marginTop: '35px' }}>
        <span className="text-3xl font-bold" style={{ color }}>{percentage}%</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Health</span>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topMovers, setTopMovers] = useState<{ fast_movers: TopMover[]; slow_movers: TopMover[] }>({ fast_movers: [], slow_movers: [] });
  const [alerts, setAlerts] = useState<{ total_alerts: number; critical: number; low: number; alerts: Alert[] }>({ total_alerts: 0, critical: 0, low: 0, alerts: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const fetchAll = async () => {
      try {
        const [statsRes, moversRes, alertsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/dashboard/stats`),
          fetch(`${API_BASE_URL}/api/dashboard/top-movers`),
          fetch(`${API_BASE_URL}/api/dashboard/alerts`)
        ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (moversRes.ok) setTopMovers(await moversRes.json());
        if (alertsRes.ok) setAlerts(await alertsRes.json());
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [isLoaded, isSignedIn]);

  const handleExport = async (type: string) => {
    window.open(`${API_BASE_URL}/api/export/${type}`, '_blank');
  };

  if (loading || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
          <RefreshCw size={32} className="text-muted-foreground" />
        </motion.div>
      </div>
    );
  }

  const pieData = [
    { name: 'Healthy', value: stats.total_products - stats.low_stock_count - stats.out_of_stock_count },
    { name: 'Low Stock', value: stats.low_stock_count },
    { name: 'Out of Stock', value: stats.out_of_stock_count },
  ].filter(d => d.value > 0);

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
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time overview of your inventory operations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('products')} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card hover:bg-secondary/50 text-sm transition-all">
            <Download size={14} /> Export Products
          </button>
          <button onClick={() => handleExport('forecasts')} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card hover:bg-secondary/50 text-sm transition-all">
            <Download size={14} /> Export Forecasts
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard icon={Package} label="Total Products" value={stats.total_products} color="#8b5cf6" delay={0} />
        <StatCard icon={DollarSign} label="Stock Value" value={`₹${(stats.total_stock_value / 1000).toFixed(1)}K`} color="#06b6d4" delay={0.05} />
        <StatCard icon={Boxes} label="Total Units" value={stats.total_stock_units.toLocaleString()} color="#10b981" delay={0.1} />
        <StatCard icon={AlertTriangle} label="Low Stock" value={stats.low_stock_count} subtext={`${stats.out_of_stock_count} out of stock`} color="#f59e0b" delay={0.15} />
        <StatCard icon={Truck} label="Suppliers" value={stats.total_suppliers} color="#f472b6" delay={0.2} />
        <StatCard icon={Warehouse} label="Warehouses" value={stats.total_warehouses} color="#a78bfa" delay={0.25} />
      </div>

      {/* Main Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* Inventory Health Gauge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" /> Inventory Health
          </h3>
          <div className="relative flex items-center justify-center" style={{ height: 160 }}>
            <HealthGauge percentage={Math.round(stats.inventory_health_pct)} />
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Healthy stock (&gt;50 units)</span>
              <span className="text-emerald-400 font-medium">{stats.total_products - stats.low_stock_count - stats.out_of_stock_count}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Reorder needed</span>
              <span className="text-amber-400 font-medium">{stats.reorder_needed}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Active POs</span>
              <span className="text-blue-400 font-medium">{stats.active_purchase_orders}</span>
            </div>
          </div>
        </motion.div>

        {/* Stock Distribution Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-violet-400" /> Stock Distribution
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%" cy="50%"
                innerRadius={45} outerRadius={70}
                paddingAngle={4} dataKey="value"
                stroke="none"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={['#10b981', '#f59e0b', '#ef4444'][i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 mt-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full" style={{ background: ['#10b981', '#f59e0b', '#ef4444'][i] }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity size={16} className="text-cyan-400" /> Quick Actions
          </h3>
          <div className="space-y-3">
            {[
              { label: 'View Products', icon: Package, path: '/products', color: '#8b5cf6' },
              { label: 'Run Forecasts', icon: TrendingUp, path: '/forecast', color: '#06b6d4' },
              { label: 'AI Agent Console', icon: BarChart3, path: '/agents', color: '#f59e0b' },
              { label: 'Manage Suppliers', icon: Truck, path: '/suppliers', color: '#f472b6' },
              { label: 'Warehouses', icon: Warehouse, path: '/warehouses', color: '#a78bfa' },
              { label: 'Purchase Orders', icon: ShoppingCart, path: '/purchase-orders', color: '#10b981' },
            ].map((action) => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border hover:border-foreground/20 hover:bg-secondary/30 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${action.color}15`, color: action.color }}>
                  <action.icon size={16} />
                </div>
                <span className="text-sm text-foreground group-hover:text-foreground/90">{action.label}</span>
                <ArrowUpRight size={14} className="ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Top Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Fast Movers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-400" /> Top 5 Fast Movers
          </h3>
          {topMovers.fast_movers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No sales data yet. Upload CSV to see top movers.</p>
          ) : (
            <div className="space-y-3">
              {topMovers.fast_movers.map((product, idx) => (
                <div key={product.product_id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-border transition-all">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-sm font-bold">
                    #{idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{product.product_name}</p>
                    <p className="text-[10px] text-muted-foreground">{product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-400">{product.total_sales} sold</p>
                    <p className="text-[10px] text-muted-foreground">{product.avg_daily_sales}/day avg</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Slow Movers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingDown size={16} className="text-red-400" /> Bottom 5 Slow Movers
          </h3>
          {topMovers.slow_movers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Not enough product data to show slow movers.</p>
          ) : (
            <div className="space-y-3">
              {topMovers.slow_movers.map((product, idx) => (
                <div key={product.product_id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-border transition-all">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 text-sm font-bold">
                    #{idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{product.product_name}</p>
                    <p className="text-[10px] text-muted-foreground">{product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-400">{product.total_sales} sold</p>
                    <p className="text-[10px] text-muted-foreground">Stock: {product.current_stock}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Active Alerts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" /> Active Alerts
            {alerts.total_alerts > 0 && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-red-500/20 text-red-400 font-medium">{alerts.total_alerts}</span>
            )}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Critical: {alerts.critical}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Low: {alerts.low}</span>
          </div>
        </div>
        {alerts.alerts.length === 0 ? (
          <div className="text-center py-8">
            <ShieldCheck size={32} className="mx-auto text-emerald-400 mb-2" />
            <p className="text-sm text-muted-foreground">All clear! No stock alerts at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
            {alerts.alerts.map((alert) => (
              <div
                key={alert.product_id}
                className={cn(
                  "p-3 rounded-xl border transition-all cursor-pointer hover:scale-[1.01]",
                  alert.severity === 'critical' ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"
                )}
                onClick={() => navigate(`/forecast?product=${alert.product_id}`)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={12} className={alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'} />
                  <span className="text-xs font-medium text-foreground truncate">{alert.product_name}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{alert.message}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted-foreground">Stock: {alert.current_stock}</span>
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded",
                    alert.severity === 'critical' ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                  )}>
                    {alert.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
