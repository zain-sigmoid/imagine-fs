"""API routes for image generation, streaming, and retrieval."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

import io
from typing import Any
import traceback

from src.config.options import Options
from src.services.edit_service.editor import Edit
from src.services.edit_service.main import ImageImpainting as ii
from src.services.image_generation_service.model import Imagine
from src.services.image_generation_service.generate import Generation
from src.services.image_generation_service.main import ImageGeneration as ig
from src.models.generate import (
    GenerateRequest,
    GenerateResponse,
    RelatedRequest,
)
from src.models.edit_image import EditRequest, EditResponse
from src.utility.logger import AppLogger

router = APIRouter(prefix="/api/image", tags=["Image"])
logger = AppLogger.get_logger(__name__)


@router.get("/options")
async def get_options(
    service: Options = Depends(ig.get_image_generation_options),
) -> dict[str, Any]:
    """Return the available design options for clients to render selection UI."""
    try:
        options = service.get_options()
        return options
    except Exception as e:
        logger.error(f"Exception Occurred : {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.post("/generate", response_model=GenerateResponse)
async def generate(
    payload: GenerateRequest,
    service: Generation = Depends(ig.get_image_generation),
) -> GenerateResponse:
    """Generate a full set of images for the requested context."""
    try:
        result = service.generate_image(context=payload)
        return result
    except Exception as e:
        logger.error(f"Exception Occurred : {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.post("/generate/stream")
async def generate_stream(
    payload: GenerateRequest,
    service: Generation = Depends(ig.get_image_generation),
):
    """Stream image generation events so the client can render partial results."""

    async def event_stream():
        """Yield streaming chunks from the generation service."""
        async for chunk in service.generate_image_stream(context=payload):
            yield chunk

    return StreamingResponse(event_stream(), media_type="application/json")


@router.post("/edit")
async def edit_image(
    payload: EditRequest, service: Edit = Depends(ii.get_editor)
) -> EditResponse:
    """
    Edit an existing generated image using Gemini or OpenAI.
    `model` can be 'gemini' or 'openai' (query param).
    """
    try:
        resp = service.edit_image(payload, model="gemini")
        return resp
    except HTTPException as he:
        logger.error(f"Exception occurred in edit ep: {he}")
        raise
    except Exception as e:
        logger.error(f"Edit endpoint error: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error while editing image.",
        )


@router.delete("/delete")
async def delete_image(imageId: str, service: Imagine = Depends(ig.get_imagine)):
    """
    Delete an image given its imageId (stamp).
    """
    try:
        success = service.delete_image(imageId)

        if not success:
            return {"success": False, "error": "Image not found or delete failed"}
        return {"success": True}

    except Exception as e:
        logger.error(f"Delete API Error: {e}")
        raise HTTPException(
            status_code=500, detail="Server error while deleting the image."
        )


@router.delete("/delete-all")
async def delete_all_images(
    service: Imagine = Depends(ig.get_imagine),
) -> dict[str, Any]:
    """
    Delete all images and empty the metadata.json file.
    """
    try:
        result = service.delete_all_images()

        if not result.get("success"):
            # Partial failure (e.g. metadata not cleared)
            return {
                "success": False,
                "deleted_files": result.get("deleted_files", 0),
                "error": result.get(
                    "error", "Unknown error while deleting all images."
                ),
            }

        return {"success": True, "deleted_files": result.get("deleted_files", 0)}

    except Exception as e:
        logger.error(f"Delete All API Error: {e}")
        raise HTTPException(
            status_code=500, detail="Server error while deleting all images."
        )


@router.get("/download")
async def download_image(
    imageId: str,
    level: str = "org",
    service: Imagine = Depends(ig.get_imagine),
):
    """
    Download an image by id and variant level.
    level ∈ [org, low, med, high]
    """
    try:
        raw_bytes, mime_type, filename = service.get_image_bytes_for_download(
            image_id=imageId,
            level=level,
        )
        if raw_bytes == None or mime_type == "" or filename == "":
            logger.error(f"Exception Occurred | Bad Request")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Image not found on the server",
            )

        return StreamingResponse(
            io.BytesIO(raw_bytes),
            media_type=mime_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except FileNotFoundError as exc:
        logger.error(f"File was not found in storage: {exc}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as e:
        logger.error(f"Exception occurred while downloading : {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e


@router.get("/recent-images")
async def recent(
    offset: int = 0,
    limit: int = 9,
    service: Imagine = Depends(ig.get_imagine),
) -> dict[str, Any]:
    """Return paged recent images for gallery views."""
    try:
        safe_offset = max(0, offset)
        safe_limit = max(1, min(limit, 50))  # cap at 50 if you want

        items, total = service.load_recent_images(
            offset=safe_offset,
            limit=safe_limit,
        )
        if total == 0:
            logger.info("No recent images found")
            return {"status": False, "message": "No recent image present"}
        return {
            "status": True,
            "items": items,
            "total": total,
            "has_more": safe_offset + safe_limit < total,
            "next_offset": safe_offset + len(items),
        }
    except Exception as e:
        logger.error(f"Exception Occurred : {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.post("/related-images")
async def related(
    payload: RelatedRequest,
    offset: int = 0,
    limit: int = 12,
    service: Imagine = Depends(ig.get_imagine),
):
    """Return related images for a generated item with pagination metadata."""
    try:
        safe_offset = max(0, offset)
        safe_limit = max(1, min(limit, 50))
        items, total = service.find_related_images(
            payload=payload,
            limit=safe_limit,
            offset=safe_offset,
        )
        logger.info(f"found {total} related image/s")
        return {
            "items": items,
            "total": total,
            "has_more": safe_offset + safe_limit < total,
            "next_offset": safe_offset + len(items),
        }
    except Exception as e:
        logger.error(f"Exception Occurred : {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
