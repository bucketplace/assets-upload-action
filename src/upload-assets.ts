import fetch from 'node-fetch'
import klawSync from 'klaw-sync'
import PromisePool from '@supercharge/promise-pool'
import path from 'path'
import FormData from 'form-data'
import * as fs from 'fs'
import {lookup} from 'mime-types'

function getBaseUrl(): string {
  let url = process.env.BASE_URL
  if (!url)
    throw ReferenceError('There is no url defined in the environment variables')
  if (url.endsWith('/')) url = url.slice(0, -1)
  return url
}

function getAuthToken(): string {
  const token = process.env.AUTH_TOKEN
  if (!token)
    throw ReferenceError(
      'There is no token defined in the environment variables'
    )
  return token
}

// async function sleep(ms: number): Promise<void> {
//   return new Promise(resolve => setTimeout(resolve, ms))
// }

async function upload(
  baseUrl: string,
  token: string,
  fileBuffer: Buffer,
  filename: string,
  contentType: string,
  objectName: string
): Promise<void> {
  const form = new FormData()
  form.append('upload', fileBuffer, {
    filename,
    contentType
  })
  form.append('object_name', objectName)

  const res = await fetch(`${baseUrl}/cdn/assets`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`
    },
    body: form
  })

  if (res.status !== 200) throw Error((await res.json())?.message)
}

export async function uploadAssets(
  sourceDir: string,
  destinationDir: string,
  concurrency: string
): Promise<void> {
  const cn = Number(concurrency) || 5

  const absSourceDir = path.join(process.cwd(), sourceDir)
  const paths = klawSync(sourceDir, {
    nodir: true
  })

  const baseUrl = getBaseUrl()
  const token = getAuthToken()
  const uploadTargets: {
    fileBuffer: Buffer
    filename: string
    contentType: string
    objectName: string
  }[] = paths.map(p => {
    return {
      fileBuffer: fs.readFileSync(p.path),
      filename: path.basename(p.path),
      contentType: lookup(p.path) || 'text/plain',
      objectName: path.join(destinationDir, path.relative(absSourceDir, p.path))
    }
  })

  const {errors} = await PromisePool.for(uploadTargets)
    .withConcurrency(cn)
    .process(async i =>
      upload(
        baseUrl,
        token,
        i.fileBuffer,
        i.filename,
        i.contentType,
        i.objectName
      )
    )

  if (errors.length > 0) throw Error(errors.map(e => e.message).join('\n'))
}
