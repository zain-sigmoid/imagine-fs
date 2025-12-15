"""Tests for mapping provider exceptions to domain errors and handlers."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.handlers.error_handler import (
    MapExceptions,
    ImageProviderError,
    OpenAIImageError,
    GeminiImageError,
)

# --- External exceptions ----------------------------------------------------


openai_mod = pytest.importorskip(
    "openai",
    reason="openai package is required to test OpenAI exception mapping",
)
from openai import (  # type: ignore
    APIError,
    RateLimitError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    APIConnectionError,
)

google_exceptions_mod = pytest.importorskip(
    "google.api_core.exceptions",
    reason="google-api-core is required to test Gemini exception mapping",
)
from google.api_core.exceptions import (  # type: ignore
    GoogleAPIError,
    DeadlineExceeded,
    ResourceExhausted,
    InvalidArgument,
    PermissionDenied,
)


# --- Basic ImageProviderError tests ----------------------------------------


class TestImageProviderErrorBasics:
    def test_str_representation(self):
        err = ImageProviderError(
            provider="test_provider",
            message="Something went wrong",
            status_code=500,
            error_type="test_error",
            details={"foo": "bar"},
        )

        s = str(err)
        assert "[test_provider]" in s
        assert "test_error" in s
        assert "Something went wrong" in s


# --- OpenAI mapping tests ---------------------------------------------------


class TestMapOpenAIExceptions:
    def setup_method(self):
        self.mapper = MapExceptions()
        from httpx import Request, Response

        self._req = Request("GET", "https://example.com/test")
        self._resp = Response(status_code=400, request=self._req)

    def test_rate_limit_error(self):
        exc = RateLimitError(message="rate limited", response=self._resp, body=None)
        mapped = self.mapper.map_openai_exception(exc)

        assert isinstance(mapped, OpenAIImageError)
        assert mapped.status_code == 429
        assert mapped.error_type == "rate_limit"
        assert "rate limit" in mapped.message.lower()

    def test_timeout_error(self):
        exc = APITimeoutError("timeout")
        mapped = self.mapper.map_openai_exception(exc)

        assert isinstance(mapped, OpenAIImageError)
        assert mapped.status_code == 504
        assert mapped.error_type == "timeout"
        assert "timed out" in mapped.message.lower()

    def test_authentication_error(self):
        exc = AuthenticationError(message="bad key", response=self._resp, body=None)
        mapped = self.mapper.map_openai_exception(exc)

        assert isinstance(mapped, OpenAIImageError)
        assert mapped.status_code == 401
        assert mapped.error_type == "auth_error"
        assert "authentication" in mapped.message.lower()

    def test_bad_request_error(self):
        exc = BadRequestError(
            message="bad request",
            response=self._resp,
            body=None,
        )
        mapped = self.mapper.map_openai_exception(exc)

        assert isinstance(mapped, OpenAIImageError)
        assert mapped.status_code == 400
        assert mapped.error_type == "bad_request"
        assert "invalid request" in mapped.message.lower()

    def test_connection_error(self):
        exc = APIConnectionError(message="connection issue", request=None)
        mapped = self.mapper.map_openai_exception(exc)

        assert isinstance(mapped, OpenAIImageError)
        assert mapped.status_code == 503
        assert mapped.error_type == "connection_error"
        assert "could not connect" in mapped.message.lower()

    def test_generic_api_error(self):
        exc = APIError(message="generic api issue", body=None, request=self._req)
        mapped = self.mapper.map_openai_exception(exc)

        assert isinstance(mapped, OpenAIImageError)
        assert mapped.status_code == 502
        assert mapped.error_type == "api_error"
        assert "internal error" in mapped.message.lower()

    def test_unknown_exception(self):
        class CustomException(Exception):
            pass

        exc = CustomException("something else")
        mapped = self.mapper.map_openai_exception(exc)

        assert isinstance(mapped, OpenAIImageError)
        assert mapped.status_code == 500
        assert mapped.error_type == "unknown_error"
        assert "unexpected error" in mapped.message.lower()
        assert mapped.details is not None
        assert mapped.details["exception_type"] == "CustomException"


# --- Gemini mapping tests ---------------------------------------------------
class DummyResourceExhausted(ResourceExhausted):
    def __init__(self, *args, **kwargs):
        pass

    def __str__(self):
        return "ResourceExhausted"


class TestMapGeminiExceptions:
    def setup_method(self):
        self.mapper = MapExceptions()

    def test_resource_exhausted(self):
        exc = ResourceExhausted("quota exceeded")
        mapped = self.mapper.map_gemini_exception(exc)

        assert isinstance(mapped, GeminiImageError)
        assert mapped.status_code == 429
        assert mapped.error_type == "rate_limit"
        assert "usage limits" in mapped.message.lower()

    def test_deadline_exceeded(self):
        exc = DeadlineExceeded("deadline")
        mapped = self.mapper.map_gemini_exception(exc)

        assert isinstance(mapped, GeminiImageError)
        assert mapped.status_code == 504
        assert mapped.error_type == "timeout"
        assert "timed out" in mapped.message.lower()

    def test_invalid_argument(self):
        exc = InvalidArgument("bad arg")
        mapped = self.mapper.map_gemini_exception(exc)

        assert isinstance(mapped, GeminiImageError)
        assert mapped.status_code == 400
        assert mapped.error_type == "bad_request"
        assert "invalid request" in mapped.message.lower()

    def test_permission_denied(self):
        exc = PermissionDenied("denied")
        mapped = self.mapper.map_gemini_exception(exc)

        assert isinstance(mapped, GeminiImageError)
        assert mapped.status_code == 403
        assert mapped.error_type == "permission_denied"
        assert "access denied" in mapped.message.lower()

    def test_generic_google_api_error(self):
        exc = GoogleAPIError("google api error")
        mapped = self.mapper.map_gemini_exception(exc)

        assert isinstance(mapped, GeminiImageError)
        assert mapped.status_code == 502
        assert mapped.error_type == "api_error"
        assert "internal error" in mapped.message.lower()

    def test_unknown_exception(self):
        class CustomException(Exception):
            pass

        exc = CustomException("some other issue")
        mapped = self.mapper.map_gemini_exception(exc)

        assert isinstance(mapped, GeminiImageError)
        assert mapped.status_code == 500
        assert mapped.error_type == "unknown_error"
        assert "unexpected error" in mapped.message.lower()
        assert mapped.details is not None
        assert mapped.details["exception_type"] == "CustomException"


# --- FastAPI handler integration tests -------------------------------------


def create_test_app():
    app = FastAPI()
    MapExceptions.register_exception_handlers(app)

    @app.get("/raise-openai")
    async def raise_openai():
        # Simulate code that already mapped an OpenAI exception
        raise OpenAIImageError(
            message="Simulated OpenAI failure",
            status_code=418,
            error_type="teapot",
        )

    @app.get("/raise-gemini")
    async def raise_gemini():
        raise GeminiImageError(
            message="Simulated Gemini failure",
            status_code=400,
            error_type="bad_request",
            details={"foo": "bar"},
        )

    return app


class TestFastAPIExceptionHandler:
    def setup_method(self):
        self.app = create_test_app()
        self.client = TestClient(self.app)

    def test_openai_error_response_shape(self):
        resp = self.client.get("/raise-openai")
        assert resp.status_code == 418

        data = resp.json()
        assert data["status"] == "error"
        assert data["provider"] == "openai"
        assert data["error_type"] == "teapot"
        assert data["message"] == "Simulated OpenAI failure"
        # details is optional, but should still be present (None)
        assert "details" in data

    def test_gemini_error_response_shape(self):
        resp = self.client.get("/raise-gemini")
        assert resp.status_code == 400

        data = resp.json()
        assert data["status"] == "error"
        assert data["provider"] == "gemini"
        assert data["error_type"] == "bad_request"
        assert data["message"] == "Simulated Gemini failure"
        assert data["details"] == {"foo": "bar"}
