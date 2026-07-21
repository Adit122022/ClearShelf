from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from pydantic import BaseModel
from datetime import datetime, timedelta

from app.database.connection import get_db
from app.database import models

router = APIRouter()

# ─── Schemas ──────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_products: int
    total_categories: int
    total_stock_value: float
    total_stock_units: int
    low_stock_count: int
    out_of_stock_count: int
    reorder_needed: int
    inventory_health_pct: float
    total_forecasts: int
    total_suppliers: int
    total_warehouses: int
    active_purchase_orders: int

class TopMover(BaseModel):
    product_id: int
    product_name: str
    sku: str
    category: str
    total_sales: int
    current_stock: int
    avg_daily_sales: float

class AlertItem(BaseModel):
    product_id: int
    product_name: str
    sku: str
    current_stock: int
    severity: str  # critical, low, reorder
    message: str

# ─── Routes ───────────────────────────────────────────────────

@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    products = db.query(models.Product).all()
    total_products = len(products)
    categories = set(p.category for p in products)
    total_stock_value = sum(p.price * p.current_stock for p in products)
    total_stock_units = sum(p.current_stock for p in products)
    low_stock = [p for p in products if 0 < p.current_stock <= 50]
    out_of_stock = [p for p in products if p.current_stock == 0]
    reorder = [p for p in products if p.current_stock <= 20]
    
    # Inventory health: % of products with stock > 50
    healthy = [p for p in products if p.current_stock > 50]
    health_pct = (len(healthy) / total_products * 100) if total_products > 0 else 0
    
    total_forecasts = db.query(models.Forecast).count()
    total_suppliers = db.query(models.Supplier).count()
    total_warehouses = db.query(models.Warehouse).count()
    active_pos = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.status.in_(["draft", "pending", "shipped"])
    ).count()
    
    return DashboardStats(
        total_products=total_products,
        total_categories=len(categories),
        total_stock_value=round(total_stock_value, 2),
        total_stock_units=total_stock_units,
        low_stock_count=len(low_stock),
        out_of_stock_count=len(out_of_stock),
        reorder_needed=len(reorder),
        inventory_health_pct=round(health_pct, 1),
        total_forecasts=total_forecasts,
        total_suppliers=total_suppliers,
        total_warehouses=total_warehouses,
        active_purchase_orders=active_pos
    )


@router.get("/top-movers", response_model=dict)
def get_top_movers(db: Session = Depends(get_db)):
    """Get top 5 fast-moving and slow-moving products by total sales volume."""
    # Query total sales per product
    sales_by_product = db.query(
        models.HistoricalSales.product_id,
        func.sum(models.HistoricalSales.quantity).label("total_sales"),
        func.count(models.HistoricalSales.id).label("days_with_sales")
    ).group_by(
        models.HistoricalSales.product_id
    ).all()
    
    if not sales_by_product:
        return {"fast_movers": [], "slow_movers": []}
    
    product_sales = []
    for sp in sales_by_product:
        product = db.query(models.Product).filter(models.Product.id == sp.product_id).first()
        if product:
            avg_daily = sp.total_sales / max(sp.days_with_sales, 1)
            product_sales.append(TopMover(
                product_id=product.id,
                product_name=product.name,
                sku=product.sku,
                category=product.category,
                total_sales=sp.total_sales,
                current_stock=product.current_stock,
                avg_daily_sales=round(avg_daily, 1)
            ))
    
    # Sort by total sales
    sorted_sales = sorted(product_sales, key=lambda x: x.total_sales, reverse=True)
    
    return {
        "fast_movers": [s.model_dump() for s in sorted_sales[:5]],
        "slow_movers": [s.model_dump() for s in sorted_sales[-5:][::-1]] if len(sorted_sales) > 5 else []
    }


@router.get("/alerts", response_model=dict)
def get_dashboard_alerts(db: Session = Depends(get_db)):
    """Get alert counts and details for navbar badge."""
    products = db.query(models.Product).all()
    alerts: List[AlertItem] = []
    
    for p in products:
        if p.current_stock == 0:
            alerts.append(AlertItem(
                product_id=p.id, product_name=p.name, sku=p.sku,
                current_stock=0, severity="critical",
                message=f"{p.name} is out of stock! Restock immediately."
            ))
        elif p.current_stock <= 15:
            alerts.append(AlertItem(
                product_id=p.id, product_name=p.name, sku=p.sku,
                current_stock=p.current_stock, severity="critical",
                message=f"{p.name} has only {p.current_stock} units left. Order this week."
            ))
        elif p.current_stock <= 50:
            alerts.append(AlertItem(
                product_id=p.id, product_name=p.name, sku=p.sku,
                current_stock=p.current_stock, severity="low",
                message=f"{p.name} is running low ({p.current_stock} units). Watch closely."
            ))
    
    return {
        "total_alerts": len(alerts),
        "critical": len([a for a in alerts if a.severity == "critical"]),
        "low": len([a for a in alerts if a.severity == "low"]),
        "alerts": [a.model_dump() for a in alerts[:20]]  # Cap at 20 to keep response lean
    }
