import {
  FromServerPageEvaluateSocketPack,
  FromServerPageTypeSocketPack,
  FromServerPageWaitForSelectorSocketPack,
  FromServerSocketPack,
} from 'src/typings/server.js'
import { tryDo } from '../utils.js'
import { ExtKeyboard, ExtMouse } from './Input.js'
import { Socket } from './socket.model.js'

export class Page extends Socket {
  private closeSignalId: string | undefined
  private keyboard: ExtKeyboard
  private mouse: ExtMouse

  constructor(
    public tab: chrome.tabs.Tab,
    private pageId: string,
    serverURL: string
  ) {
    super(serverURL)
    if (!tab.id) {
      throw new Error('not found tab.id')
    }
    this.keyboard = new ExtKeyboard(tab.id)
    this.mouse = new ExtMouse(this.keyboard, tab.id)
  }

  protected createSocketOpenPack(token: string): string {
    return JSON.stringify({
      event: 'page.create',
      data: {
        pageId: this.pageId,
        auth: token,
      },
    })
  }

  protected onMessage(pack: FromServerSocketPack): void {
    switch (pack.event) {
      case 'page.auth': {
        this.open()
        break
      }
      case 'page.evaluate': {
        this.onCmdEvaluate(pack)
          .then((result) => {
            return this.send(pack.event, result, pack.id)
          })
          .catch((e: Error) => {
            return this.send(pack.event, e.message, pack.id, true)
          })
        break
      }
      case 'page.waitForSelector': {
        this.onCmdWaitForSelector(pack)
          .then((result) => {
            return this.send(pack.event, result, pack.id)
          })
          .catch((e: Error) => {
            return this.send(pack.event, e.message, pack.id, true)
          })
        break
      }
      case 'page.type': {
        this.onCmdType(pack)
          .then((result) => {
            return this.send(pack.event, result, pack.id)
          })
          .catch((e: Error) => {
            return this.send(pack.event, e.message, pack.id, true)
          })
        break
      }
      case 'page.close': {
        this.closeSignalId = pack.id
        if (this.tab.id) {
          chrome.tabs.remove(this.tab.id).catch((e: Error) => {
            return this.send(pack.event, e.message, pack.id, true)
          })
        }
        break
      }
    }
  }

  private async onCmdWaitForSelector(pack: FromServerPageWaitForSelectorSocketPack): Promise<void> {
    await tryDo({
      handler: async () => {
        const val = await this.executeScript<boolean>((selector: string) => {
          return !!document.querySelector(selector)
        }, pack.data.selector)
        if (!val) {
          throw new Error(`selector('${pack.data.selector}') not found`)
        }
      },
      interval: 500,
      timeout: 5000,
    })
  }

  private async onCmdEvaluate(pack: FromServerPageEvaluateSocketPack): Promise<never> {
    return this.executeScript(function (code: string) {
      return window._callCodev8ds9v8929n2pvnb2fi3n(code)
    }, pack.data.code)
  }

  private async onCmdType(pack: FromServerPageTypeSocketPack): Promise<void> {
    const { x, y } = await this.executeScript(function (pack: FromServerPageTypeSocketPack) {
      const el = document.querySelector(pack.data.selector)
      if (!el) {
        throw new Error(`${pack.data.selector} not found`)
      }
      const rect = el.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      return {
        x,
        y,
      }
    }, pack)
    await new Promise<void>((resolve) => {
      chrome.debugger.attach({ tabId: this.tab.id }, '1.2', () => {
        resolve()
      })
    })
    await this.mouse.click(x, y)
    await this.keyboard.type(pack.data.text, pack.data.options)
    await chrome.debugger.detach({ tabId: this.tab.id })
  }

  public async close(): Promise<void> {
    await this.send('page.close', {}, this.closeSignalId)
    super.close()
  }

  private async executeScript<T>(
    func: (...args: never) => T | Promise<T>,
    ...args: unknown[]
  ): Promise<T> {
    if (this.tab.id) {
      return chrome.scripting
        .executeScript({
          target: { tabId: this.tab.id },
          injectImmediately: true,
          world: 'MAIN',
          func,
          args: args as never,
        })
        .then((data) => {
          return data[0].result as T
        })
    } else {
      throw new Error('not found tab id')
    }
  }
}
