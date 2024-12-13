import { Page } from './page.model.js'
import { Socket } from './socket.model.js'

export class Browser extends Socket {
  private pages: Array<Page> = []
  private emitCreateChilBrowser: (browser: Browser) => void
  constructor(serverURL: string, onCreateChildBrowser: (browser: Browser) => void) {
    super(serverURL)
    this.emitCreateChilBrowser = onCreateChildBrowser
  }

  protected createSocketOpenPack(token: string): string {
    return JSON.stringify({
      event: 'browser.create',
      data: {
        auth: token,
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
            return this.send(pack.event, {}, pack.id)
          })
          .catch((e: Error) => {
            return this.send(pack.event, e.message, pack.id, true)
          })
        break
      }
      case 'browser.createPage': {
        this.onCreatePage(pack)
        break
      }
    }
  }

  private onCreateChildBrowser(pack: FromServerBrowserCreateChildBrowserSocketPack): Promise<void> {
    return new Promise((resolve, reject) => {
      const browser = new Browser(pack.data.serverURL, this.emitCreateChilBrowser)
      browser.addEventListener('connect_success', () => {
        this.emitCreateChilBrowser(browser)
        resolve()
      })
      browser.addEventListener('connect_error', (e) => {
        console.log('从浏览器实例创建失败', e)
        reject(new Error(`connect_error: ${pack.data.serverURL}`))
      })
    })
  }

  private onCreatePage(pack: FromServerBrowserCreatePageSocketPack): void {
    chrome.tabs.create({ url: pack.data.url }, (tab) => {
      const page = new Page(tab, pack.data.pageId, this.serverURL)
      this.pages.push(page)
    })
  }

  public async removePage(tabId: number): Promise<void> {
    const pageIndex = this.pages.findIndex((item) => {
      return item.tab.id === tabId
    })
    const page = this.pages[pageIndex]
    if (page) {
      this.pages = this.pages.splice(pageIndex, 1)
      await page.close()
    }
  }
}
