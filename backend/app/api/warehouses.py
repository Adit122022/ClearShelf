from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.database.connection import get_db
from app.database import models

router = APIRouter()

# ─── Schemas ──────────────────────────────────────────────────

class WarehouseCreate(BaseModel):
    name: str
    location: Optional[str] = None
    capacity: int = 10000
    is_primary: bool = False

class WarehouseResponse(BaseModel):
    id: int
    name: str
    location: Optional[str]
    capacity: int
    is_primary: bool
    total_stock: int
    utilization_pct: float
    product_count: int
    created_at: datetime

    class Config:
        from_attributes = True

class StockItemResponse(BaseModel):
    product_id: int
    product_name: str
    product_sku: str
    category: str
    quantity: int

class TransferRequest(BaseModel):
    product_id: int
    from_warehouse_id: int
    to_warehouse_id: int
    quantity: int

# ─── Routes ───────────────────────────────────────────────────

@router.get("", response_model=List[WarehouseResponse])
def list_warehouses(db: Session = Depends(get_db)):
    warehouses = db.query(models.Warehouse).all()
    result = []
    for w in warehouses:
        total_stock = db.query(func.coalesce(func.sum(models.WarehouseStock.quantity), 0)).filter(
            models.WarehouseStock.warehouse_id == w.id
        ).scalar()
        product_count = db.query(models.WarehouseStock).filter(
            models.WarehouseStock.warehouse_id == w.id,
            models.WarehouseStock.quantity > 0
        ).count()
        utilization = (total_stock / w.capacity * 100) if w.capacity > 0 else 0
        result.append(WarehouseResponse(
            id=w.id, name=w.name, location=w.location, capacity=w.capacity,
            is_primary=w.is_primary, total_stock=int(total_stock),
            utilization_pct=round(utilization, 1), product_count=product_count,
            created_at=w.created_at
        ))
    return result


@router.post("", response_model=WarehouseResponse)
def create_warehouse(data: WarehouseCreate, db: Session = Depends(get_db)):
    warehouse = models.Warehouse(**data.model_dump())
    db.add(warehouse)
    db.commit()
    db.refresh(warehouse)
    return WarehouseResponse(
        id=warehouse.id, name=warehouse.name, location=warehouse.location,
        capacity=warehouse.capacity, is_primary=warehouse.is_primary,
        total_stock=0, utilization_pct=0.0, product_count=0,
        created_at=warehouse.created_at
    )


@router.get("/{warehouse_id}/stock", response_model=List[StockItemResponse])
def get_warehouse_stock(warehouse_id: int, db: Session = Depends(get_db)):
    warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    stocks = db.query(
        models.WarehouseStock.product_id,
        models.Product.name.label("product_name"),
        models.Product.sku.label("product_sku"),
        models.Product.category,
        models.WarehouseStock.quantity
    ).join(
        models.Product, models.Product.id == models.WarehouseStock.product_id
    ).filter(
        models.WarehouseStock.warehouse_id == warehouse_id
    ).all()
    
    return [StockItemResponse(
        product_id=s.product_id, product_name=s.product_name,
        product_sku=s.product_sku, category=s.category, quantity=s.quantity
    ) for s in stocks]


@router.post("/transfer")
def transfer_stock(data: TransferRequest, db: Session = Depends(get_db)):
    if data.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
    
    # Check source stock
    from_stock = db.query(models.WarehouseStock).filter(
        models.WarehouseStock.warehouse_id == data.from_warehouse_id,
        models.WarehouseStock.product_id == data.product_id
    ).first()
    
    if not from_stock or from_stock.quantity < data.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock in source warehouse")
    
    # Deduct from source
    from_stock.quantity -= data.quantity
    
    # Add to destination
    to_stock = db.query(models.WarehouseStock).filter(
        models.WarehouseStock.warehouse_id == data.to_warehouse_id,
        models.WarehouseStock.product_id == data.product_id
    ).first()
    
    if to_stock:
        to_stock.quantity += data.quantity
    else:
        to_stock = models.WarehouseStock(
            warehouse_id=data.to_warehouse_id,
            product_id=data.product_id,
            quantity=data.quantity
        )
        db.add(to_stock)
    
    db.commit()
    
    product = db.query(models.Product).filter(models.Product.id == data.product_id).first()
    return {
        "success": True,
        "message": f"Transferred {data.quantity} units of '{product.name if product else 'Unknown'}'"
    }
