import { FetchRequestPausedParams } from 'src/typings/puppeteer'
import { Page } from '../model/page.model'
import { DebuggerManager } from './DebuggerManager.js'

export class NetworkManager {
  private onEventHandler
  private attachId: string | null = null

  constructor(
    private page: Page,
    public tabId: number
  ) {
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
    const { attachId } = await DebuggerManager.attach(this.tabId)
    this.attachId = attachId
    chrome.debugger.onEvent.addListener(this.onEventHandler)
    await chrome.debugger.sendCommand({ tabId: this.tabId }, 'Fetch.enable', {
      patterns: [{ requestStage: 'Request' }, { requestStage: 'Response' }],
    })
  }

  public async disable(): Promise<void> {
    if (this.attachId) {
      chrome.debugger.onEvent.removeListener(this.onEventHandler)
      await chrome.debugger.sendCommand({ tabId: this.tabId }, 'Fetch.disable')
      await DebuggerManager.detach(this.attachId)
    }
  }

  private async onEvent(
    source: chrome._debugger.Debuggee,
    method: string,
    _params?: unknown
  ): Promise<void> {
    if (source.tabId === this.tabId) {
      if (method === 'Fetch.requestPaused') {
        const params = _params as FetchRequestPausedParams
        if (!params.responseErrorReason && !params.responseStatusCode) {
          await this.page.send('page.network.request', {
            ...params,
            pageId: this.page.pageId,
          })
          await chrome.debugger.sendCommand({ tabId: this.tabId }, 'Fetch.continueRequest', {
            requestId: params.requestId,
          })
        } else {
          const response = (await chrome.debugger.sendCommand(
            { tabId: this.tabId },
            'Fetch.getResponseBody',
            {
              requestId: params.requestId,
            }
          )) as {
            body: string
            base64Encoded: boolean
          }
          await this.page.send('page.network.response', {
            ...params,
            response,
            pageId: this.page.pageId,
          })
          await chrome.debugger.sendCommand({ tabId: this.tabId }, 'Fetch.fulfillRequest', {
            requestId: params.requestId,
            responseCode: params.responseStatusCode,
            responseHeaders: params.responseHeaders,
            body: response.body,
          })
        }
      }
    }
  }
}
