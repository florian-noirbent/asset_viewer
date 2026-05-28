import re
import uuid
from datetime import datetime
from pathlib import Path

import anyio
from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.db.models import FileIndex
from app.db.session import get_db_session
from app.storage.minio_client import ObjectStorage, get_object_storage

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


class UploadResponse(BaseModel):
    id: uuid.UUID
    filename: str
    content_type: str
    size_bytes: int
    bucket: str
    object_key: str
    status: str
    created_at: datetime


def safe_filename(filename: str) -> str:
    name = Path(filename or "upload").name
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return cleaned or "upload"


@router.post("", response_model=UploadResponse, status_code=201)
async def upload_file(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    storage: ObjectStorage = Depends(get_object_storage),
    session: AsyncSession = Depends(get_db_session),
) -> UploadResponse:
    data = await file.read()
    file_id = uuid.uuid4()
    filename = safe_filename(file.filename or "upload.bin")
    content_type = file.content_type or "application/octet-stream"
    object_key = f"uploads/{file_id}/original/{filename}"

    await anyio.to_thread.run_sync(storage.upload_bytes, object_key, data, content_type)

    row = FileIndex(
        id=file_id,
        filename=filename,
        content_type=content_type,
        size_bytes=len(data),
        bucket=settings.minio_bucket,
        object_key=object_key,
        status="uploaded",
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)

    return UploadResponse(
        id=row.id,
        filename=row.filename,
        content_type=row.content_type,
        size_bytes=row.size_bytes,
        bucket=row.bucket,
        object_key=row.object_key,
        status=row.status,
        created_at=row.created_at,
    )
