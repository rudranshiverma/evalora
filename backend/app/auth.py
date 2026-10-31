import base64
import binascii
from secrets import compare_digest

from starlette.responses import PlainTextResponse
from starlette.types import ASGIApp, Receive, Scope, Send

OPEN_PATHS = {"/healthz"}


class BasicAuthMiddleware:
    def __init__(self, app: ASGIApp, username: str, password: str):
        self.app = app
        self.username = username.encode()
        self.password = password.encode()

    def authorized(self, header: bytes) -> bool:
        scheme, _, encoded = header.partition(b" ")
        if scheme.lower() != b"basic":
            return False
        try:
            username, _, password = base64.b64decode(encoded, validate=True).partition(b":")
        except (binascii.Error, ValueError):
            return False
        username_ok = compare_digest(username, self.username)
        password_ok = compare_digest(password, self.password)
        return username_ok and password_ok

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["path"] in OPEN_PATHS:
            await self.app(scope, receive, send)
            return
        if self.authorized(dict(scope["headers"]).get(b"authorization", b"")):
            await self.app(scope, receive, send)
            return
        response = PlainTextResponse(
            "Sign in to use Evalora.",
            status_code=401,
            headers={"WWW-Authenticate": 'Basic realm="Evalora", charset="UTF-8"'},
        )
        await response(scope, receive, send)
