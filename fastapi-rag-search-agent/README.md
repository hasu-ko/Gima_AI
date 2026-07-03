<div align="center">

# 🔎 Agente de Búsqueda RAG

**Un mini-Tavily de código abierto: busca en la web, lee las páginas y responde con IA — sin alucinar.**

Hazle una pregunta y un agente de IA busca en internet, decide qué fuentes leer y te devuelve una respuesta fundamentada y **con citas**.

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?logo=fastapi&logoColor=white)
![Gemini](https://img.shields.io/badge/Google-Gemini-4285F4?logo=google&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

</div>

---

## ✨ ¿Qué hace?

- 🌐 **Busca en la web** combinando DuckDuckGo + SearXNG (varias instancias en paralelo).
- 📄 **Extrae y limpia** el contenido de las páginas (HTML ruidoso → texto en Markdown).
- 🤖 **Sintetiza con IA** (Google Gemini) una respuesta específica y actualizada.
- 🧠 **Es un agente de verdad**: el LLM controla el bucle — decide cuándo buscar, si reformular la consulta, qué páginas leer y cuándo responder.
- 🚫 **No alucina**: responde solo con lo que encuentra y **cita las fuentes**; si no hay datos, lo dice.
- ⚡ **API REST** lista para consumir desde cualquier app (frontend, bot, script…).

## 🧭 ¿Cómo funciona?

```
                   ┌───────────────────────────────────────────┐
   pregunta  ───▶  │                  AGENTE                     │
                   │  (Gemini decide qué herramienta usar)      │
                   └───────────────┬───────────────┬───────────┘
                                   │               │
                        buscar_web │               │ leer_pagina
                                   ▼               ▼
                            DuckDuckGo +      descarga y limpia
                              SearXNG           una página
                                   │               │
                                   └───────┬───────┘
                                           ▼
                             respuesta citada  [Fuente N]
```

El agente puede **encadenar varias herramientas** (buscar → reformular → leer → responder) antes de darte la respuesta final.

## 🗂️ Estructura

| Archivo | Responsabilidad |
|---|---|
| [`engine.py`](engine.py) | Herramientas: búsqueda web + scraping en paralelo |
| [`agent.py`](agent.py) | El agente Gemini (bucle de decisión con *function calling*) |
| [`main.py`](main.py) | La API REST (FastAPI) |

## 🚀 Instalación

> Requiere **Python 3.10+** y una **API key de Gemini** (gratis en [Google AI Studio](https://aistudio.google.com/apikey)).

```bash
# 1. Clona el repo
git clone https://github.com/tu-usuario/tu-repo.git
cd tu-repo

# 2. Instala las dependencias
pip install -r requirements.txt

# 3. Configura tu llave: copia la plantilla y edítala
cp .env.example .env        # en Windows PowerShell: copy .env.example .env
#   -> abre .env y pon tu GEMINI_API_KEY

# 4. Arranca el servidor
uvicorn main:app --reload
```

Abre **http://localhost:8000/docs** para probarlo desde el navegador (Swagger). 🎉

## 📡 Uso de la API

### Endpoint

```
POST /api/search
```

### Petición

```json
{
  "query": "¿Quién ganó el Balón de Oro 2024 y de qué equipo era?",
  "modo": "completo"
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `query` | string | La pregunta a investigar. **(obligatorio)** |
| `modo` | `"completo"` \| `"rapido"` | `completo`: busca **y** lee páginas (más detalle). `rapido`: solo snippets del buscador (más veloz). Por defecto `completo`. |

### Respuesta

```json
{
  "query": "¿Quién ganó el Balón de Oro 2024 y de qué equipo era?",
  "respuesta": "Rodri Hernández ganó el Balón de Oro 2024 y era centrocampista del Manchester City [Fuente 5].",
  "fuentes": [
    { "fuente": 5, "title": "Rodri gana el Balón de Oro", "url": "https://es.uefa.com/..." }
  ],
  "modo": "completo",
  "iteraciones": 2,
  "modelo": "gemini-2.5-flash"
}
```

### Ejemplo con `curl`

```bash
curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "que es Wuthering Waves y quien lo desarrolla", "modo": "rapido"}'
```

## ⚙️ Configuración

Todo se controla desde el archivo `.env`:

| Variable | Por defecto | Descripción |
|---|---|---|
| `GEMINI_API_KEY` | — | **(obligatorio)** Tu llave de Gemini. |
| `MODEL` | `gemini-2.5-flash` | Modelo a usar (p. ej. `gemini-2.5-pro`). |

## 📝 Notas

- 🔑 **Cada usuario necesita su propia `GEMINI_API_KEY`.** El `.env` está en `.gitignore` y **no se sube** al repo.
- 💸 Cada consulta consume cuota de la API de Gemini.
- 🐢 El modo `completo` es más lento (lee páginas completas); el `rapido` responde en pocos segundos.

## 📄 Licencia

MIT — úsalo, modifícalo y compártelo libremente.
