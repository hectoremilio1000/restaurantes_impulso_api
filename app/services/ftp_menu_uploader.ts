// app/services/ftp_menu_uploader.ts
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import ftp from 'basic-ftp'
import sharp from 'sharp'
import env from '#start/env'
import app from '@adonisjs/core/services/app'

type UploadOpts = {
  restaurantSlug: string
  locale: string
  section: string
  localPath: string
  maxWidth?: number // opcional, por default 1600px
}

export default class FtpMenuUploader {
  static async upload({ restaurantSlug, locale, section, localPath, maxWidth = 1600 }: UploadOpts) {
    const host = env.get('FTPS_HOST')
    const port = Number(env.get('FTPS_PORT') || 21)
    const user = env.get('FTPS_USER')
    const password = env.get('FTPS_PASS')
    const secure = String(env.get('FTPS_SECURE') ?? 'true') === 'true'
    const baseUrl = env.get('MEDIA_BASE_URL')

    if (!host || !user || !password || !baseUrl) {
      throw new Error('FTPS_HOST/FTPS_USER/FTPS_PASS/MEDIA_BASE_URL no configurados')
    }

    // Nombre seguro
    const fileName = `${Date.now()}-${randomUUID()}.webp`
    const remoteDir = `menus/${restaurantSlug}/${locale}/${section}`

    // Procesar con sharp → archivo temporal (optimizado)
    const tmpDir = app.makePath('tmp')
    const processedPath = path.join(tmpDir, `optimized-${fileName}`)

    await sharp(localPath)
      .resize({
        width: maxWidth,
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(processedPath)

    // Subir por FTPS
    const client = new ftp.Client()
    try {
      await client.access({ host, port, user, password, secure })
      await client.ensureDir(remoteDir)
      await client.uploadFrom(processedPath, fileName)
      try {
        await client.cd('/')
      } catch {
        // ignorar
      }
    } finally {
      try {
        client.close()
      } catch {}
      // borrar archivos locales
      try {
        fs.unlinkSync(localPath)
      } catch {}
      try {
        fs.unlinkSync(processedPath)
      } catch {}
    }

    // URL pública final
    return `${baseUrl}/menus/${restaurantSlug}/${locale}/${section}/${fileName}`
  }
}
