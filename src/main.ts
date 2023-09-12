import * as core from '@actions/core'
import {uploadAssets} from './upload-assets'

async function run(): Promise<void> {
  try {
    const source: string = core.getInput('source-dir', {required: true})
    const destination: string = core.getInput('destination-dir', {
      required: false
    })
    const concurrency: string = core.getInput('concurrency', {
      required: false
    })
    const bucket: string = core.getInput('bucket', {
      required: false
    })
    const skipFiles: string = core.getInput('skip-files', {required: false})
    const skipFilesArray = skipFiles
      ? skipFiles.split(',').map(file => file.trim())
      : []

    await uploadAssets(
      source,
      destination,
      concurrency,
      bucket ? bucket : undefined,
      skipFilesArray
    )
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('업로드에 실패하였습니다.')
    }
  }
}
run()
