"""Agente de investigación web sobre Gemini.

A diferencia de un pipeline fijo, aquí el LLM controla el bucle: decide cuándo
buscar, si reformular la consulta, qué páginas leer y cuándo responder. Usa dos
herramientas (function calling) que ejecuta este módulo.

Funciones pública principales:
    generar_respuesta(pregunta, modo)          -> {query, respuesta, fuentes, modo, iteraciones}
    buscar_y_guardar_imagenes(personaje, juego) -> {personaje, juego, carpeta, guardadas, fallidas, total}

La API key de Gemini se lee automáticamente desde el archivo .env del proyecto.
"""

import os
import re
import sys
import json
import asyncio
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from supabase import create_client, Client

from engine import query_combined, query_images, query_images_art, download_images, scrape_all_async

load_dotenv(Path(__file__).with_name(".env"))

API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
MODEL = os.environ.get("MODEL", "gemini-2.5-flash")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

NUM_RESULTADOS = 5          # resultados de búsqueda que ve el agente
MAX_CHARS_PAGINA = 6000     # tope de contenido devuelto por leer_pagina
MAX_ITERS = {"rapido": 2, "completo": 6}   # rondas de herramientas por modo
MAX_TURNOS_HISTORIAL = 8    # turnos previos de conversación que ve el agente
MAX_CHARS_TURNO = 1500      # tope de caracteres por turno del historial

SYSTEM_PROMPT = """\
Eres un agente de investigación web experto. Tu principal objetivo es proveer respuestas EXTREMADAMENTE detalladas, exhaustivas y estructuradas, obtenidas EXCLUSIVAMENTE mediante tus herramientas.

Contexto de conversación:
- La conversación puede incluir turnos anteriores (preguntas del usuario y tus \
respuestas previas). La nueva pregunta puede ser un SEGUIMIENTO: si usa pronombres \
o referencias implícitas ("su mejor build", "¿y ella?", "ese personaje", "dame más \
detalles"), resuelve a qué personaje, juego o tema se refiere usando los turnos \
anteriores y busca información sobre ESE tema concreto. NUNCA respondas sobre algo \
sin relación con el hilo de la conversación.
- No repitas información completa que ya diste: amplíala o responde lo nuevo.

Estrategia:
- Empieza buscando en la web.
- Si los snippets no bastan{leer}, si los resultados son malos reformula la \
consulta y vuelve a buscar. Tómate el tiempo de usar varias herramientas antes de \
responder para recabar suficiente información.
- Si la consulta trata sobre un personaje, videojuego, arma, jefe u otro sujeto \
visual concreto, usa ADEMÁS buscar_imagen (una sola vez, en paralelo con la búsqueda \
de texto) para conseguir una imagen representativa de ese personaje o juego.

Reglas al dar la respuesta final (obligatorias):
- Fundaméntala solo en lo que obtuviste de las herramientas. No inventes datos, \
cifras, fechas ni nombres.
- Si no encuentras la información, responde exactamente: "No encuentro esa \
información en las fuentes consultadas."
- Cita SIEMPRE las fuentes con [Fuente N], usando el número que devuelven las herramientas.
- Responde en español.
- Es CRÍTICO que la respuesta sea de forma PROFUNDA, COMPLETA y MUY EXTENSA (mínimo de varios párrafos grandes). \
NUNCA des respuestas breves o superficiales.
- Usa formato Markdown (títulos, subtítulos, viñetas, listas, negritas) para estructurar \
la información, expandir sobre cada punto, y hacerla fácil de leer.
- Cuando presentes datos comparativos o enumerables (estadísticas, builds, materiales \
de mejora, comparaciones de personajes/armas, versiones, tier lists), preséntalos en \
una TABLA Markdown (| Col1 | Col2 |) en lugar de listas largas.
- Si obtuviste una imagen con buscar_imagen, insértala justo después del primer \
párrafo introductorio con la sintaxis ![descripción](url), usando EXACTAMENTE la URL \
del campo "image" que devolvió la herramienta. Incluye como máximo una imagen y NUNCA \
inventes ni modifiques URLs de imágenes. Si la herramienta no devolvió imágenes, \
simplemente no incluyas ninguna.
"""


