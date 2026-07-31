# Listing Image Guide

Housing listings support ordered image metadata while remaining safe for older
records that have no usable image data. This guide defines the API contract,
asset conventions, validation rules, and source policy for listing images.

## Image contract

Stored listing images use this shape:

```json
{
  "src": "/images/listings/demo/student-bedroom-01.webp",
  "alt": "Bright furnished student bedroom with a desk and large window",
  "order": 0,
  "isPrimary": true,
  "width": 1200,
  "height": 800
}
```

The API returns a normalized `images` array and a `primaryImage` convenience
field. `primaryImage` has the same fields and also includes `isFallback`.
`isFallback` is response metadata and is not stored on listing image entries.

| Field | Rules |
| --- | --- |
| `src` | Required non-empty string. Use an approved local public URL under `/images/listings/` or an `https://` URL whose use is authorized. Surrounding whitespace is removed. |
| `alt` | Required meaningful text, 5–240 characters. Surrounding whitespace is removed. |
| `order` | Non-negative integer used for stable display order. New and seeded data must not repeat an order within one listing. |
| `isPrimary` | Boolean. New and seeded data may mark at most one image as primary. |
| `width` | Positive integer when known. Record the verified intrinsic pixel width; normalized responses use `null` when it is unknown. |
| `height` | Positive integer when known. Record the verified intrinsic pixel height; normalized responses use `null` when it is unknown. |

Unsafe or private sources are invalid. Examples include `javascript:`, `data:`,
`file:`, plain `http:`, absolute filesystem paths such as `/Users/...` or
`C:\...`, path traversal, and local URLs outside `/images/listings/`.

## Ordering and primary selection

Valid images are sorted by `order`. Original array position is the stable
tie-breaker for malformed legacy data.

Primary selection is deterministic:

1. If one valid image exists, it is primary.
2. If several valid images exist and exactly one is marked `isPrimary`, that
   image is primary.
3. If several valid images exist and none is marked primary, the first image
   after stable ordering is primary.
4. New and seeded data with more than one primary image is rejected.
5. Legacy records with malformed entries are normalized without crashing.

The normalized response identifies exactly one primary whenever it contains a
valid listing image or the fallback. Invalid legacy entries are omitted, while
all unrelated listing fields remain unchanged.

## Fallback behavior

The approved fallback is:

```text
/images/listings/fallback/property-placeholder.svg
```

It is an original 1200×800 SVG created for this project. A listing with no
valid images receives this fallback, and `primaryImage.isFallback` is `true`.
Frontend image rendering also changes a broken image URL to this fallback once;
the error guard prevents a fallback failure from causing a loop.

Use `Property image unavailable` as the fallback `<img>` alternative text. The
SVG is decorative beneath that surrounding text and is marked `aria-hidden`.

Vite serves files in `frontend/public` from the site root, so the stored URL
must begin with `/images/...`; never store `frontend/public` or a developer
filesystem path in `src`.

## Listing Details gallery

Listing Details normalizes the API image array once, preserves explicit
`order`, selects the normalized primary image, and treats the shared fallback
as a single gallery item when no usable images remain.

- Select a thumbnail or use Previous and Next to change the current image.
- Activate the main image to open the full-size viewer.
- In the viewer, use `ArrowLeft` and `ArrowRight` to navigate and `Escape` to
  close.
- Focus moves to the viewer's Close button and returns to the main-image
  control after closing.
- Navigation stops at the first and final image. One-image and fallback
  galleries therefore keep Previous and Next disabled.
- Loading, broken-source, and fallback states retain the same reserved media
  area to avoid layout collapse.

All 30 seeded listings now have three independently generated, ordered images.
Every listing has its own architecture, layout, furnishings, camera
compositions, and amenity views based on its actual seed details. The shared
fallback remains covered by normalization tests and is used for API records
with missing or unusable image metadata.

Browse-result cards expose compact Previous and Next controls plus a counter.
These controls stop card-selection events, so changing a photo does not open
the map selection or Listing Details unexpectedly.

## Folder and filename conventions

```text
frontend/public/images/listings/
  ASSET_SOURCES.json
  fallback/
    property-placeholder.svg
  demo/
    shared-house-01.webp
    student-bathroom-01.webp
    student-bedroom-01.webp
    studio-01.webp
    listing-variants/
      listing-001-01.webp
      ...
      listing-030-03.webp
  <listing-slug>/
    <listing-slug>-01.webp
    <listing-slug>-02.webp
```

