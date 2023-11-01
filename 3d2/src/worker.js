import {
  initContext,
  closeBrowser,
  evaluate
} from './create'
import {execSync} from 'child_process'

let browserPid = ''

function getGPUUsedMemory () {
  const stdout = execSync('nvidia-smi -q --display=pids', {encoding: 'utf-8'})
  const infos = stdout.split('Process ID                  :')
  const gpuInfoObj = infos.reduce((acc, cur, index) => {
    if (index === 0) {
      return acc
    }
    acc[+cur.split('Type')[0]] = parseInt(cur.split('Used GPU Memory         :')[1])
    return acc
  }, {})
  return +gpuInfoObj[browserPid]
}

async function draw (params) {
  const startTime = new Date()
  let {
    jsonPath,
    modelId,
    designId,
    productTypeModelId,
    imgDir,
    colorId,
    size,
    baseWidth,
    actualSize = 600
  } = JSON.parse(params)

  size = size * Math.min(Math.max(actualSize, 300) / 600, 1)

  console.log(`
        <start---
          startTime: ${startTime}
          pid: ${process.pid}
          designId: ${designId}
          jsonPath: ${jsonPath}
        end---> `)

  const result = await evaluate({
    jsonPath,
    modelId: String(modelId),
    productTypeModelId: String(productTypeModelId),
    designId: String(designId),
    colorId: String(colorId),
    imgDir,
    size,
    baseWidth
  })

  if (result) {
    console.log(`
          <success---
            pid: ${process.pid}
            jsonPath: ${jsonPath}
            cost: ${new Date() - startTime}ms
          success---> `)
  } else {
    console.log(`
          <error---
            pid: ${process.pid}
            jsonPath: ${jsonPath}
            cost: ${new Date() - startTime}ms
          error---> `)
  }

  return result
}

;(async () => {
  browserPid = await initContext()
  process.send({type: 'init'})
})()

let count = 0

process.on('message', async function ({
  needCleanUp,
  params
}) {
  count++
  if (
    // needCleanUp
    count > 20
  ) {
    await closeBrowser()
    browserPid = await initContext()
    count = 0
  }

  try {
    await draw(params)
  } catch (e) {
    console.log(`${process.pid} error: ${e}`)
    return process.send({
      type: 'success',
      msg: `error: ${e}`,
      memory: count
    })
  }

  process.send({
    type: 'success',
    msg: 'success',
    memory: count
  })

})

process.on('uncaughtException', async (err) => {
  console.error(`${process.pid} errorStack: ${err.stack}`)
  process.send({
    type: 'error',
    msg: `uncaughtException: ${err}`
  })
  console.log(`${process.pid} uncaughtException: ${err}`)
  await closeBrowser()
  process.exit(1)
})