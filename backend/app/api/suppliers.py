from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.database.connection import get_db
from app.database import models

router = APIRouter()

# ─── Schemas ──────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    name: str
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    lead_time_days: int = 7
    rating: float = 4.0

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    lead_time_days: Optional[int] = None
    rating: Optional[float] = None

class SupplierResponse(BaseModel):
    id: int
    name: str
    contact_email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    lead_time_days: int
    rating: float
    product_count: int
    active_orders: int
    created_at: datetime

    class Config:
        from_attributes = True

# ─── Routes ───────────────────────────────────────────────────

@router.get("", response_model=List[SupplierResponse])
def list_suppliers(db: Session = Depends(get_db)):
    suppliers = db.query(models.Supplier).all()
    result = []
    for s in suppliers:
        product_count = db.query(models.Product).filter(models.Product.supplier_id == s.id).count()
        active_orders = db.query(models.PurchaseOrder).filter(
            models.PurchaseOrder.supplier_id == s.id,
            models.PurchaseOrder.status.in_(["draft", "pending", "shipped"])
        ).count()
        result.append(SupplierResponse(
            id=s.id,
            name=s.name,
            contact_email=s.contact_email,
            phone=s.phone,
            address=s.address,
            lead_time_days=s.lead_time_days,
            rating=s.rating,
            product_count=product_count,
            active_orders=active_orders,
            created_at=s.created_at
        ))
    return result


@router.post("", response_model=SupplierResponse)
def create_supplier(data: SupplierCreate, db: Session = Depends(get_db)):
    supplier = models.Supplier(**data.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return SupplierResponse(
        id=supplier.id, name=supplier.name, contact_email=supplier.contact_email,
        phone=supplier.phone, address=supplier.address,
        lead_time_days=supplier.lead_time_days, rating=supplier.rating,
        product_count=0, active_orders=0, created_at=supplier.created_at
    )


@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(supplier_id: int, data: SupplierUpdate, db: Session = Depends(get_db)):
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(supplier, key, value)
    
    db.commit()
    db.refresh(supplier)
    
    product_count = db.query(models.Product).filter(models.Product.supplier_id == supplier.id).count()
    active_orders = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.supplier_id == supplier.id,
        models.PurchaseOrder.status.in_(["draft", "pending", "shipped"])
    ).count()
    
    return SupplierResponse(
        id=supplier.id, name=supplier.name, contact_email=supplier.contact_email,
        phone=supplier.phone, address=supplier.address,
        lead_time_days=supplier.lead_time_days, rating=supplier.rating,
        product_count=product_count, active_orders=active_orders,
        created_at=supplier.created_at
    )


@router.delete("/{supplier_id}")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Unlink products
    db.query(models.Product).filter(models.Product.supplier_id == supplier_id).update({"supplier_id": None})
    db.delete(supplier)
    db.commit()
    return {"success": True, "message": f"Supplier '{supplier.name}' deleted."}
