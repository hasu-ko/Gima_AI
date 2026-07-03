"""API REST (FastAPI) del buscador con síntesis por IA.

Arrancar:
    uvicorn main:app --reload      (o: python main.py)

    POST http://localhost:8000/api/search   {"query": "...", "modo": "completo"}
    Docs http://localhost:8000/docs

La API key de Gemini se lee desde el archivo .env local del proyecto.
"""

from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agent import generar_respuesta, buscar_y_guardar_imagenes, MODEL

app = FastAPI(
    title="Agente de Búsqueda (RAG)",
    description="Agente que busca en la web, lee páginas y sintetiza una respuesta "
                "fundamentada con IA (Gemini). El LLM decide qué herramientas usar.",
    version="2.1.0",
)

# CORS: permitir peticiones desde el frontend de Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TurnoHistorial(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="La pregunta a investigar.")
    modo: Literal["completo", "rapido"] = Field(
        "completo",
        description="'completo': el agente puede buscar y leer páginas completas "
                    "(más detalle). 'rapido': solo búsqueda por snippets (más veloz).",
    )
    historial: list[TurnoHistorial] = Field(
        default_factory=list,
        description="Turnos previos de la misma conversación (memoria del chat), "
                    "para que el agente entienda preguntas de seguimiento.",
    )


class Fuente(BaseModel):
    fuente: int
    title: str
    url: str


class SearchResponse(BaseModel):
    query: str
    respuesta: str
    fuentes: list[Fuente]
    modo: str
    iteraciones: int
    modelo: str


# ---------------------- Modelos de Imágenes ----------------------

class ImageSearchRequest(BaseModel):
    personaje: str = Field(..., min_length=1, description="Nombre del personaje.")
    juego: str = Field(..., min_length=1, description="Nombre del juego al que pertenece.")
    max_imgs: int = Field(8, ge=1, le=20, description="Máximo de imágenes a descargar (1-20).")


class ImageSavedFile(BaseModel):
    path: str
    url: str
    size_kb: float


class ImageSearchResponse(BaseModel):
    personaje: str
    juego: str
    carpeta: str
    guardadas: list[ImageSavedFile]
    fallidas: list[dict]
    total: int


@app.get("/", tags=["Estado"])
def raiz():
    return {"estado": "ok", "docs": "/docs", "endpoint": "POST /api/search"}


@app.get("/health", tags=["Estado"])
def health():
    """Endpoint de salud para verificar que el servicio está activo."""
    return {"status": "healthy", "modelo": MODEL}


@app.post("/api/search", response_model=SearchResponse, tags=["Búsqueda"])
async def search(payload: SearchRequest):
    """Ejecuta el agente: el LLM busca, lee páginas y decide cuándo responder."""
    try:
        # generar_respuesta hace I/O de red bloqueante: fuera del event loop.
        resultado = await run_in_threadpool(
            generar_respuesta,
            payload.query,
            payload.modo,
            [t.model_dump() for t in payload.historial],
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {e}")

    resultado["modelo"] = MODEL
    return resultado


@app.post("/api/images", response_model=ImageSearchResponse, tags=["Imágenes"])
async def images(payload: ImageSearchRequest):
    """Busca imágenes del personaje en DuckDuckGo y las descarga en
    imagenes/{juego-slug}/{personaje-slug}/. Retorna las rutas guardadas."""
    try:
        resultado = await run_in_threadpool(
            buscar_y_guardar_imagenes,
            payload.personaje,
            payload.juego,
            payload.max_imgs,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al descargar imágenes: {e}")

    if resultado["total"] == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No se encontraron imágenes para '{payload.personaje}' en '{payload.juego}'."
        )
    return resultado


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
