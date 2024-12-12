import { Page } from './page.model.js'
import { getAuth } from './utils.js'

export class Browser extends EventTarget {
  private socket: WebSocket | null = null
  private status: 'WAIT' | 'OPEN' | 'CLOSED' = 'WAIT'
  private pages: Array<Page> = []
  private emitCreateChilBrowser: (browser: Browser) => void
  constructor(
    private serverURL: string,
    private isMaster = false,
    onCreateChildBrowser: (browser: Browser) => void
  ) {
    super()
    this.emitCreateChilBrowser = onCreateChildBrowser
    this._connection()
  }

  private _connection(): void {
    this.socket = new WebSocket(this.serverURL)
    this.socket.addEventListener('message', (ev) => {
      const pack = JSON.parse(ev.data as string) as FromServerSocketPack
      this.onMessage(pack)
    })
    this.socket.addEventListener('open', () => {
      getAuth()
        .then((token) => {
          this.dispatchEvent(new CustomEvent('connect_success'))
          this.socket?.send(
            JSON.stringify({
              event: 'browser.create',
              data: {
                auth: token,
              },
            })
          )
          console.log(`已连接: ${this.serverURL}`)
        })
        .catch((e) => {
          console.error(e)
        })
    })
    this.socket.addEventListener('error', () => {
      this.dispatchEvent(new CustomEvent('connect_error'))
    })
    this.socket.addEventListener('close', () => {
      if (this.isMaster) {
        if (this.status !== 'CLOSED') {
          this.status = 'WAIT'
          setTimeout(() => {
            this._connection()
          }, 1000)
        }
      } else {
        this.dispatchEvent(new CustomEvent('close'))
      }
    })
  }

  private _isOpen(): Promise<void> {
    return new Promise((resolve) => {
      if (this.status === 'OPEN') {
        resolve()
      } else {
        const timer = setInterval(() => {
          if (this.status === 'OPEN') {
            clearInterval(timer)
            resolve()
          }
        }, 100)
      }
    })
  }

  private async send(
    event: string,
    data?: unknown,
    id?: string,
    isError: boolean = false
  ): Promise<void> {
    await this._isOpen()
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          this.socket?.send(
            JSON.stringify({
              event,
              id,
              data,
              isError,
            })
          )
          resolve()
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  public ping() {
    this.send('browser.ping').catch((e) => {
      console.error(e)
    })
  }

  private onMessage(pack: FromServerSocketPack): void {
    switch (pack.event) {
      case 'browser.auth': {
        this.status = 'OPEN'
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
      const browser = new Browser(pack.data.serverURL, false, this.emitCreateChilBrowser)
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

  public async onRemovePage(tabId: number): Promise<void> {
    const pageIndex = this.pages.findIndex((item) => {
      return item.tab.id === tabId
    })
    const page = this.pages[pageIndex]
    if (page) {
      this.pages = this.pages.splice(pageIndex, 1)
      await page.onClose()
    }
  }
}