def get_client():
    """Crea el cliente de Gemini. La API key se lee del .env."""
    if not API_KEY:
        raise RuntimeError(
            "No hay API key configurada. Define GEMINI_API_KEY en el archivo .env "
            "dentro de la carpeta fastapi-rag-search-agent/."
        )
    return genai.Client(api_key=API_KEY)


# --------------------------- Registro de fuentes ----------------------------

class Registro:
    """Asigna un número estable a cada URL que el agente descubre o lee."""

    def __init__(self):
        self._por_url = {}
        self._n = 0

    def add(self, title, url, leida=False):
        entrada = self._por_url.get(url)
        if entrada is None:
            self._n += 1
            entrada = {"fuente": self._n, "title": title or url, "url": url, "leida": False}
            self._por_url[url] = entrada
        if leida:
            entrada["leida"] = True
        return entrada["fuente"]

    def usadas(self, respuesta):
        """Fuentes citadas en la respuesta o efectivamente leídas.

        Reconoce citas como [Fuente 2], [2] o [2, 4, 5]: extrae los números de
        cualquier grupo entre corchetes.
        """
        citadas = set()
        for grupo in re.findall(r"\[([^\]]+)\]", respuesta):
            citadas.update(int(n) for n in re.findall(r"\d+", grupo))
        sel = [e for e in self._por_url.values() if e["fuente"] in citadas or e["leida"]]
        if not sel:
            sel = list(self._por_url.values())
        return [
            {"fuente": e["fuente"], "title": e["title"], "url": e["url"]}
            for e in sorted(sel, key=lambda e: e["fuente"])
        ]


# ------------------------------- Herramientas -------------------------------

def _buscar_web(reg, query, modo="completo"):
    limit = 2 if modo == "rapido" else 5
    resultados = query_combined(query)
    salida = []
    for r in resultados[:limit]:
        url = r.get("href")
        if not url:
            continue
        n = reg.add(r.get("title", ""), url)
        salida.append({
            "fuente": n,
            "title": r.get("title", ""),
            "url": url,
            "snippet": (r.get("body", "") or "")[:500],
        })
    return salida or {"aviso": "sin resultados; prueba a reformular la consulta"}


def _buscar_imagen(query, hashtags=None):
    """Busca imágenes del personaje en paralelo en múltiples plataformas de arte
    (Pixiv, Pinterest, ArtStation, DeviantArt, general).
    Si se proporcionan hashtags, añade una búsqueda adicional con esos hashtags.
    """
    imagenes = query_images_art(query.strip(), max_results=12, hashtags=hashtags or None)
    if not imagenes:
        # Fallback: búsqueda general simple
        imagenes = query_images(f"{query.strip()} character art")
    if not imagenes:
        return {"aviso": "sin imágenes para esa búsqueda; continúa sin imagen"}
    return [
        {
            "title": img.get("title", ""),
            "image": img.get("image", ""),
            "source": img.get("url", ""),
        }
        for img in imagenes
    ]


def _leer_pagina(reg, url):
    res = asyncio.run(scrape_all_async([url]))[0]
    if isinstance(res, Exception) or not (res.get("content") or "").strip():
        return {"error": "no se pudo extraer contenido de esta página"}
    n = reg.add(res.get("title", ""), url, leida=True)
    return {"fuente": n, "title": res.get("title", ""), "content": res["content"][:MAX_CHARS_PAGINA]}


_DECL_BUSCAR = types.FunctionDeclaration(
    name="buscar_web",
    description="Busca en internet. Devuelve resultados con fuente, título, url y snippet.",
    parameters=types.Schema(
        type=types.Type.OBJECT,
        properties={"query": types.Schema(type=types.Type.STRING, description="Términos de búsqueda.")},
        required=["query"],
    ),
)

_DECL_IMAGEN = types.FunctionDeclaration(
    name="buscar_imagen",
    description=(
        "Busca imágenes del personaje o sujeto visual indicado en Pixiv, Pinterest, "
        "ArtStation y fuentes generales. "
        "Pasa SOLO el nombre del personaje y el juego en 'query', por ejemplo 'Encore Wuthering Waves'. "
        "NO añadas términos como 'art' o 'render' en query; eso se hace automáticamente. "
        "Si el usuario pide buscar por hashtag(s) específicos (ej. '#Encore', '#WutheringWaves'), "
        "pásalos en el campo 'hashtags' como lista. Si no lo pide, omite ese campo."
    ),
    parameters=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "query": types.Schema(
                type=types.Type.STRING,
                description="Nombre del personaje + nombre del juego. Ejemplo: 'Encore Wuthering Waves'.",
            ),
            "hashtags": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(
                    type=types.Type.STRING,
                    description="Un hashtag, con o sin '#'. Ejemplo: '#Encore' o 'WutheringWaves'.",
                ),
                description=(
                    "Lista de hashtags para buscar en redes sociales y plataformas de arte. "
                    "SOLO úsala si el usuario pidió explícitamente buscar por hashtag. "
                    "Ejemplos: ['#Encore', '#WutheringWaves']."
                ),
            ),
        },
        required=["query"],
    ),
)

