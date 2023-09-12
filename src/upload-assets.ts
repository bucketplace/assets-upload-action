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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getErrorMsg(obj: any): string {
  return obj.detail || JSON.stringify(obj, null, 2)
}

async function upload(
  baseUrl: string,
  token: string,
  fileBuffer: Buffer,
  filename: string,
  contentType: string,
  objectName: string,
  bucket?: string
): Promise<void> {
  const form = new FormData()
  form.append('upload', fileBuffer, {
    filename,
    contentType
  })
  form.append('object_name', objectName)

  let endpoint = `${baseUrl}/api/v1/assets/`
  if (bucket) endpoint += `?${new URLSearchParams({bucket})}`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`
    },
    body: form
  })

  if (res.status !== 200) throw Error(getErrorMsg(await res.json()))
}

async function uploadFolder(
  baseUrl: string,
  token: string,
  objectName: string,
  bucket?: string
): Promise<void> {
  const emptyBuffer = Buffer.from('')

  const markerFileName = `${
    objectName.endsWith('/') ? objectName : `${objectName}/`
  }`

  await upload(
    baseUrl,
    token,
    emptyBuffer,
    markerFileName,
    'application/x-directory',
    markerFileName,
    bucket
  )
}

export async function uploadAssets(
  sourceDir: string,
  destinationDir: string,
  concurrency: string,
  bucket?: string
): Promise<void> {
  const cn = Number(concurrency) || 5

  const absSourceDir = path.join(process.cwd(), sourceDir)

  const paths = klawSync(sourceDir, {nodir: false})

  const baseUrl = getBaseUrl()
  const token = getAuthToken()

  const uploadTargets = []

  for (const p of paths) {
    if (p.stats.isDirectory()) {
      const folderPath = path.join(
        destinationDir,
        path.relative(absSourceDir, p.path)
      )
      uploadTargets.push({folderPath, bucket})
    } else {
      uploadTargets.push({
        fileBuffer: fs.readFileSync(p.path),
        filename: path.basename(p.path),
        contentType: lookup(p.path) || 'text/plain',
        objectName: path.join(
          destinationDir,
          path.relative(absSourceDir, p.path)
        ),
        bucket
      })
    }
  }

  const {errors} = await PromisePool.for(uploadTargets)
    .withConcurrency(cn)
    .process(async i => {
      if (i.folderPath) {
        return uploadFolder(baseUrl, token, i.folderPath, i.bucket)
      } else {
        if (i.fileBuffer !== undefined) {
          return upload(
            baseUrl,
            token,
            i.fileBuffer,
            i.filename,
            i.contentType,
            i.objectName,
            i.bucket
          )
        }
      }
    })

  if (errors.length > 0) throw Error(errors.map(e => e.message).join('\n'))
}
