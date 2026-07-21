from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta

from app.database.connection import get_db
from app.database import models

router = APIRouter()

# ─── Schemas ──────────────────────────────────────────────────

class POCreate(BaseModel):
    supplier_id: int
    product_id: int
    warehouse_id: Optional[int] = None
    quantity: int
    unit_cost: Optional[float] = None
    notes: Optional[str] = None

class POStatusUpdate(BaseModel):
    status: str  # draft, pending, shipped, delivered, cancelled

class POResponse(BaseModel):
    id: int
    supplier_id: int
    supplier_name: str
    product_id: int
    product_name: str
    product_sku: str
    warehouse_id: Optional[int]
    warehouse_name: Optional[str]
    quantity: int
    unit_cost: Optional[float]
    total_cost: Optional[float]
    status: str
    order_date: datetime
    expected_delivery: Optional[datetime]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# ─── Routes ───────────────────────────────────────────────────

@router.get("", response_model=List[POResponse])
def list_purchase_orders(db: Session = Depends(get_db)):
    orders = db.query(models.PurchaseOrder).order_by(models.PurchaseOrder.created_at.desc()).all()
    result = []
    for o in orders:
        supplier = db.query(models.Supplier).filter(models.Supplier.id == o.supplier_id).first()
        product = db.query(models.Product).filter(models.Product.id == o.product_id).first()
        warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == o.warehouse_id).first() if o.warehouse_id else None
        
        result.append(POResponse(
            id=o.id,
            supplier_id=o.supplier_id,
            supplier_name=supplier.name if supplier else "Unknown",
            product_id=o.product_id,
            product_name=product.name if product else "Unknown",
            product_sku=product.sku if product else "N/A",
            warehouse_id=o.warehouse_id,
            warehouse_name=warehouse.name if warehouse else None,
            quantity=o.quantity,
            unit_cost=o.unit_cost,
            total_cost=o.total_cost,
            status=o.status,
            order_date=o.order_date,
            expected_delivery=o.expected_delivery,
            notes=o.notes,
            created_at=o.created_at
        ))
    return result


@router.post("", response_model=POResponse)
def create_purchase_order(data: POCreate, db: Session = Depends(get_db)):
    supplier = db.query(models.Supplier).filter(models.Supplier.id == data.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    product = db.query(models.Product).filter(models.Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    total = (data.unit_cost or product.price) * data.quantity
    expected = datetime.utcnow() + timedelta(days=supplier.lead_time_days)
    
    po = models.PurchaseOrder(
        supplier_id=data.supplier_id,
        product_id=data.product_id,
        warehouse_id=data.warehouse_id,
        quantity=data.quantity,
        unit_cost=data.unit_cost or product.price,
        total_cost=total,
        status="draft",
        expected_delivery=expected,
        notes=data.notes
    )
    db.add(po)
    db.commit()
    db.refresh(po)
    
    warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == po.warehouse_id).first() if po.warehouse_id else None
    
    return POResponse(
        id=po.id, supplier_id=po.supplier_id, supplier_name=supplier.name,
        product_id=po.product_id, product_name=product.name, product_sku=product.sku,
        warehouse_id=po.warehouse_id, warehouse_name=warehouse.name if warehouse else None,
        quantity=po.quantity, unit_cost=po.unit_cost, total_cost=po.total_cost,
        status=po.status, order_date=po.order_date, expected_delivery=po.expected_delivery,
        notes=po.notes, created_at=po.created_at
    )


@router.put("/{po_id}/status", response_model=POResponse)
def update_po_status(po_id: int, data: POStatusUpdate, db: Session = Depends(get_db)):
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    valid_statuses = ["draft", "pending", "shipped", "delivered", "cancelled"]
    if data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    # On delivery, add stock to warehouse
    if data.status == "delivered" and po.status != "delivered":
        if po.warehouse_id:
            ws = db.query(models.WarehouseStock).filter(
                models.WarehouseStock.warehouse_id == po.warehouse_id,
                models.WarehouseStock.product_id == po.product_id
            ).first()
            if ws:
                ws.quantity += po.quantity
            else:
                ws = models.WarehouseStock(
                    warehouse_id=po.warehouse_id,
                    product_id=po.product_id,
                    quantity=po.quantity
                )
                db.add(ws)
        
        # Also update product's total current_stock
        product = db.query(models.Product).filter(models.Product.id == po.product_id).first()
        if product:
            product.current_stock += po.quantity
    
    po.status = data.status
    db.commit()
    db.refresh(po)
    
    supplier = db.query(models.Supplier).filter(models.Supplier.id == po.supplier_id).first()
    product = db.query(models.Product).filter(models.Product.id == po.product_id).first()
    warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == po.warehouse_id).first() if po.warehouse_id else None
    
    return POResponse(
        id=po.id, supplier_id=po.supplier_id, supplier_name=supplier.name if supplier else "Unknown",
        product_id=po.product_id, product_name=product.name if product else "Unknown",
        product_sku=product.sku if product else "N/A",
        warehouse_id=po.warehouse_id, warehouse_name=warehouse.name if warehouse else None,
        quantity=po.quantity, unit_cost=po.unit_cost, total_cost=po.total_cost,
        status=po.status, order_date=po.order_date, expected_delivery=po.expected_delivery,
        notes=po.notes, created_at=po.created_at
    )
