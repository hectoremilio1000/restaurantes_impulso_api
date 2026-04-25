// app/services/s3_menu_uploader.ts
// Sube imagenes al bucket S3-compatible (Railway Tigris) y regresa la URL publica.
// Reemplaza a ftp_menu_uploader.ts (BanaHosting FTPS). Mismo contrato.

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'

type UploadOpts = {
  restaurantSlug: string
  locale: string
  section: string
  localPath: string
  maxWidth?: number
}

function getClient() {
  const endpoint = env.get('S3_ENDPOINT')
  const region = env.get('S3_REGION') || 'auto'
  const accessKeyId = env.get('S3_ACCESS_KEY_ID')
  const secretAccessKey = env.get('S3_SECRET_ACCESS_KEY')
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('S3_ENDPOINT/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY no configurados')
  }
  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
}

function pathPrefixFromBaseUrl(baseUrl: string) {
  try {
    return new URL(baseUrl).pathname.replace(/^\/+|\/+$/g, '')
  } catch {
    return ''
  }
}

export default class S3MenuUploader {
  static async upload({ restaurantSlug, locale, section, localPath, maxWidth = 1600 }: UploadOpts) {
    const bucket = env.get('S3_BUCKET')
    const baseUrl = env.get('MEDIA_BASE_URL')
    if (!bucket) throw new Error('S3_BUCKET no configurado')
    if (!baseUrl) throw new Error('MEDIA_BASE_URL no configurado')

    const prefix = pathPrefixFromBaseUrl(baseUrl)
    const fileName = `${Date.now()}-${randomUUID()}.webp`
    const relativePath = `menus/${restaurantSlug}/${locale}/${section}/${fileName}`
    const key = prefix ? `${prefix}/${relativePath}` : relativePath

    const tmpDir = app.makePath('tmp')
    const processedPath = path.join(tmpDir, `optimized-${fileName}`)
    const startedAt = Date.now()
    let size = 0

    try {
      await sharp(localPath)
        .resize({
          width: maxWidth,
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toFile(processedPath)

      const body = fs.readFileSync(processedPath)
      size = body.length
      const client = getClient()
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        })
      )

      // Verify the object actually landed in the bucket. Without this, a Put that
      // resolves without throwing but doesn't persist (network truncation, partial
      // ack, deploy mid-flight) would leave a DB row pointing to a 404 forever.
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))

      console.log(
        JSON.stringify({
          event: 'menu_photo_upload',
          status: 'ok',
          bucket,
          key,
          size,
          durationMs: Date.now() - startedAt,
        })
      )
    } catch (err: any) {
      console.error(
        JSON.stringify({
          event: 'menu_photo_upload',
          status: 'error',
          bucket,
          key,
          size,
          durationMs: Date.now() - startedAt,
          errorName: err?.name,
          errorMessage: err?.message,
        })
      )
      throw new Error(`s3_upload_verify_failed: ${key}`)
    } finally {
      try {
        fs.unlinkSync(localPath)
      } catch {}
      try {
        fs.unlinkSync(processedPath)
      } catch {}
    }

    return `${baseUrl}/${relativePath}`
  }

  static async delete(url: string) {
    const bucket = env.get('S3_BUCKET')
    const baseUrl = env.get('MEDIA_BASE_URL')
    if (!bucket || !baseUrl) return
    if (!url.startsWith(baseUrl)) return
    const prefix = pathPrefixFromBaseUrl(baseUrl)
    const relative = url.slice(baseUrl.length).replace(/^\/+/, '')
    if (!relative) return
    const key = prefix ? `${prefix}/${relative}` : relative
    const client = getClient()
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  }
}
