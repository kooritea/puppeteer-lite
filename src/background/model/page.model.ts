import {
  FromServerPageClickSocketPack,
  FromServerPageEvaluateSocketPack,
  FromServerPageTypeSocketPack,
  FromServerPageWaitForSelectorSocketPack,
  FromServerSocketPack,
} from 'src/typings/server.js'
import { ElementHandle } from '../handle/element.handle.js'
import { tryDo } from '../utils.js'
import { ExtKeyboard, ExtMouse } from './Input.js'
import { Socket } from './socket.model.js'

export class Page extends Socket {
  public keyboard: ExtKeyboard
  public mouse: ExtMouse
  public tabId: number

  private closeSignalId: string | undefined

  constructor(
    public tab: chrome.tabs.Tab,
    private pageId: string,
    serverURL: string
  ) {
    super(serverURL)
    if (!tab.id) {
      throw new Error('not found tab.id')
    }
    this.tabId = tab.id
    this.keyboard = new ExtKeyboard(this.tabId)
    this.mouse = new ExtMouse(this.keyboard, this.tabId)
  }

  protected override beforeConnect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const intervalTimer = setInterval(() => {
        chrome.scripting
          .executeScript({
            target: { tabId: this.tabId },
            injectImmediately: true,
            world: 'MAIN',
            func: () => {
              return !!window._callCodev8ds9v8929n2pvnb2fi3n
            },
          })
          .then((isInject) => {
            if (isInject) {
              clearInterval(intervalTimer)
              clearTimeout(timeoutTimer)
              resolve()
            }
          })
          .catch((e) => {
            reject(e)
          })
      }, 100)
      const timeoutTimer = setTimeout(() => {
        clearInterval(intervalTimer)
        reject(new Error('Inject content script timeout'))
      }, 30000)
    })
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
      case 'page.click': {
        this.onCmdClick(pack)
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
        chrome.tabs.remove(this.tabId).catch((e: Error) => {
          return this.send(pack.event, e.message, pack.id, true)
        })
        break
      }
    }
  }

  private async onCmdWaitForSelector(pack: FromServerPageWaitForSelectorSocketPack): Promise<void> {
    await tryDo({
      handler: async () => {
        const val = await this.executeScript((selector: string) => {
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

  private async onCmdEvaluate(pack: FromServerPageEvaluateSocketPack): Promise<unknown> {
    return this.executeScript(pack.data.code)
  }

  private async onCmdType(pack: FromServerPageTypeSocketPack): Promise<void> {
    await this.executeScript((pack: FromServerPageTypeSocketPack) => {
      const el = document.querySelector(pack.data.selector)
      if (!(el instanceof HTMLElement)) {
        throw new Error('Cannot focus non-HTMLElement')
      }
      el.focus()
    }, pack)
    await new Promise<void>((resolve) => {
      chrome.debugger.attach({ tabId: this.tabId }, '1.2', () => {
        resolve()
      })
    })
    await this.keyboard.type(pack.data.text, pack.data.options)
    await chrome.debugger.detach({ tabId: this.tabId })
  }

  private async onCmdClick(pack: FromServerPageClickSocketPack): Promise<void> {
    await new Promise<void>((resolve) => {
      chrome.debugger.attach({ tabId: this.tabId }, '1.2', () => {
        resolve()
      })
    })
    const elementHandle = new ElementHandle(this, pack.data.selector)
    await elementHandle.click()
    await chrome.debugger.detach({ tabId: this.tabId })
  }

  public async close(): Promise<void> {
    await this.send('page.close', {}, this.closeSignalId)
    super.close()
  }

  private async executeScript<Params extends unknown[], Result>(
    func: string | ((...args: Params) => Result),
    ...args: Params
  ): Promise<Result> {
    return chrome.scripting
      .executeScript({
        target: { tabId: this.tabId },
        injectImmediately: true,
        world: 'MAIN',
        func: (code: string, ...args: Params) => {
          return window._callCodev8ds9v8929n2pvnb2fi3n(code, ...args) as Awaited<Result>
        },
        args: [func.toString(), ...args],
      })
      .then((data) => {
        const result = data[0].result as {
          _isExecuteScriptError: boolean
          message: string
        }
        if (result._isExecuteScriptError) {
          throw new Error(result.message)
        } else {
          return result as Result
        }
      })
  }
}
