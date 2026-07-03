"""Motor de búsqueda y extracción de contenido web.

Expone cuatro capacidades reutilizables:
    query_combined(query)           -> lista de resultados {title, href, body}
    query_images(query)             -> lista de imágenes {title, image, thumbnail, url}
    download_images(...)            -> descarga y guarda imágenes en {dest}/{juego}/{personaje}/
    scrape_all_async(urls)          -> contenido limpio (markdown) de varias páginas
"""

import asyncio
import concurrent.futures
import mimetypes
import re
from pathlib import Path

import httpx
import primp
from bs4 import BeautifulSoup
from markdownify import markdownify as md
from ddgs import DDGS

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
)

SEARXNG_INSTANCES = [
    "https://paulgo.io",
    "https://opnxng.com",
    "https://ooglester.com",
    "https://copp.gg",
    "https://search.catboy.house",
    "https://search.mdosch.de",
    "https://searx.dresden.network",
    "https://priv.au",
    "https://searx.be",
    "https://searx.work",
]


# --------------------------------- Búsqueda ---------------------------------

def query_ddg(query):
    try:
        with DDGS() as ddgs:
            return list(ddgs.text(query, max_results=8))
    except Exception:
        return []


def query_images(query, max_results=12):
    """Busca imágenes en DuckDuckGo. Devuelve URLs directas a las imágenes."""
    try:
        with DDGS() as ddgs:
            return [
                {
                    "title": r.get("title", ""),
                    "image": r.get("image", ""),
                    "thumbnail": r.get("thumbnail", ""),
                    "url": r.get("url", ""),
                }
                for r in ddgs.images(query, max_results=max_results)
                if r.get("image")
            ]
    except Exception:
        return []


# Plataformas de arte/social que priorizamos en la búsqueda de personajes
_ART_PLATFORMS = [
    "pixiv",
    "pinterest",
    "artstation",
    "deviantart",
    "twitter",
    "x.com",
]


def _query_images_single(query: str, max_results: int) -> list:
    """Worker bloqueante: una sola búsqueda DDG."""
    try:
        with DDGS() as ddgs:
            return [
                {
                    "title": r.get("title", ""),
                    "image": r.get("image", ""),
                    "thumbnail": r.get("thumbnail", ""),
                    "url": r.get("url", ""),
                }
                for r in ddgs.images(query, max_results=max_results)
                if r.get("image")
            ]
    except Exception:
        return []


def _to_hashtags(text: str) -> str:
    """Convierte un nombre a hashtag CamelCase.

    Ejemplos:
        "Encore"          -> "#Encore"
        "Wuthering Waves" -> "#WutheringWaves"
        "Genshin Impact"  -> "#GenshinImpact"
    """
    words = re.sub(r"[^\w\s]", "", text).split()
    return "#" + "".join(w.capitalize() for w in words if w)


