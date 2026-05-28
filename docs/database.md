# Database

GoCanopy stores structured asset data in Postgres and source PDFs in private MinIO storage. The database keeps the business entities, the field-level provenance JSON, and a `file_index` catalog row for each source document stored in MinIO. The backend validates `file_index` rows before issuing short-lived presigned URLs for the frontend PDF viewer.

## Tables

| Table | Purpose |
| --- | --- |
| `file_index` | Catalogs source files stored in MinIO, including filename, content type, size, bucket, object key, status, and creation timestamp. |
| `assets` | Stores one row per asset with normalized identity, location, logistics, rent, WALT/WALB, ERV, and asset-level provenance JSONB. |
| `tenants` | Stores one row per tenant with name, industry, and tenant provenance JSONB. |
| `leases` | Stores one row per lease linked to an asset and tenant, including dates, areas, rent, indexation, WALT/WALB, ERV, and lease provenance JSONB. |

## Provenance JSONB

Provenance columns preserve the source evidence used to populate structured fields:

| Column | Table | Notes |
| --- | --- | --- |
| `asset_provenance` | `assets` | Evidence for asset identity, address, country, tenure, currency, and similar asset fields. |
| `logistics_provenance` | `assets` | Evidence for logistics/property metrics such as area, occupancy, height, rent, and ERV. |
| `tenant_provenance` | `tenants` | Evidence for tenant identity and metadata. |
| `lease_provenance` | `leases` | Evidence for lease terms, rent, dates, areas, and ERV. |

Each provenance entry can include:

| Key | Meaning |
| --- | --- |
| `document` | Source PDF filename from the source JSON. The API sanitizes this basename before looking up `file_index.filename`. |
| `source_type` | Expected to be `pdf` for PDF evidence links. |
| `page` | One-based source page hint. |
| `quote` | Text quote the frontend searches and highlights in the PDF viewer. |
| `sheet` | Optional worksheet/source tab when evidence came from spreadsheet-like data. |

## Entity Relationship Diagram

```mermaid
erDiagram
    FILE_INDEX {
        uuid id PK
        string filename
        string content_type
        bigint size_bytes
        string bucket
        string object_key
        string status
        timestamptz created_at
    }

    ASSETS {
        uuid id PK
        string name
        string address
        string city
        string country
        string asset_type
        string tenure
        string currency
        numeric building_area_sf
        numeric rent_gross
        numeric walt
        numeric walb
        jsonb asset_provenance
        jsonb logistics_provenance
    }

    TENANTS {
        string id PK
        string name
        string industry
        jsonb tenant_provenance
    }

    LEASES {
        string id PK
        uuid asset_id FK
        string tenant_id FK
        string lease_type
        numeric area_sf
        timestamptz date_start
        timestamptz date_expire
        numeric rent_gross
        numeric walt
        numeric walb
        jsonb lease_provenance
    }

    ASSETS ||--o{ LEASES : has
    TENANTS ||--o{ LEASES : signs
    FILE_INDEX ||..o{ ASSETS : "referenced by provenance.document"
    FILE_INDEX ||..o{ LEASES : "referenced by provenance.document"
```

## Seed Data

The initializer reads `ressources/warrington_test_data.json`, upserts the asset/tenant/lease rows, uploads the bundled Warrington PDF into MinIO under `resources/{safe_filename}`, and upserts the matching `file_index` row. The initializer is idempotent.
