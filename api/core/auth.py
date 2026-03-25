"""
Authentication & Authorization Module
Supports: JWT (Keycloak OIDC), API Keys, Service Accounts
"""
from fastapi import Depends, HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from jose import jwt, JWTError, jwk
from pydantic import BaseModel
from typing import Optional, List
import httpx
import os
import logging

from api.core.config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


class User(BaseModel):
    username: str
    email: Optional[str] = None
    roles: List[str] = []
    is_admin: bool = False
    token: Optional[str] = None


class TokenPayload(BaseModel):
    sub: str
    exp: int
    preferred_username: Optional[str] = None
    email: Optional[str] = None
    realm_access: Optional[dict] = None


# Keycloak JWKS cache
_jwks_cache = None


async def _get_jwks():
    """Fetch JWKS from Keycloak for token verification"""
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    
    jwks_url = f"{settings.KEYCLOAK_URL}/realms/{settings.KEYCLOAK_REALM}/protocol/openid-connect/certs"
    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url)
        _jwks_cache = resp.json()
    return _jwks_cache


async def verify_token(token: str) -> TokenPayload:
    """Verify JWT token from Keycloak"""
    try:
        if settings.TESTING:
            # In test mode, decode without verification
            payload = jwt.decode(token, "test-secret", algorithms=["HS256"])
        else:
            jwks = await _get_jwks()
            unverified_header = jwt.get_unverified_header(token)
            
            rsa_key = None
            for key in jwks.get("keys", []):
                if key["kid"] == unverified_header.get("kid"):
                    rsa_key = key
                    break
            
            if not rsa_key:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token key"
                )
            
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                audience=settings.KEYCLOAK_CLIENT_ID,
                issuer=f"{settings.KEYCLOAK_URL}/realms/{settings.KEYCLOAK_REALM}"
            )
        
        return TokenPayload(**payload)
    
    except JWTError as e:
        logger.warning(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    api_key: Optional[str] = Security(api_key_header)
) -> User:
    """Get the current authenticated user from JWT or API key"""
    
    if settings.TESTING:
        return User(username="test-user", email="test@example.com", roles=["admin"], is_admin=True)
    
    # Try JWT token first
    if credentials:
        payload = await verify_token(credentials.credentials)
        roles = []
        if payload.realm_access:
            roles = payload.realm_access.get("roles", [])
        
        return User(
            username=payload.preferred_username or payload.sub,
            email=payload.email,
            roles=roles,
            is_admin="admin" in roles,
            token=credentials.credentials
        )
    
    # Try API key
    if api_key:
        # Validate API key against database
        user = await _validate_api_key(api_key)
        if user:
            return user
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing authentication credentials",
        headers={"WWW-Authenticate": "Bearer"}
    )


async def _validate_api_key(api_key: str) -> Optional[User]:
    """Validate an API key against the database"""
    # TODO: Implement API key lookup from database
    return None


def require_role(required_role: str):
    """Dependency to check if user has a specific role"""
    async def role_checker(current_user: User = Depends(get_current_user)):
        if required_role not in current_user.roles and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required"
            )
        return current_user
    return role_checker


def require_admin():
    """Dependency to check if user is admin"""
    return require_role("admin")
