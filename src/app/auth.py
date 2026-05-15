"""Supabase JWT verification for FastAPI routes."""
from functools import lru_cache
from typing import Annotated

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..config import settings

bearer = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _get_jwks() -> dict:
    """Fetch Supabase JWKS (cached for process lifetime)."""
    url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _verify_token(token: str) -> dict:
    jwks = _get_jwks()
    keys = {k["kid"]: jwt.algorithms.RSAAlgorithm.from_jwk(k) for k in jwks["keys"]}
    header = jwt.get_unverified_header(token)
    key = keys.get(header["kid"])
    if not key:
        raise ValueError("Unknown signing key")
    payload = jwt.decode(
        token,
        key,
        algorithms=["RS256"],
        audience="authenticated",
        options={"verify_exp": True},
    )
    return payload


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = _verify_token(credentials.credentials)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return payload


def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> dict | None:
    if not credentials:
        return None
    try:
        return _verify_token(credentials.credentials)
    except Exception:
        return None