_DECL_LEER = types.FunctionDeclaration(
    name="leer_pagina",
    description="Descarga el contenido completo y limpio de una URL concreta.",
    parameters=types.Schema(
        type=types.Type.OBJECT,
        properties={"url": types.Schema(type=types.Type.STRING, description="URL a leer.")},
        required=["url"],
    ),
)


def _config(modo, lore_context=""):
    decls = [_DECL_BUSCAR, _DECL_IMAGEN]
    leer_txt = ""
    if modo == "completo":
        decls.append(_DECL_LEER)
        leer_txt = ", lee con leer_pagina las páginas más prometedoras"
        
    system_instruction = SYSTEM_PROMPT.format(leer=leer_txt)
    
    if modo == "rapido":
        system_instruction += "\n\nIMPORTANTE (MODO RÁPIDO): Responde de forma CONCISA y corta. Ve directo al grano. NO uses explicaciones innecesariamente largas ni exceso de texto."
    
    if lore_context:
        system_instruction += f"\n\nCONTEXTO LORE (Base de datos):\n{lore_context}"
        
    return types.GenerateContentConfig(
        system_instruction=system_instruction,
        tools=[types.Tool(function_declarations=decls)],
        temperature=0.2,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )


# --------------------- Búsqueda Vectorial (RAG) ------------------------------

def buscar_lore_db(pregunta: str) -> str:
    """Convierte la pregunta a vector (1536 dims) y busca en Supabase pgvector."""
    if not supabase:
        return ""
        
    try:
        # Generar embedding de 1536 dimensiones con Gemini
        client = get_client()
        result = client.models.embed_content(
            model="gemini-embedding-2",
            contents=pregunta,
            config=types.EmbedContentConfig(output_dimensionality=1536)
        )
        
        if not result.embeddings or not result.embeddings[0].values:
            return ""
            
        embedding_values = result.embeddings[0].values
        
        # Buscar en Supabase
        response = supabase.rpc(
            "buscar_lore",
            {
                "query_embedding": embedding_values,
                "match_threshold": 0.75,
                "match_count": 3
            }
        ).execute()
        
        data = response.data
        if not data:
            return ""
            
        # Formatear resultados
        textos = []
        for item in data:
            juego = item.get("juego", "").replace("_", " ").title()
            cat = item.get("categoria", "").title()
            titulo = item.get("titulo", "")
            contenido = item.get("contenido_texto", "")
            textos.append(f"[{juego} - {cat}] {titulo}:\n{contenido}")
            
        return "\n\n".join(textos)
        
    except Exception as e:
        print(f"Error en buscar_lore_db: {e}")
        return ""



# --------------------- Tools para OpenRouter (JSON Schema) -------------------

_OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "buscar_web",
            "description": "Busca en internet. Devuelve resultados con fuente, título, url y snippet.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Términos de búsqueda."}
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "buscar_imagen",
            "description": (
                "Busca imágenes del personaje o sujeto visual indicado en Pixiv, Pinterest, "
                "ArtStation y fuentes generales. "
                "Pasa SOLO el nombre del personaje y el juego en 'query', por ejemplo 'Encore Wuthering Waves'. "
                "NO añadas términos como 'art' o 'render' en query; eso se hace automáticamente. "
                "Si el usuario pide buscar por hashtag(s) específicos (ej. '#Encore', '#WutheringWaves'), "
                "pásalos en el campo 'hashtags' como lista. Si no lo pide, omite ese campo."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Nombre del personaje + nombre del juego. Ejemplo: 'Encore Wuthering Waves'."
                    },
                    "hashtags": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "description": "Un hashtag, con o sin '#'. Ejemplo: '#Encore' o 'WutheringWaves'."
                        },
                        "description": (
                            "Lista de hashtags para buscar en redes sociales y plataformas de arte. "
                            "SOLO úsala si el usuario pidió explícitamente buscar por hashtag. "
                            "Ejemplos: ['#Encore', '#WutheringWaves']."
                        )
                    }
                },
                "required": ["query"],
            },
        },
    },
]

