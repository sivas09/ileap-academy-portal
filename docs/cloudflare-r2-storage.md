# Cloudflare R2 Storage Setup

Date: May 21, 2026  
Scope: Long-term storage for uploaded portal resources

## Purpose

The portal now supports Cloudflare R2 for uploaded files. Local development can still use the local `uploads` folder. Production should use R2 so uploaded PDFs, worksheets, documents, and images are not tied to the Render server disk.

## Required Render Environment Variables

Add these to the Render web service environment:

- `R2_BUCKET`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Optional:

- `R2_ENDPOINT`

If `R2_ENDPOINT` is not set, the app builds it from:

`https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`

## Cloudflare Setup

1. Log in to Cloudflare.
2. Open `R2 Object Storage`.
3. Create a bucket, for example `ileap-academy-uploads`.
4. Create an R2 API token with read/write permission for the bucket.
5. Copy the access key ID and secret access key.
6. Copy the Cloudflare account ID.
7. Add the values to Render.
8. Redeploy the Render service.

## How The App Behaves

- If R2 variables are present, new uploads are saved to R2.
- If R2 variables are missing, uploads are saved to local disk.
- Downloads try R2 first when configured.
- If a file is not found in R2, the app falls back to the old local disk path. This helps existing Render-disk files continue working during transition.
- When an admin permanently deletes a resource, the app deletes the R2 object and also attempts to delete the old local disk file.

## Important Transition Note

Existing files uploaded before R2 setup may still live on the Render disk. They will continue to work while the Render disk exists. For a complete migration later, copy old files from Render disk into R2 using the same file keys stored in the database.

