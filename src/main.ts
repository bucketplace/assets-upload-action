import * as core from '@actions/core'
import {uploadAssets} from './upload-assets'

async function run(): Promise<void> {
  try {
    const source: string = core.getInput('source-dir', {required: true})
    const destination: string = core.getInput('destination-dir', {
      required: false
    })

    await uploadAssets(source, destination)
  } catch (error) {
    core.setFailed(error.message)
  }
}
run()