_OPENAI_TOOL_LEER = {
    "type": "function",
    "function": {
        "name": "leer_pagina",
        "description": "Descarga el contenido completo y limpio de una URL concreta.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL a leer."}
            },
            "required": ["url"],
        },
    },
}



# --------------------------------- Agente -----------------------------------

def _normalizar_historial(historial):
    """Limpia y acota el historial de conversación que envía el frontend.

    Acepta una lista de dicts {"role": "user"|"assistant", "content": str} y
    devuelve solo los últimos MAX_TURNOS_HISTORIAL turnos válidos, con el rol
    normalizado a "user"/"model" y el contenido truncado (sin imágenes Markdown,
    que solo arrastran URLs enormes al contexto).
    """
    turnos = []
    for t in (historial or []):
        rol = (t.get("role") or "").strip().lower()
        texto = (t.get("content") or "").strip()
        if not texto or rol not in ("user", "assistant", "model"):
            continue
        texto = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", texto).strip()
        if not texto:
            continue
        turnos.append({
            "role": "user" if rol == "user" else "model",
            "content": texto[:MAX_CHARS_TURNO],
        })
    return turnos[-MAX_TURNOS_HISTORIAL:]


def _generar_gemini(pregunta, modo="completo", historial=None):
    """Ejecuta el bucle del agente usando Google GenAI (Gemini SDK)."""
    client = get_client()
    reg = Registro()
    
    # 1. Búsqueda Vectorial (RAG en base de datos)
    lore_context = buscar_lore_db(pregunta)
    
    config = _config(modo, lore_context=lore_context)
    contents = [
        types.Content(role=t["role"], parts=[types.Part(text=t["content"])])
        for t in _normalizar_historial(historial)
    ]
    contents.append(types.Content(role="user", parts=[types.Part(text=pregunta)]))
    max_iters = MAX_ITERS.get(modo, 6)

    respuesta = ""
    iteraciones = 0
    for iteraciones in range(1, max_iters + 1):
        resp = client.models.generate_content(model=MODEL, contents=contents, config=config)
        if not resp.candidates:
            break
        parts = resp.candidates[0].content.parts or []
        llamadas = [p.function_call for p in parts if getattr(p, "function_call", None)]

        if not llamadas:
            respuesta = resp.text or ""
            break

        # El LLM pidió herramientas: las ejecutamos y le devolvemos los resultados.
        contents.append(resp.candidates[0].content)
        respuestas = []
        for fc in llamadas:
            args = dict(fc.args) if fc.args else {}
            if fc.name == "buscar_web":
                result = _buscar_web(reg, args.get("query", ""), modo)
            elif fc.name == "buscar_imagen":
                # hashtags es opcional: solo viene si el usuario lo pidió
                hashtags = args.get("hashtags") or None
                result = _buscar_imagen(args.get("query", ""), hashtags=hashtags)
            elif fc.name == "leer_pagina":
                result = _leer_pagina(reg, args.get("url", ""))
            else:
                result = {"error": f"herramienta desconocida: {fc.name}"}
            respuestas.append(types.Part.from_function_response(
                name=fc.name, response={"resultado": result}))
        contents.append(types.Content(role="user", parts=respuestas))
    else:
        # Se agotaron las rondas: forzamos una respuesta final sin herramientas.
        cierre = types.Content(role="user", parts=[types.Part(
            text="Responde ahora con la información que ya tienes, citando fuentes.")])
        resp = client.models.generate_content(
            model=MODEL,
            contents=contents + [cierre],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT.format(leer=""), temperature=0.2),
        )
        respuesta = resp.text or ""

    if not respuesta.strip():
        raise ValueError("El agente no produjo una respuesta.")

    return {
        "query": pregunta,
        "respuesta": respuesta,
        "fuentes": reg.usadas(respuesta),
        "modo": modo,
        "iteraciones": iteraciones,
    }


