import { GotoOptions } from 'src/typings/puppeteer.js'
import {
  FromServerPageClickSocketPack,
  FromServerPageEvaluateSocketPack,
  FromServerPageGotoSocketPack,
  FromServerPageKeyboardPressSocketPack,
  FromServerPageTypeSocketPack,
  FromServerPageWaitForSelectorSocketPack,
  FromServerSocketPack,
} from 'src/typings/server.js'
import { ElementHandle } from '../handle/element.handle.js'
import { DebuggerManager } from '../Manager/DebuggerManager.js'
import { NetworkManager } from '../Manager/NetworkManager.js'
import { tryDo } from '../utils.js'
import { ExtKeyboard, ExtMouse } from './Input.js'
import { Socket } from './socket.model.js'

export class Page extends Socket {
  public keyboard: ExtKeyboard
  public mouse: ExtMouse
  public networkManager: NetworkManager
  public tabId: number

  private closeSignalId: string | undefined

  constructor(
    public tab: chrome.tabs.Tab,
    public pageId: string,
    serverURL: string
  ) {
    super(serverURL, false)
    if (!tab.id) {
      throw new Error('not found tab.id')
    }
    this.tabId = tab.id
    this.keyboard = new ExtKeyboard(this.tabId)
    this.mouse = new ExtMouse(this.keyboard, this.tabId)
    this.networkManager = new NetworkManager(this.tabId)
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
      case 'page.goto': {
        this.onCmdGoto(pack)
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
      case 'page.keyboard.press': {
        this.onCmdKeyboardPress(pack)
          .then((result) => {
            return this.send(pack.event, result, pack.id)
          })
          .catch((e: Error) => {
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
      timeout: pack.data.options?.timeout || 30000,
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
    const attachId = await DebuggerManager.attach(this.tabId)
    await this.keyboard.type(pack.data.text, pack.data.options)
    await DebuggerManager.detach(attachId)
  }

  private async onCmdClick(pack: FromServerPageClickSocketPack): Promise<void> {
    const attachId = await DebuggerManager.attach(this.tabId)
    const elementHandle = new ElementHandle(this, pack.data.selector)
    await elementHandle.click()
    await DebuggerManager.detach(attachId)
  }

  private async onCmdGoto(pack: FromServerPageGotoSocketPack): Promise<void> {
    await this.goto(pack.data.url, pack.data.options)
  }

  private async onCmdKeyboardPress(pack: FromServerPageKeyboardPressSocketPack): Promise<void> {
    const attachId = await DebuggerManager.attach(this.tabId)
    await this.keyboard.press(pack.data.key, pack.data.options)
    await DebuggerManager.detach(attachId)
  }

  public async goto(url: string, options?: GotoOptions): Promise<void> {
    const attachId = await DebuggerManager.attach(this.tabId)
    await chrome.debugger.sendCommand({ tabId: this.tabId }, 'Page.navigate', {
      url,
      ...options,
    })
    await DebuggerManager.detach(attachId)
    await tryDo({
      handler: async () => {
        const val = await this.executeScript(() => {
          return !!window._callCodeInjected2hd9wihd932h32f
        })
        if (!val) {
          throw new Error(`content script inject error`)
        }
      },
      interval: 500,
      timeout: 30000,
    })
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
        if (result?._isExecuteScriptError) {
          throw new Error(result.message)
        } else {
          return result as Result
        }
      })
  }
}
