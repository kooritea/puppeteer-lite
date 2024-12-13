import { Config } from '../config.js'
import { Browser } from './model/browser.model.js'

let masterBrowser: Browser
const Browsers: Array<Browser> = []

function start() {
  masterBrowser = new Browser(Config.masterWS, createBrowser)
  Browsers.push(masterBrowser)
}

function createBrowser(serverURL: string): Promise<Browser> {
  return new Promise((resolve, reject) => {
    const browser = Browsers.find((browser) => {
      return browser.serverURL === serverURL
    })
    if (browser) {
      console.log(`skip create browser: ${serverURL}`)
      resolve(browser)
    } else {
      const browser = new Browser(serverURL, createBrowser)
      browser.addEventListener('connect_success', () => {
        Browsers.push(browser)
        console.log('从浏览器实例创建成功', Browsers)
        resolve(browser)
      })
      browser.addEventListener('connect_error', (e) => {
        console.log('从浏览器实例创建失败', e)
        reject(new Error(`connect_error: ${serverURL}`))
      })
      browser.addEventListener('close', () => {
        Browsers.splice(Browsers.indexOf(browser), 1)
        console.log('从浏览器实例已退出', browser)
      })
    }
  })
}

chrome.runtime.onStartup.addListener(() => {
  start()
  chrome.alarms.create('periodicAlarm', { periodInMinutes: 0.1 }).catch((e) => {
    console.error(e)
  })
})
chrome.runtime.onInstalled.addListener(() => {
  start()
  chrome.alarms.create('periodicAlarm', { periodInMinutes: 0.1 }).catch((e) => {
    console.error(e)
  })
})
chrome.alarms.onAlarm.addListener(() => {
  masterBrowser?.ping()
  for (const child of Browsers) {
    child.ping()
  }
})
chrome.tabs.onRemoved.addListener(function (tabId) {
  masterBrowser?.removePage(tabId).catch((e) => {
    console.error(e)
  })
  for (const child of Browsers) {
    child.removePage(tabId).catch((e) => {
      console.error(e)
    })
  }
})
