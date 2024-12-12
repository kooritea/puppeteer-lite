import { getAuth, tryDo } from './utils.js'

export class Page extends EventTarget {
  private closeSignalId: string | undefined
  private status: 'WAIT' | 'OPEN' | 'CLOSED' = 'WAIT'
  private socket: WebSocket | null = null
  constructor(
    public tab: chrome.tabs.Tab,
    private pageId: string,
    private serverURL: string
  ) {
    super()
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
          this.socket?.send(
            JSON.stringify({
              event: 'page.create',
              data: {
                pageId: this.pageId,
                auth: token,
              },
            })
          )
        })
        .catch((e) => {
          console.error(e)
        })
    })
    this.socket.addEventListener('close', () => {
      if (this.status !== 'CLOSED') {
        setTimeout(() => {
          this._connection()
        }, 1000)
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
    data: unknown,
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

  private onMessage(pack: FromServerSocketPack): void {
    switch (pack.event) {
      case 'page.auth': {
        this.status = 'OPEN'
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

  public async onClose(): Promise<void> {
    await this.send('page.close', {}, this.closeSignalId)
    this.status = 'CLOSED'
    this.socket?.close()
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
