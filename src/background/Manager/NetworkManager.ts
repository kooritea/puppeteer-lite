import { FetchRequestPausedParams } from 'src/typings/puppeteer'

export class NetworkManager {
  private requestQueue: Array<FetchRequestPausedParams> = []
  private onEventHandler
  private isPause: boolean = false

  constructor(public tabId: number) {
    this.onEventHandler = (
      source: chrome._debugger.Debuggee,
      method: string,
      _params?: unknown
    ) => {
      this.onEvent(source, method, _params).catch((e) => {
        console.error(e)
      })
    }
  }

  public async enable(): Promise<void> {
    chrome.debugger.onEvent.addListener(this.onEventHandler)
    await chrome.debugger.sendCommand({ tabId: this.tabId }, 'Fetch.enable')
  }

  public async disable(): Promise<void> {
    chrome.debugger.onEvent.removeListener(this.onEventHandler)
    await chrome.debugger.sendCommand({ tabId: this.tabId }, 'Fetch.disable')
  }

  public pause(): void {
    this.isPause = true
  }
  public async continue(): Promise<void> {
    this.isPause = false
    const requestQueue = this.requestQueue
    this.requestQueue = []
    await Promise.all(
      requestQueue.map((request) => {
        return chrome.debugger.sendCommand({ tabId: this.tabId }, 'Fetch.continueRequest', {
          requestId: request.requestId,
        })
      })
    )
  }

  private async onEvent(
    source: chrome._debugger.Debuggee,
    method: string,
    _params?: unknown
  ): Promise<void> {
    if (source.tabId === this.tabId && method === 'Fetch.requestPaused') {
      const params = _params as FetchRequestPausedParams
      if (this.isPause) {
        this.requestQueue.push(params)
      } else {
        await chrome.debugger.sendCommand({ tabId: this.tabId }, 'Fetch.continueRequest', {
          requestId: params.requestId,
        })
      }
    }
  }
}