- Use lowercase, hyphen-separated names with no spaces.
- Use a deterministic two-digit sequence (`-01`, `-02`, and so on).
- Use one folder per listing slug for future property-specific assets.
- The `demo` folder is reserved for generic generated course-project imagery
  that may be reused by sample listings.
- Prefer `.webp` for raster images. SVG is appropriate for original interface
  illustrations such as the fallback.
- Public URLs mirror this structure, beginning at `/images/listings/`.

## Raster dimensions and compression

The project target is 1200×800 pixels, a 3:2 aspect ratio. Do not upscale a
smaller source. Prefer WebP quality around 75–85, strip unnecessary metadata,
and aim for less than approximately 300 KB per image when visual quality
allows. Store dimensions measured from the final output rather than assumed
source dimensions.

For authorized local raster sources, run the optimizer from `frontend`:

```bash
cd frontend
npm run images:optimize -- --input <dir> --output <dir>
```

The optimizer refuses to replace existing outputs by default. After reviewing
the target directory, use `--force` only when replacement is intentional:

```bash
npm run images:optimize -- --input <dir> --output <dir> --force
```

The normal application build and production startup do not depend on running
the optimizer.

## Alternative text

Alternative text must briefly describe what is visible and be useful without
the image.

Good examples:

- `Bright furnished student bedroom with a desk and large window`
- `Compact studio interior with a bed, desk, and kitchenette`
- `Shared student house living room with seating and study space`

Do not use a filename, leave the value blank, repeat a generic phrase across
every asset, or begin every description with `Image of`. Generic demo imagery
must not be described as a verified photograph of a named residence.

## Adding an image to a seeded listing

1. Confirm that the asset is generated for this project, licensed, or otherwise
   authorized for repository use. Retain real evidence outside the public API
   when applicable.
2. Put property-specific source material through the optimizer, or add an
   already optimized asset under the correct listing-slug folder.
3. Inspect the final file and record its actual dimensions.
4. Add or update its truthful entry in
   `frontend/public/images/listings/ASSET_SOURCES.json`.
5. Add the image object to the seeded listing. Give every entry a unique
   non-negative `order`, meaningful `alt`, and verified dimensions. Mark no
   more than one entry `isPrimary: true`.
6. Validate seed metadata and local files without connecting to MongoDB:

   ```bash
   cd backend
   npm run seed:listings -- --validate-only
   ```

7. With `MONGO_URI` or `MONGODB_URI` configured, run the seed:

   ```bash
   npm run seed:listings
   ```

8. Run the automated checks:

   ```bash
   npm test
   npm run check
   cd ../frontend
   npm test
   npm run lint
   npm run build
   ```

Seed validation reports the listing identifier, image index or filename, and
reason when it finds missing `src`/`alt`, unsafe paths or protocols, invalid or
duplicate order values, multiple primaries, invalid dimensions, nonconforming
names, missing local files, or absolute developer paths.

## Source and authorization policy

Only generated, licensed, authorized, or explicitly approved project assets may
be committed. Do not scrape Google Images, housing marketplaces, property
management sites, university sites, social media, or any other source without
clear permission. Do not invent a licence, photographer, attribution, or source
URL. Asset provenance belongs in `ASSET_SOURCES.json` and this documentation,
not in the public listing API.

Current listing-image origins are:

- `property-placeholder.svg`: original project interface asset created
  specifically for Toronto Student Housing Matrix.
- `student-bedroom-01.webp`, `studio-01.webp`, and
  `shared-house-01.webp`: generic demo illustrations generated specifically for
  this course project with the built-in image generation tool.
- `student-bathroom-01.webp`: generic demo bathroom imagery generated
  specifically for this course project with the built-in image generation
  tool.
- `listing-variants/*.webp`: 90 independently generated interiors—three
  original scenes for each of 30 seed listings. Each image has its own
  listing-specific generation prompt based on property type, furnishing,
  neighborhood character, layout, and amenities. They are not recolors,
  crops, or derivatives of a shared room image.

These demo assets are not verified photographs of any real property or listing.

The repository's older favicon, icon sprite, framework logos, and abstract hero
graphic are not listing assets and have no documented property-image
authorization, so they are not reused here.
