"""
Reverse proxy that bridges the platform's fixed topology to the Next.js app.

The Kubernetes ingress routes every `/api/*` request to this service on port 8001,
and everything else to the Next.js dev server on port 3000. Next.js serves both its
pages AND its API route handlers on port 3000, so this proxy simply forwards the
incoming `/api/*` requests to Next.js and streams the response back — preserving
status, headers, cookies (multiple Set-Cookie), and streaming bodies.
"""
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from starlette.background import BackgroundTask

app = FastAPI()

NEXT_ORIGIN = "http://127.0.0.1:3000"
client = httpx.AsyncClient(base_url=NEXT_ORIGIN, timeout=httpx.Timeout(300.0))

# Headers that must not be copied verbatim between hops.
HOP_BY_HOP = {
    "content-length", "transfer-encoding", "connection", "keep-alive",
    "proxy-authenticate", "proxy-authorization", "te", "trailers", "upgrade", "host",
}


@app.get("/api/_proxy_health")
async def proxy_health():
    try:
        r = await client.get("/api/_proxy_health_upstream", timeout=2.0)
        upstream = r.status_code
    except Exception:
        upstream = "down"
    return JSONResponse({"proxy": "ok", "next_upstream": upstream})


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy(path: str, request: Request):
    url = "/" + path
    body = await request.body()
    fwd_headers = {
        k: v for k, v in request.headers.items() if k.lower() not in HOP_BY_HOP
    }

    try:
        upstream_req = client.build_request(
            request.method,
            url,
            params=request.query_params,
            content=body,
            headers=fwd_headers,
        )
        upstream = await client.send(upstream_req, stream=True)
    except Exception as exc:
        return JSONResponse(
            {"error": "upstream_unavailable", "detail": str(exc)}, status_code=502
        )

    # Copy response headers, preserving multiple Set-Cookie entries.
    set_cookies = [
        v for k, v in upstream.headers.multi_items() if k.lower() == "set-cookie"
    ]
    resp_headers = {
        k: v
        for k, v in upstream.headers.items()
        if k.lower() not in HOP_BY_HOP and k.lower() != "set-cookie"
    }

    async def body_stream():
        async for chunk in upstream.aiter_raw():
            yield chunk

    response = StreamingResponse(
        body_stream(),
        status_code=upstream.status_code,
        headers=resp_headers,
        background=BackgroundTask(upstream.aclose),
    )
    for cookie in set_cookies:
        response.raw_headers.append((b"set-cookie", cookie.encode("latin-1")))
    return response
