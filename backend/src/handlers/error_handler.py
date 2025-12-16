"""Error handling helpers for mapping provider failures to API responses."""

# handlers.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional, Dict

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from src.utility.logger import AppLogger

logger = AppLogger.get_logger(__name__)

try:
    from openai import (
        APIError,
        RateLimitError,
        APITimeoutError,
        AuthenticationError,
        BadRequestError,
        APIConnectionError,
    )
except Exception:
    APIError = RateLimitError = APITimeoutError = AuthenticationError = BadRequestError = APIConnectionError = Exception  # type: ignore

try:
    # Gemini / Google generative AI errors
    from google.api_core.exceptions import (
        GoogleAPIError,
        DeadlineExceeded,
        ResourceExhausted,
        InvalidArgument,
        PermissionDenied,
    )
except Exception:
    GoogleAPIError = DeadlineExceeded = ResourceExhausted = InvalidArgument = (
        PermissionDenied
    ) = Exception


@dataclass
class ImageProviderError(Exception):
    """
    Base error for all image-provider failures (OpenAI, Gemini, etc.)
    This is what FastAPI will ultimately handle and send as JSON.
    """

    provider: str
    message: str
    status_code: int = 500
    error_type: str = "provider_error"
    details: Optional[Dict[str, Any]] = None

    def __str__(self) -> str:  # nice log output
        """Format a readable representation for logging and responses."""
        return f"[{self.provider}] {self.error_type}: {self.message}"


class OpenAIImageError(ImageProviderError):
    """
    Represents errors originating from OpenAI's image generation or editing API.
    Provides structured error details including status, type, and provider context.
    """

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_type: str = "openai_error",
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Initializing Image Error class for openai model by inheriting ImageProviderError class"""
        super().__init__(
            provider="openai",
            message=message,
            status_code=status_code,
            error_type=error_type,
            details=details,
        )


class GeminiImageError(ImageProviderError):
    """
    Represents errors raised during Gemini-based image processing operations.
    Encapsulates standardized metadata such as status code and provider type.
    """

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_type: str = "gemini_error",
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Initializing Image Error class for gemini model by inheriting ImageProviderError class"""
        super().__init__(
            provider="gemini",
            message=message,
            status_code=status_code,
            error_type=error_type,
            details=details,
        )


class MapExceptions:
    """Register and translate provider-specific exceptions into API-friendly errors.

    Encapsulates reusable handlers so the FastAPI app can remain clean.
    Intended to centralize logging and status code mapping.
    Safe to instantiate with default configuration.
    """

    def __init__(self):
        """Initialize the mapper without additional configuration."""
        pass

    def map_openai_exception(self, exc: Exception) -> OpenAIImageError:
        """
        Map low-level OpenAI exceptions to a clean domain error
        that the rest of your app (and FastAPI) understands.
        """
        logger.error("OpenAI error during image generation", exc_info=exc)

        if isinstance(exc, RateLimitError):
            return OpenAIImageError(
                message="OpenAI rate limit reached. Please try again in a moment.",
                status_code=429,
                error_type="rate_limit",
            )
        if isinstance(exc, APITimeoutError):
            return OpenAIImageError(
                message="OpenAI timed out while generating the image.",
                status_code=504,
                error_type="timeout",
            )
        if isinstance(exc, AuthenticationError):
            return OpenAIImageError(
                message="Authentication with OpenAI failed. Check API key configuration.",
                status_code=401,
                error_type="auth_error",
            )
        if isinstance(exc, BadRequestError):
            return OpenAIImageError(
                message="Invalid request sent to OpenAI. Please verify your prompt or parameters.",
                status_code=400,
                error_type="bad_request",
            )
        if isinstance(exc, APIConnectionError):
            return OpenAIImageError(
                message="Could not connect to OpenAI. Please check network or OpenAI status.",
                status_code=503,
                error_type="connection_error",
            )
        if isinstance(exc, APIError):
            # Generic API error
            return OpenAIImageError(
                message="OpenAI encountered an internal error while generating the image.",
                status_code=502,
                error_type="api_error",
            )

        # Fallback unknown error
        return OpenAIImageError(
            message="An unexpected error occurred while generating the image with OpenAI.",
            status_code=500,
            error_type="unknown_error",
            details={"exception_type": exc.__class__.__name__},
        )

    def map_gemini_exception(self, exc: Exception) -> GeminiImageError:
        """
        Map low-level Gemini / Google exceptions to a clean domain error.
        """
        logger.error("Gemini error during image generation", exc_info=exc)

        if isinstance(exc, ResourceExhausted):
            return GeminiImageError(
                message="Gemini usage limits reached. Please try again later.",
                status_code=429,
                error_type="rate_limit",
            )
        if isinstance(exc, DeadlineExceeded):
            return GeminiImageError(
                message="Gemini timed out while generating the image.",
                status_code=504,
                error_type="timeout",
            )
        if isinstance(exc, InvalidArgument):
            return GeminiImageError(
                message="Invalid request sent to Gemini. Please verify your prompt or parameters.",
                status_code=400,
                error_type="bad_request",
            )
        if isinstance(exc, PermissionDenied):
            return GeminiImageError(
                message="Access denied when calling Gemini. Check credentials or project permissions.",
                status_code=403,
                error_type="permission_denied",
            )
        if isinstance(exc, GoogleAPIError):
            return GeminiImageError(
                message="Gemini encountered an internal error while generating the image.",
                status_code=502,
                error_type="api_error",
            )

        return GeminiImageError(
            message="An unexpected error occurred while generating the image with Gemini.",
            status_code=500,
            error_type="unknown_error",
            details={"exception_type": exc.__class__.__name__},
        )

    @staticmethod
    def register_exception_handlers(app: FastAPI) -> None:
        """
        Call this once in your main FastAPI app to register handlers:

            from handlers import register_exception_handlers
            app = FastAPI()
            register_exception_handlers(app)
        """

        @app.exception_handler(ImageProviderError)
        async def image_provider_error_handler(
            request: Request, exc: ImageProviderError
        ) -> JSONResponse:
            logger.error(
                "ImageProviderError caught by FastAPI handler",
                extra={"provider": exc.provider, "type": exc.error_type},
            )

            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "status": "error",
                    "provider": exc.provider,
                    "error_type": exc.error_type,
                    "message": exc.message,
                    "details": exc.details,
                },
            )