def _generar_openrouter(pregunta, modo="completo", historial=None):
    """Ejecuta el bucle del agente usando OpenRouter (OpenAI SDK)."""
    import openai
    
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("Falta OPENROUTER_API_KEY en el entorno para usar OpenRouter.")
        
    client = openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )
    
    # Modelo por defecto según plan
    model = "google/gemini-2.5-pro"
    
    reg = Registro()
    max_iters = MAX_ITERS.get(modo, 6)
    
    # 1. Búsqueda Vectorial (RAG en base de datos)
    lore_context = buscar_lore_db(pregunta)
    
    tools = _OPENAI_TOOLS.copy()
    leer_txt = ""
    if modo == "completo":
        tools.append(_OPENAI_TOOL_LEER)
        leer_txt = ", lee con leer_pagina las páginas más prometedoras"
        
    system_instruction = SYSTEM_PROMPT.format(leer=leer_txt)
    
    if modo == "rapido":
        system_instruction += "\n\nIMPORTANTE (MODO RÁPIDO): Responde de forma CONCISA y corta. Ve directo al grano. NO uses explicaciones innecesariamente largas ni exceso de texto."
        
    if lore_context:
        system_instruction += f"\n\nCONTEXTO LORE (Base de datos):\n{lore_context}"
        
    messages = [{"role": "system", "content": system_instruction}]
    for t in _normalizar_historial(historial):
        messages.append({
            "role": "assistant" if t["role"] == "model" else "user",
            "content": t["content"],
        })
    messages.append({"role": "user", "content": pregunta})

    respuesta = ""
    iteraciones = 0
    for iteraciones in range(1, max_iters + 1):
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=tools,
            temperature=0.2,
            max_tokens=2048,
        )
        msg = resp.choices[0].message
        
        if not msg.tool_calls:
            respuesta = msg.content or ""
            break
            
        messages.append(msg.model_dump(exclude_unset=True))
        
        for tool_call in msg.tool_calls:
            fc = tool_call.function
            try:
                args = json.loads(fc.arguments) if fc.arguments else {}
            except Exception:
                args = {}
                
            if fc.name == "buscar_web":
                result = _buscar_web(reg, args.get("query", ""), modo)
            elif fc.name == "buscar_imagen":
                hashtags = args.get("hashtags") or None
                result = _buscar_imagen(args.get("query", ""), hashtags=hashtags)
            elif fc.name == "leer_pagina":
                result = _leer_pagina(reg, args.get("url", ""))
            else:
                result = {"error": f"herramienta desconocida: {fc.name}"}
                
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "name": fc.name,
                "content": json.dumps({"resultado": result}, ensure_ascii=False)
            })
    else:
        # Se agotaron las rondas
        messages.append({"role": "user", "content": "Responde ahora con la información que ya tienes, citando fuentes."})
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
            max_tokens=2048,
        )
        respuesta = resp.choices[0].message.content or ""

    if not respuesta.strip():
        raise ValueError("El agente no produjo una respuesta.")

    return {
        "query": pregunta,
        "respuesta": respuesta,
        "fuentes": reg.usadas(respuesta),
        "modo": modo,
        "iteraciones": iteraciones,
    }


