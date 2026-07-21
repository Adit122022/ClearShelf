import csv
import io
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database import models

router = APIRouter()


@router.get("/products")
def export_products_csv(db: Session = Depends(get_db)):
    """Export all products as a CSV file."""
    products = db.query(models.Product).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Name", "SKU", "Category", "Brand", "Price", "Discounted Price", "Current Stock", "Quantity"])
    
    for p in products:
        writer.writerow([p.id, p.name, p.sku, p.category, p.brand, p.price, p.discounted_price, p.current_stock, p.quantity])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=clearshelf_products.csv"}
    )


@router.get("/forecasts")
def export_forecasts_csv(db: Session = Depends(get_db)):
    """Export all forecast results as a CSV file."""
    forecasts = db.query(
        models.Forecast.id,
        models.Forecast.product_id,
        models.Product.name.label("product_name"),
        models.Product.sku.label("product_sku"),
        models.Forecast.forecast_date,
        models.Forecast.predicted_quantity,
        models.Forecast.adjusted_quantity,
        models.Forecast.model_used,
        models.Forecast.confidence_score,
        models.Forecast.created_at
    ).join(
        models.Product, models.Product.id == models.Forecast.product_id
    ).order_by(models.Forecast.created_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Product ID", "Product Name", "SKU", "Forecast Date",
        "ML Prediction", "Agent Adjusted", "Model Used", "Confidence %", "Created At"
    ])
    
    for f in forecasts:
        writer.writerow([
            f.id, f.product_id, f.product_name, f.product_sku, f.forecast_date,
            round(f.predicted_quantity, 2),
            round(f.adjusted_quantity, 2) if f.adjusted_quantity else "",
            f.model_used,
            round(f.confidence_score, 1) if f.confidence_score else "",
            f.created_at.isoformat() if f.created_at else ""
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=clearshelf_forecasts.csv"}
    )


@router.get("/purchase-orders")
def export_purchase_orders_csv(db: Session = Depends(get_db)):
    """Export all purchase orders as a CSV file."""
    orders = db.query(models.PurchaseOrder).order_by(models.PurchaseOrder.created_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "PO ID", "Supplier", "Product", "SKU", "Warehouse",
        "Quantity", "Unit Cost", "Total Cost", "Status",
        "Order Date", "Expected Delivery"
    ])
    
    for o in orders:
        supplier = db.query(models.Supplier).filter(models.Supplier.id == o.supplier_id).first()
        product = db.query(models.Product).filter(models.Product.id == o.product_id).first()
        warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == o.warehouse_id).first() if o.warehouse_id else None
        
        writer.writerow([
            o.id,
            supplier.name if supplier else "Unknown",
            product.name if product else "Unknown",
            product.sku if product else "N/A",
            warehouse.name if warehouse else "N/A",
            o.quantity, o.unit_cost, o.total_cost, o.status,
            o.order_date.isoformat() if o.order_date else "",
            o.expected_delivery.isoformat() if o.expected_delivery else ""
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=clearshelf_purchase_orders.csv"}
    )
