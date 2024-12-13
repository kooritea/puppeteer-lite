import { tryDo } from '../utils.js'
import { Socket } from './socket.model.js'

export class Page extends Socket {
  private closeSignalId: string | undefined
  constructor(
    public tab: chrome.tabs.Tab,
    private pageId: string,
    serverURL: string
  ) {
    super(serverURL)
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
        this.onEvaluate(pack)
          .then((result) => {
            return this.send(pack.event, result, pack.id)
          })
          .catch((e: Error) => {
            return this.send(pack.event, e.message, pack.id, true)
          })
        break
      }
      case 'page.waitForSelector': {
        this.onWaitForSelector(pack)
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

  private async onWaitForSelector(pack: FromServerPageWaitForSelectorSocketPack): Promise<void> {
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

  private async onEvaluate(pack: FromServerPageEvaluateSocketPack): Promise<never> {
    return this.executeScript(function (code: string) {
      return window._callCodev8ds9v8929n2pvnb2fi3n(code)
    }, pack.data.code)
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
