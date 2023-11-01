import {execSync, fork} from 'child_process'
import {createServer} from 'http'
import {resolve} from 'path'

const workers = []

function getGPUFreeMemory () {
  const stdout = execSync('nvidia-smi -q --display=memory', {encoding: 'utf-8'})
  return stdout
    .split('Used                        :')[1]
    .match(/:.*MiB/)[0].replace(/[^0-9]/ig, "")
}

async function createWorker () {
  const worker = fork(resolve(__dirname, 'worker.js'))
  const workerObj = {
    pid: worker.pid,
    worker,
    idle: true,
    res: null,
    memory: 0
  }
  worker.on('exit', function () {
    console.log(`Worker ${worker.pid} exited.`)
    const index = workers.findIndex(workObj => workObj.pid === worker.pid)
    workers.splice(index, 1)
    createWorker()
  });

  return new Promise(resolve => {
    worker.on("message", ({
      type,
      msg,
      memory
    }) => {

      if (type === 'init') {
        workers.push(workerObj)
        return resolve()
      }

      if (type === 'error') {
        workerObj.res.end(msg)
      }

      if (type === 'success') {
        workerObj.idle = true
        workerObj.memory = memory
        workerObj.res.end(msg)
      }
    })
  })
}

;(async () => {
  let i = 0
  while (i++ < 100) {
    await createWorker()
  }
  console.log('status OK')

  createServer({}, (req, res) => {

    const workerObj = workers
      .sort((a, b) => b.memory - a.memory)
      .find(workerObj => workerObj.idle)

    console.log(`total: ${workers.length}`)
    console.log(`idle: ${workers.filter(i => i.idle).length}`)

    if (!workerObj) {
      console.log(`no idle worker found`)
      res.end('error')
      return
    }
    workerObj.idle = false

    let params = ''
    req.on('data', data => params = data.toString())
    req.on('end', async () => {

      workerObj.res = res
      workerObj.worker.send({
        // needCleanUp: getGPUFreeMemory() < 5000 && workerObj.memory > 400,
        needCleanUp: false,
        params
      })
    })
  })
    .listen(12000)
})()

process.on('exit', function () {
  workers.forEach(workObj => workObj.worker.kill())
});

