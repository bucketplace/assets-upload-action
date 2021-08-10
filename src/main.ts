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

    await uploadAssets(source, destination, concurrency)
  } catch (error) {
    core.setFailed(error.message)
  }
}
run()