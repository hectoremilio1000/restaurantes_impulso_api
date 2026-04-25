import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import env from '#start/env'
import MenuPhoto from '#models/menu_photo'
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'

export default class OrphanMenuPhotos extends BaseCommand {
  static commandName = 'orphan:menu-photos'
  static description =
    'Lista (y opcionalmente borra con --delete) registros de menu_photos cuyo objeto no existe en el bucket S3.'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    default: false,
    description: 'Borra de la BD los registros huérfanos detectados (no toca el bucket).',
  })
  declare delete: boolean

  async run() {
    const bucket = env.get('S3_BUCKET')
    const baseUrl = env.get('MEDIA_BASE_URL')
    const endpoint = env.get('S3_ENDPOINT')
    const accessKeyId = env.get('S3_ACCESS_KEY_ID')
    const secretAccessKey = env.get('S3_SECRET_ACCESS_KEY')

    if (!bucket || !baseUrl || !endpoint || !accessKeyId || !secretAccessKey) {
      this.logger.error('Faltan envs S3_*/MEDIA_BASE_URL. No se puede ejecutar.')
      this.exitCode = 1
      return
    }

    const prefix = new URL(baseUrl).pathname.replace(/^\/+|\/+$/g, '')
    const client = new S3Client({
      endpoint,
      region: env.get('S3_REGION') || 'auto',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    })

    const photos = await MenuPhoto.all()
    const orphans: MenuPhoto[] = []
    let skipped = 0
    let headErrors = 0

    for (const p of photos) {
      if (!p.url.startsWith(baseUrl)) {
        skipped++
        continue
      }
      const relative = p.url.slice(baseUrl.length).replace(/^\/+/, '')
      const key = prefix ? `${prefix}/${relative}` : relative

      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      } catch (err: any) {
        if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
          orphans.push(p)
          this.logger.warning(`orphan id=${p.id} key=${key}`)
        } else {
          headErrors++
          this.logger.error(
            `head_error id=${p.id} key=${key} name=${err?.name} status=${err?.$metadata?.httpStatusCode}`
          )
        }
      }
    }

    this.logger.info(
      `revisados=${photos.length} huérfanos=${orphans.length} fuera_de_baseUrl=${skipped} head_errors=${headErrors}`
    )

    if (!orphans.length) {
      this.logger.success('Sin huérfanos. Nada que hacer.')
      return
    }

    if (!this.delete) {
      this.logger.info('dry-run; usa --delete para borrar de BD los huérfanos listados')
      return
    }

    for (const o of orphans) {
      await o.delete()
    }
    this.logger.success(`Borrados ${orphans.length} registros huérfanos de menu_photos.`)
  }
}
