import { GotoOptions, Rect, ScreenshotClip } from 'src/typings/puppeteer.js'
import {
  FromServerPageClickSocketPack,
  FromServerPageEvaluateSocketPack,
  FromServerPageGotoSocketPack,
  FromServerPageKeyboardPressSocketPack,
  FromServerPageKeyboardTypeSocketPack,
  FromServerPageMouseClickSocketPack,
  FromServerPageScreenshotSocketPack,
  FromServerPageTypeSocketPack,
  FromServerPageWaitForSelectorSocketPack,
  FromServerSocketPack,
} from 'src/typings/server.js'
import { ElementHandle } from '../handle/element.handle.js'
import { ExecutionContext } from '../handle/ExecutionContext.js'
import { DebuggerManager } from '../Manager/DebuggerManager.js'
import { NetworkManager } from '../Manager/NetworkManager.js'
import { tryDo } from '../utils.js'
import { ExtKeyboard, ExtMouse } from './Input.js'
import { Socket } from './socket.model.js'

export class Page extends Socket {
  public keyboard: ExtKeyboard
  public mouse: ExtMouse
  public networkManager: NetworkManager
  public executionContext: ExecutionContext
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
    this.networkManager = new NetworkManager(this, this.tabId)
    this.executionContext = new ExecutionContext(this.tabId)
    DebuggerManager.registerTab(this.tabId, this.executionContext)
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
            return this.reply(pack.event, pack.id, result)
          })
          .catch((e: Error) => {
            return this.reply(pack.event, pack.id, e.message, true)
          })
        break
      }
      case 'page.waitForSelector': {
        this.onCmdWaitForSelector(pack)
          .then((result) => {
            return this.reply(pack.event, pack.id, result)
          })
          .catch((e: Error) => {
            return this.reply(pack.event, pack.id, e.message, true)
          })
        break
      }
      case 'page.type': {
        this.onCmdType(pack)
          .then((result) => {
            return this.reply(pack.event, pack.id, result)
          })
          .catch((e: Error) => {
            return this.reply(pack.event, pack.id, e.message, true)
          })
        break
      }
      case 'page.click': {
        this.onCmdClick(pack)
          .then((result) => {
            return this.reply(pack.event, pack.id, result)
          })
          .catch((e: Error) => {
            return this.reply(pack.event, pack.id, e.message, true)
          })
        break
      }
      case 'page.screenshot': {
        this.onCmdScreenshot(pack)
          .then((result) => {
            return this.reply(pack.event, pack.id, result)
          })
          .catch((e: Error) => {
            return this.reply(pack.event, pack.id, e.message, true)
          })
        break
      }
      case 'page.goto': {
        this.onCmdGoto(pack)
          .then((result) => {
            return this.reply(pack.event, pack.id, result)
          })
          .catch((e: Error) => {
            return this.reply(pack.event, pack.id, e.message, true)
          })
        break
      }
      case 'page.close': {
        this.closeSignalId = pack.id
        chrome.tabs.remove(this.tabId).catch((e: Error) => {
          return this.reply(pack.event, pack.id, e.message, true)
        })
        break
      }
      case 'page.keyboard.press': {
        this.onCmdKeyboardPress(pack)
          .then((result) => {
            return this.reply(pack.event, pack.id, result)
          })
          .catch((e: Error) => {
            return this.reply(pack.event, pack.id, e.message, true)
          })
        break
      }
      case 'page.keyboard.type': {
        this.onCmdKeyboardType(pack)
          .then((result) => {
            return this.reply(pack.event, pack.id, result)
          })
          .catch((e: Error) => {
            return this.reply(pack.event, pack.id, e.message, true)
          })
        break
      }
      case 'page.mouse.click': {
        this.onCmdMouseClick(pack)
          .then((result) => {
            return this.reply(pack.event, pack.id, result)
          })
          .catch((e: Error) => {
            return this.reply(pack.event, pack.id, e.message, true)
          })
        break
      }
      case 'page.network.enable': {
        this.networkManager
          .enable()
          .then(() => {
            return this.reply(pack.event, pack.id)
          })
          .catch((e: Error) => {
            return this.reply(pack.event, pack.id, e.message, true)
          })
        break
      }
      case 'page.network.disable': {
        this.networkManager
          .disable()
          .then(() => {
            return this.reply(pack.event, pack.id)
          })
          .catch((e: Error) => {
            return this.reply(pack.event, pack.id, e.message, true)
          })
        break
      }
    }
  }

  private async onCmdWaitForSelector(pack: FromServerPageWaitForSelectorSocketPack): Promise<void> {
    const { attachId } = await DebuggerManager.attach(this.tabId)
    await tryDo({
      handler: async () => {
        const val = await this.executionContext.executeScript((selector: string) => {
          return !!document.querySelector(selector)
        }, pack.data.selector)
        if (!val) {
          throw new Error(`selector('${pack.data.selector}') not found`)
        }
      },
      interval: 500,
      timeout: pack.data.options?.timeout || 30000,
    })
    await DebuggerManager.detach(attachId)
  }

  private async onCmdEvaluate(pack: FromServerPageEvaluateSocketPack): Promise<unknown> {
    const { attachId } = await DebuggerManager.attach(this.tabId)
    const result = await this.executionContext.executeScript(pack.data.code)
    await DebuggerManager.detach(attachId)
    return result
  }

  private async onCmdType(pack: FromServerPageTypeSocketPack): Promise<void> {
    const { attachId } = await DebuggerManager.attach(this.tabId)
    await this.executionContext.executeScript((pack: FromServerPageTypeSocketPack) => {
      const el = document.querySelector(pack.data.selector)
      if (!(el instanceof HTMLElement)) {
        throw new Error('Cannot focus non-HTMLElement')
      }
      el.focus()
    }, pack)
    await this.keyboard.type(pack.data.text, pack.data.options)
    await DebuggerManager.detach(attachId)
  }

  private async onCmdClick(pack: FromServerPageClickSocketPack): Promise<void> {
    const { attachId } = await DebuggerManager.attach(this.tabId)
    const elementHandle = new ElementHandle(this, pack.data.selector)
    await elementHandle.click()
    await DebuggerManager.detach(attachId)
  }

  private async onCmdScreenshot(pack: FromServerPageScreenshotSocketPack): Promise<string> {
    const { attachId } = await DebuggerManager.attach(this.tabId)
    const {
      fromSurface,
      optimizeForSpeed,
      quality,
      clip: userClip,
      type,
      captureBeyondViewport,
    } = pack.data

    let clip = userClip
    if (clip && !captureBeyondViewport) {
      const viewport = await this.executionContext.executeScript(() => {
        const { height, pageLeft: x, pageTop: y, width } = window.visualViewport!
        return { x, y, height, width }
      })
      clip = getIntersectionRect(clip, viewport)
    }

    const { data } = (await chrome.debugger.sendCommand(
      { tabId: this.tabId },
      'Page.captureScreenshot',
      {
        format: type,
        ...(optimizeForSpeed ? { optimizeForSpeed } : {}),
        ...(quality !== undefined ? { quality: Math.round(quality) } : {}),
        ...(clip ? { clip: { ...clip, scale: clip.scale ?? 1 } } : {}),
        ...(!fromSurface ? { fromSurface } : {}),
        captureBeyondViewport,
      }
    )) as { data: string }
    await DebuggerManager.detach(attachId)
    return data
  }

  private async onCmdGoto(pack: FromServerPageGotoSocketPack): Promise<void> {
    await this.goto(pack.data.url, pack.data.options)
  }

  private async onCmdKeyboardPress(pack: FromServerPageKeyboardPressSocketPack): Promise<void> {
    const { attachId } = await DebuggerManager.attach(this.tabId)
    await this.keyboard.press(pack.data.key, pack.data.options)
    await DebuggerManager.detach(attachId)
  }

  private async onCmdKeyboardType(pack: FromServerPageKeyboardTypeSocketPack): Promise<void> {
    const { attachId } = await DebuggerManager.attach(this.tabId)
    await this.keyboard.type(pack.data.text, pack.data.options)
    await DebuggerManager.detach(attachId)
  }

  private async onCmdMouseClick(pack: FromServerPageMouseClickSocketPack): Promise<void> {
    const { attachId } = await DebuggerManager.attach(this.tabId)
    await this.mouse.click(pack.data.x, pack.data.y, pack.data.options)
    await DebuggerManager.detach(attachId)
  }

  public async goto(url: string, options?: GotoOptions): Promise<void> {
    const { attachId } = await DebuggerManager.attach(this.tabId)
    await chrome.debugger.sendCommand({ tabId: this.tabId }, 'Page.navigate', {
      url,
      ...options,
    })
    this.executionContext.reset()
    await DebuggerManager.detach(attachId)
  }

  public async close(): Promise<void> {
    await this.networkManager.disable()
    if (this.closeSignalId) {
      await this.reply('page.close', this.closeSignalId)
    } else {
      await this.send('page.close')
    }
    super.close()
  }
}

function getIntersectionRect(
  clip: Readonly<ScreenshotClip>,
  viewport: Readonly<Rect>
): ScreenshotClip {
  const x = Math.max(clip.x, viewport.x)
  const y = Math.max(clip.y, viewport.y)
  return {
    x,
    y,
    width: Math.max(Math.min(clip.x + clip.width, viewport.x + viewport.width) - x, 0),
    height: Math.max(Math.min(clip.y + clip.height, viewport.y + viewport.height) - y, 0),
  }
}
