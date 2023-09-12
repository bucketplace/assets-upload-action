import fetch from 'node-fetch'
import klawSync from 'klaw-sync'
import PromisePool from '@supercharge/promise-pool'
import path from 'path'
import FormData from 'form-data'
import * as fs from 'fs'
import {lookup} from 'mime-types'
import * as core from '@actions/core'

function getBaseUrl(): string {
  let url = process.env.BASE_URL
  if (!url) throw ReferenceError('필수 환경변수가 비어있습니다.')
  if (url.endsWith('/')) url = url.slice(0, -1)
  return url
}

function getAuthToken(): string {
  const token = process.env.AUTH_TOKEN
  if (!token) throw ReferenceError('토큰이 비어있습니다.')
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

export async function uploadAssets(
  sourceDir: string,
  destinationDir: string,
  concurrency: string,
  bucket?: string,
  skipFiles?: string[]
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
    bucket?: string
  }[] = paths
    .filter(p => !skipFiles || !skipFiles.includes(path.basename(p.path)))
    .map(p => {
      const fileBuffer = fs.readFileSync(p.path)
      if (fileBuffer.length === 0) {
        core.info(`비어있는 파일을 업로드합니다 : ${path.basename(p.path)}`)
      }
      return {
        fileBuffer,
        filename: path.basename(p.path),
        contentType: lookup(p.path) || 'text/plain',
        objectName: path.join(
          destinationDir,
          path.relative(absSourceDir, p.path)
        ),
        bucket
      }
    })

  const {errors} = await PromisePool.for(uploadTargets)
    .withConcurrency(cn)
    .process(async i => {
      return upload(
        baseUrl,
        token,
        i.fileBuffer,
        i.filename,
        i.contentType,
        i.objectName,
        i.bucket
      )
    })

  if (errors.length > 0) throw Error(errors.map(e => e.message).join('\n'))
}
