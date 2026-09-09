import { Client } from 'minio'

import { env } from '@/config/env'

import type { Readable } from 'node:stream'

const client = new Client({
  endPoint: env.S3_ENDPOINT,
  port: env.S3_PORT,
  useSSL: env.S3_USE_SSL,
  accessKey: env.S3_ACCESS_KEY,
  secretKey: env.S3_SECRET_KEY,
})

let bucketReady: Promise<void> | undefined

// ponytail: the bucket check runs once per process, not per upload.
function ensureBucket() {
  bucketReady ??= client
    .bucketExists(env.S3_BUCKET)
    .then(async (exists) => {
      if (!exists) await client.makeBucket(env.S3_BUCKET)
    })
    .catch((error: unknown) => {
      bucketReady = undefined
      throw error
    })
  return bucketReady
}

export function attachmentObjectKey(recordId: string, fileName: string) {
  const safeName = fileName.replace(/[^\w.-]+/g, '_').slice(-80)
  return `records/${recordId}/${crypto.randomUUID()}-${safeName}`
}

export async function putObject(
  objectKey: string,
  body: Buffer,
  mimeType: string,
) {
  await ensureBucket()
  await client.putObject(env.S3_BUCKET, objectKey, body, body.length, {
    'Content-Type': mimeType,
  })
}

export function getObjectStream(objectKey: string): Promise<Readable> {
  return client.getObject(env.S3_BUCKET, objectKey)
}

export function deleteObject(objectKey: string) {
  return client.removeObject(env.S3_BUCKET, objectKey)
}