def query_images_art(
    base_query: str,
    max_results: int = 12,
    hashtags: list[str] | None = None,
) -> list:
    """Busca imágenes del personaje en múltiples plataformas en paralelo.

    Siempre lanza 3 búsquedas simultáneas en DuckDuckGo:
      1. Base:   '{query} character art render'              (general, alta calidad)
      2. Pixiv:  '{query} character art pixiv'               (ilustraciones)
      3. Social: '{query} character art pinterest artstation' (variedad)

    Si se proporcionan `hashtags` (ej. ["#Encore", "#WutheringWaves"]),
    lanza una 4ª búsqueda adicional con esos hashtags exactos:
      4. Hashtag: '#Encore #WutheringWaves character art'

    Fusiona los resultados, eliminando duplicados por URL de imagen.
    Los resultados de plataformas de arte/social van primero.
    """
    queries = [
        (f"{base_query} character art render",               max_results),
        (f"{base_query} character art pixiv",                max_results // 2),
        (f"{base_query} character art pinterest artstation", max_results // 2),
    ]

    # Búsqueda por hashtag: solo si el usuario la pidió explícitamente
    if hashtags:
        cleaned = " ".join(
            h if h.startswith("#") else f"#{h}"
            for h in hashtags
            if h.strip()
        )
        queries.append((f"{cleaned} character art", max_results // 2))

    workers = len(queries)
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futures = [ex.submit(_query_images_single, q, n) for q, n in queries]
        lotes = [f.result() for f in concurrent.futures.as_completed(futures, timeout=12.0)]

    # Detectar si el resultado viene de una plataforma de arte/social
    def _is_art_platform(item: dict) -> bool:
        url = (item.get("url") or "").lower()
        return any(p in url for p in _ART_PLATFORMS)

    # Deduplicar por URL de imagen y ordenar: art-platforms/social primero
    seen_images: set[str] = set()
    art: list = []
    rest: list = []
    for lote in lotes:
        for item in lote:
            img_url = item.get("image", "")
            if not img_url or img_url in seen_images:
                continue
            seen_images.add(img_url)
            if _is_art_platform(item):
                art.append(item)
            else:
                rest.append(item)

    return art + rest




def _slugify(text: str) -> str:
    """Convierte texto en un slug seguro para usar en rutas de carpetas."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-") or "sin-nombre"


async def _download_single_image(
    client: httpx.AsyncClient, url: str, dest_path: Path, idx: int
) -> dict:
    """Descarga una imagen y la guarda. Devuelve info del resultado."""
    try:
        resp = await client.get(url, timeout=8.0, follow_redirects=True)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "image/jpeg")
        ext = mimetypes.guess_extension(content_type.split(";")[0].strip()) or ".jpg"
        # Normalizar extensiones comunes
        if ext in (".jpe", ".jpeg"):
            ext = ".jpg"
        elif ext == ".svg+xml":
            ext = ".svg"
        file_path = dest_path / f"img_{idx:02d}{ext}"
        file_path.write_bytes(resp.content)
        return {"ok": True, "path": str(file_path), "url": url, "size_kb": round(len(resp.content) / 1024, 1)}
    except Exception as e:
        return {"ok": False, "url": url, "error": str(e)}


async def download_images(
    images: list,
    juego: str,
    personaje: str,
    max_imgs: int = 8,
    dest_dir: str = "./imagenes",
) -> dict:
    """Descarga una lista de imágenes ({image: url, title: ...}) y las guarda en
    {dest_dir}/{juego-slug}/{personaje-slug}/img_NN.ext

    Retorna:
        carpeta   : ruta de la carpeta creada
        guardadas : lista de {path, url, size_kb}
        fallidas  : lista de {url, error}
        total     : número de imágenes guardadas con éxito
    """
    juego_slug = _slugify(juego)
    personaje_slug = _slugify(personaje)
    dest_path = Path(dest_dir) / juego_slug / personaje_slug
    dest_path.mkdir(parents=True, exist_ok=True)

    urls = [img["image"] for img in images[:max_imgs] if img.get("image")]

    async with httpx.AsyncClient(
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
        timeout=8.0,
    ) as client:
        tareas = [
            _download_single_image(client, url, dest_path, idx + 1)
            for idx, url in enumerate(urls)
        ]
        resultados = await asyncio.gather(*tareas, return_exceptions=False)

    guardadas = [r for r in resultados if r.get("ok")]
    fallidas  = [r for r in resultados if not r.get("ok")]

    return {
        "carpeta": str(dest_path),
        "guardadas": guardadas,
        "fallidas": fallidas,
        "total": len(guardadas),
    }


def query_searxng_instance(inst, query):
    client = primp.Client(impersonate="random")

    # 1. API JSON.
    try:
        r = client.get(f"{inst.rstrip('/')}/search?q={query}&format=json", timeout=3.0)
        if r.status_code == 200:
            results = r.json().get("results", [])
            if results:
                return [
                    {
                        "title": i.get("title", ""),
                        "href": i.get("url", ""),
                        "body": i.get("content", ""),
                    }
                    for i in results
                ]
    except Exception:
        pass

    # 2. Fallback: scraping del HTML de resultados.
    try:
        r = client.get(f"{inst.rstrip('/')}/search?q={query}", timeout=3.0)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            formatted = []
            for res in soup.select(".result, article, .result-default"):
                title_el = res.select_one("h3 a, h4 a, .result_header a") or \
                    res.select_one("a:not(.url_header)")
                desc_el = res.select_one(".content, .result-content, p, .snippet")
                if not title_el:
                    continue
                href = title_el.get("href")
                if href and not href.startswith(("/", "#")):
                    formatted.append({
                        "title": title_el.get_text(strip=True),
                        "href": href,
                        "body": desc_el.get_text(strip=True) if desc_el else "",
                    })
            if formatted:
                return formatted
    except Exception:
        pass

    return None


def query_searxng(query):
    """Consulta varias instancias en paralelo y devuelve la primera con éxito."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(SEARXNG_INSTANCES)) as ex:
        futures = [ex.submit(query_searxng_instance, inst, query) for inst in SEARXNG_INSTANCES]
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res:
                return res
    return []


def query_combined(query, min_results=4, overall_timeout=5.0):
    """Consulta DDG y SearXNG en paralelo y devuelve en cuanto uno entrega
    suficientes resultados, sin esperar al motor más lento."""
    results = []
    seen = set()

    def add(items):
        for item in items or []:
            norm = item.get("href", "").rstrip("/").lower().replace("https://", "http://")
            if norm and norm not in seen:
                seen.add(norm)
                results.append(item)

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)
    futures = [executor.submit(query_ddg, query), executor.submit(query_searxng, query)]
    try:
        for fut in concurrent.futures.as_completed(futures, timeout=overall_timeout):
            try:
                add(fut.result())
            except Exception:
                pass
            if len(results) >= min_results:
                break
    except concurrent.futures.TimeoutError:
        pass
    finally:
        executor.shutdown(wait=False, cancel_futures=True)

    return results


# --------------------------------- Scraping ---------------------------------

async def scrape_single_async(client, url):
    """Descarga una URL y devuelve {url, title, content} con el texto en markdown."""
    try:
        response = await client.get(url, headers={"User-Agent": USER_AGENT}, timeout=3.0)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        title = (soup.title.string if soup.title else "Sin Título").strip()

        for tag in soup(["script", "style", "nav", "footer", "header", "aside",
                         "iframe", "form", "noscript", "svg", "button", "input"]):
            tag.decompose()

        main = None
        for selector in ["article", '[role="main"]', "main", "#content", "#main",
                         ".post", ".article", ".entry-content"]:
            found = soup.select_one(selector)
            if found and len(found.get_text(strip=True)) > 200:
                main = found
                break
        if not main:
            main = soup.body or soup

        markdown = md(str(main), heading_style="ATX", bullets="-",
                      strip=["img", "button", "form", "input"])

        # Colapsa líneas en blanco consecutivas.
        cleaned = []
        prev_empty = False
        for line in (l.strip() for l in markdown.split("\n")):
            if line:
                cleaned.append(line)
                prev_empty = False
            elif not prev_empty:
                cleaned.append("")
                prev_empty = True

        return {"url": url, "title": title, "content": "\n".join(cleaned).strip()}
    except Exception as e:
        return {"url": url, "title": "Error de extracción",
                "content": f"No se pudo extraer contenido: {e}"}


async def scrape_all_async(urls):
    """Raspa varias URLs en paralelo. Un timeout corto evita que una página lenta
    arrastre a todo el gather (que espera a la más lenta)."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=3.0) as client:
        tareas = [scrape_single_async(client, url) for url in urls]
        return await asyncio.gather(*tareas, return_exceptions=True)
