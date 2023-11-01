const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')
const previewer = fs.readFileSync(path.join(__dirname, "../dist/zw_previewer.js"), 'utf-8')

import {
  fullColorHex,
  rgbToHex,
  base64ToPng
} from './utils'
import formatData from './formatData'

let browser, page

async function initBrowser () {
  const dArgs = puppeteer.defaultArgs()
  dArgs.push('--no-sandbox')
  dArgs.push('--use-gl=egl')
  dArgs.push('--use-passthrough-cmd-decoder')

  browser = await puppeteer.launch({
    ignoreDefaultArgs: true,
    // devtools: true,
    dumpio: true,
    args: dArgs,
  })
}

async function initPage () {
  try {
    page = await browser.newPage()
    await Promise.all([
      page.goto('chrome://gpu')
  ])
    const b = await page.screenshot({fullPage: true, encoding: 'base64'})
    base64ToPng(b, '/tmp/lks.png')
  } catch (e) {
    console.log('initPageError: ', e)
    await browser.close()
    process.exit()
  }
}

async function initContext () {
  await initBrowser()
  await initPage()
}

async function closeBrowser () {
  console.log('closing', browser && browser.close)
  if (browser && browser.close) {
    await browser.close()
  }
}

initContext()




