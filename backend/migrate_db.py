import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE forecasts ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION;"))
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL;"))
        conn.commit()
        print("Successfully ran migrations.")
    except Exception as e:
        print("Error or already exists:", e)