def _generar_local(pregunta, modo="completo", historial=None):
    """Ejecuta el bucle del agente usando un modelo local (ej: LM Studio en puerto 1234)."""
    import openai
    
    # Configuramos el cliente para que apunte al servidor local
    client = openai.OpenAI(
        base_url="http://127.0.0.1:1234/v1",
        api_key="not-needed",
    )
    
    model = "local-model" # LM Studio suele ignorar este campo y usar el modelo cargado
    
    reg = Registro()
    max_iters = MAX_ITERS.get(modo, 6)
    
    # 1. Búsqueda Vectorial (RAG en base de datos)
    lore_context = buscar_lore_db(pregunta)
    
    tools = _OPENAI_TOOLS.copy()
    leer_txt = ""
    if modo == "completo":
        tools.append(_OPENAI_TOOL_LEER)
        leer_txt = ", lee con leer_pagina las páginas más prometedoras"
        
    system_instruction = SYSTEM_PROMPT.format(leer=leer_txt)
    
    if modo == "rapido":
        system_instruction += "\n\nIMPORTANTE (MODO RÁPIDO): Responde de forma CONCISA y corta. Ve directo al grano. NO uses explicaciones innecesariamente largas ni exceso de texto."
        
    if lore_context:
        system_instruction += f"\n\nCONTEXTO LORE (Base de datos):\n{lore_context}"
        
    messages = [{"role": "system", "content": system_instruction}]
    for t in _normalizar_historial(historial):
        messages.append({
            "role": "assistant" if t["role"] == "model" else "user",
            "content": t["content"],
        })
    messages.append({"role": "user", "content": pregunta})

    respuesta = ""
    iteraciones = 0
    for iteraciones in range(1, max_iters + 1):
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=tools,
            temperature=0.2,
            max_tokens=2048,
        )
        msg = resp.choices[0].message

        if not msg.tool_calls:
            respuesta = msg.content or ""
            break

        messages.append(msg)
        for tool_call in msg.tool_calls:
            fc = tool_call.function
            try:
                args = json.loads(fc.arguments) if fc.arguments else {}
            except Exception:
                args = {}
                
            if fc.name == "buscar_web":
                result = _buscar_web(reg, args.get("query", ""), modo)
            elif fc.name == "buscar_imagen":
                hashtags = args.get("hashtags") or None
                result = _buscar_imagen(args.get("query", ""), hashtags=hashtags)
            elif fc.name == "leer_pagina":
                result = _leer_pagina(reg, args.get("fuente", -1))
            else:
                result = {"error": "herramienta desconocida"}

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "name": fc.name,
                "content": json.dumps(result, ensure_ascii=False),
            })
            
    else:
        # Se agotaron las iteraciones, forzamos cierre
        messages.append({
            "role": "user",
            "content": "Responde ahora con la información que ya tienes, citando fuentes."
        })
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
            max_tokens=2048,
        )
        respuesta = resp.choices[0].message.content or ""

    if not respuesta.strip():
        raise ValueError("El agente local no produjo una respuesta.")

    return {
        "query": pregunta,
        "respuesta": respuesta,
        "fuentes": reg.usadas(respuesta),
        "modo": modo,
        "iteraciones": iteraciones,
    }


def generar_respuesta(pregunta, modo="completo", historial=None):
    """Punto de entrada principal. Enruta la petición al proveedor configurado.

    `historial`: turnos previos de la MISMA conversación, como lista de dicts
    {"role": "user"|"assistant", "content": str}, para que el agente entienda
    preguntas de seguimiento.
    """
    provider = os.environ.get("LLM_PROVIDER", "gemini").strip().lower()
    if provider == "openrouter":
        return _generar_openrouter(pregunta, modo, historial)
    elif provider == "local":
        return _generar_local(pregunta, modo, historial)
    else:
        return _generar_gemini(pregunta, modo, historial)



if __name__ == "__main__":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    pregunta = " ".join(sys.argv[1:]) or input("Pregunta: ").strip()
    if not pregunta:
        sys.exit("No escribiste ninguna pregunta.")
    try:
        r = generar_respuesta(pregunta)
    except (RuntimeError, ValueError) as e:
        sys.exit(f"[ERROR] {e}")
    print(r["respuesta"])
    print(f"\n({r['iteraciones']} iteraciones)")
    print("Fuentes:")
    for f in r["fuentes"]:
        print(f"  [{f['fuente']}] {f['url']}")


# ---------------------- Búsqueda y guardado de imágenes ----------------------

IMAGES_DIR = os.environ.get("IMAGES_DIR", str(Path(__file__).parent / "imagenes"))


def buscar_y_guardar_imagenes(
    personaje: str,
    juego: str,
    max_imgs: int = 8,
    dest_dir: str | None = None,
) -> dict:
    """Busca imágenes del personaje en Pixiv, Pinterest, ArtStation y general,
    y las descarga localmente en {dest_dir}/{juego-slug}/{personaje-slug}/.

    Retorna un dict con:
        personaje, juego, carpeta, guardadas, fallidas, total
    """
    target_dir = dest_dir or IMAGES_DIR
    query = f"{personaje} {juego}"
    # Usamos query_images_art para priorizar plataformas de arte
    imagenes = query_images_art(query, max_results=max(max_imgs + 4, 12))
    if not imagenes:
        # Fallback genérico
        imagenes = query_images(f"{query} character art", max_results=max_imgs + 4)
    resultado = asyncio.run(download_images(imagenes, juego, personaje, max_imgs=max_imgs, dest_dir=target_dir))
    return {
        "personaje": personaje,
        "juego": juego,
        **resultado,
    }
