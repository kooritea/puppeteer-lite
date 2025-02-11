import {
  FromServerBrowserCreateChildBrowserSocketPack,
  FromServerBrowserCreatePageSocketPack,
  FromServerSocketPack,
} from 'src/typings/server.js'
import { Page } from './page.model.js'
import { Socket } from './socket.model.js'

export class Browser extends Socket {
  private closeSignalId: string | undefined
  private pages: Array<Page> = []
  private emitCreateChilBrowser: (serverURL: string) => Promise<Browser>
  constructor(serverURL: string, onCreateChildBrowser: (serverURL: string) => Promise<Browser>) {
    super(serverURL, true)
    this.emitCreateChilBrowser = onCreateChildBrowser
  }

  protected createSocketOpenPack(token: string): string {
    return JSON.stringify({
      event: 'browser.create',
      data: {
        auth: token,
        pages: this.pages.map((page) => {
          return {
            pageId: page.pageId,
          }
        }),
      },
    })
  }

  public ping() {
    this.send('browser.ping').catch((e) => {
      console.error(e)
    })
  }

  protected onMessage(pack: FromServerSocketPack): void {
    switch (pack.event) {
      case 'browser.auth': {
        this.open()
        break
      }
      case 'browser.createChildBrowser': {
        this.onCreateChildBrowser(pack)
          .then(() => {
            return this.reply(pack.event, pack.id)
          })
          .catch((e: Error) => {
            return this.reply(pack.event, pack.id, e.message, true)
          })
        break
      }
      case 'browser.createPage': {
        this.onCreatePage(pack).catch((e: Error) => {
          return this.reply(pack.event, pack.id, e.message, true)
        })
        break
      }
      case 'browser.close': {
        this.closeSignalId = pack.id
        this.close().catch((e: Error) => {
          return this.reply(pack.event, pack.id, e.message, true)
        })
        break
      }
    }
  }

  private async onCreateChildBrowser(
    pack: FromServerBrowserCreateChildBrowserSocketPack
  ): Promise<void> {
    await this.emitCreateChilBrowser(pack.data.serverURL)
  }

  private async onCreatePage(pack: FromServerBrowserCreatePageSocketPack): Promise<Page> {
    const tab = await chrome.tabs.create({ url: 'about:blank' })
    const page = new Page(
      tab,
      pack.data?.pageId || `page.${Date.now() + Math.random()}`,
      this.serverURL
    )
    if (pack.data?.url) {
      await page.goto(pack.data.url)
    }
    page.connect()
    await new Promise<void>((resolve) => {
      page.addEventListener('connect_success', () => {
        this.pages.push(page)
        resolve()
      })
    })
    return page
  }

  public async removePage(tabId: number): Promise<void> {
    const pageIndex = this.pages.findIndex((item) => {
      return item.tabId === tabId
    })
    const page = this.pages[pageIndex]
    if (page) {
      this.pages.splice(pageIndex, 1)
      await page.close()
    }
  }

  public async close(): Promise<void> {
    if (this.closeSignalId) {
      await this.reply('browser.close', this.closeSignalId)
    } else {
      await this.send('browser.close')
    }
    super.close()
    this.dispatchEvent(new CustomEvent('close'))
  }
}
