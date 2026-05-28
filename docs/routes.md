# Routes

The API is intentionally small for the viewer-focused POC.

## System

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Returns backend health status. |

Example response:

```json
{
  "status": "ok"
}
```

## Assets

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/assets` | Lists asset summaries for the asset browser. |
| `GET` | `/api/assets/{asset_id}` | Returns one asset, asset fields, all leases, tenant summaries, and field provenance. |

`GET /api/assets` returns:

```json
[
  {
    "id": "d1994ec3-e121-4d5e-adec-014907116986",
    "name": "Causeway Park",
    "address": "Wilderspool Causeway, Warrington WA4 6RF",
    "city": "Warrington",
    "country": "United Kingdom",
    "assetType": "Logistics",
    "propertyType": "Multi-let industrial estate",
    "currency": "GBP"
  }
]
```

`GET /api/assets/{asset_id}` returns:

```json
{
  "id": "d1994ec3-e121-4d5e-adec-014907116986",
  "name": "Causeway Park",
  "fields": [
    {
      "fieldPath": "asset.name",
      "label": "Asset name",
      "value": "Causeway Park",
      "provenance": [
        {
          "document": "Warrington_Portfolio_Warrington_Central_TE_and_Causeway_Park_IE_iBRO.01 (1).pdf",
          "quote": "Causeway Park",
          "page": 2,
          "sourceType": "pdf",
          "url": "http://localhost:9000/assets/resources/Warrington_Portfolio_Warrington_Central_TE_and_Causeway_Park_IE_iBRO.01_1.pdf?X-Amz-Algorithm=...",
          "refreshUrl": "http://localhost:8000/api/resources/Warrington_Portfolio_Warrington_Central_TE_and_Causeway_Park_IE_iBRO.01%20%281%29.pdf/url",
          "expiresInSeconds": 900
        }
      ]
    }
  ],
  "leases": [
    {
      "id": "24421",
      "tenant": {
        "id": "3316146",
        "name": "Chiu Wah Ltd",
        "industry": "Food Wholesaler"
      },
      "fields": []
    }
  ]
}
```

## Source PDFs

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/resources/{filename}/url` | Refreshes a short-lived MinIO presigned URL for a private source PDF. |

Example response:

```json
{
  "url": "http://localhost:9000/assets/resources/source.pdf?X-Amz-Algorithm=...",
  "expires_in_seconds": 900
}
```

Behavior:

- Only safe PDF basenames are accepted.
- The filename must exist in `file_index`.
- Asset detail responses already include a valid `url`.
- The frontend calls this route only when the current source URL has expired.
- Missing or unsafe files return `404`.

## Removed Routes

`POST /api/uploads` was removed when the POC shifted away from user-uploaded files. Seeded source documents are loaded by the database initializer.
`GET /api/resources/{filename}` is not implemented; PDF access is through `/api/resources/{filename}/url` only.
