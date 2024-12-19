import { FetchRequestPausedParams } from 'src/typings/puppeteer'
import { DebuggerManager } from './DebuggerManager'

export class NetworkManager {
  private requestQueue: Array<FetchRequestPausedParams> = []
  private attachId!: string
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
    this.attachId = await DebuggerManager.attach(this.tabId)
    await chrome.debugger.sendCommand({ tabId: this.tabId }, 'Fetch.enable')
    chrome.debugger.onEvent.addListener(this.onEventHandler)
  }

  public async disable(): Promise<void> {
    await chrome.debugger.sendCommand({ tabId: this.tabId }, 'Fetch.disable')
    await DebuggerManager.detach(this.attachId)
    chrome.debugger.onEvent.removeListener(this.onEventHandler)
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
    if (method === 'Fetch.requestPaused') {
      const params = _params as FetchRequestPausedParams
      if (this.isPause) {
        this.requestQueue.push(params)
      } else {
        await chrome.debugger.sendCommand({ tabId: this.tabId }, 'Fetch.continueRequest', {
          requestId: params.requestId,
        })
      }
    } else {
      console.log(source, method, _params)
    }
  }
}
