from pydantic import BaseModel, Field
from datetime import date

class CleanReefMetrics(BaseModel):
    reef_name: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    fecha: date
    sst: float = Field(..., description="Sea Surface Temperature en °C", ge=-2, le=40)
    dhw: float = Field(..., description="Degree Heating Weeks (0-20+)", ge=0)
    stress_level: int = Field(..., description="0: Sin Alerta, 1: Watch, 2: Warning, 3: Alert 1, 4: Alert 2", ge=0, le=4)
