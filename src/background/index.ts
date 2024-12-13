import { Config } from '../config.js'
import { Browser } from './model/browser.model.js'

let masterBrowser: Browser
const browsers: Array<Browser> = []

function start() {
  masterBrowser = new Browser(Config.masterWS, (browser) => {
    console.log('从浏览器实例创建成功', browsers)
    browsers.push(browser)
    browser.addEventListener('close', () => {
      browsers.splice(browsers.indexOf(browser), 1)
      console.log('从浏览器实例已退出', browser)
    })
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
  for (const child of browsers) {
    child.ping()
  }
})
chrome.tabs.onRemoved.addListener(function (tabId) {
  masterBrowser?.removePage(tabId).catch((e) => {
    console.error(e)
  })
  for (const child of browsers) {
    child.removePage(tabId).catch((e) => {
      console.error(e)
    })
  }
})
