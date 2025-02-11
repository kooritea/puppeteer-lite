import { ClickOptions } from 'puppeteer-core'
import {
  GotoOptions,
  KeyboardTypeOptions,
  KeyInput,
  KeyPressOptions,
  MouseClickOptions,
  ScreenshotOptions,
  WaitForSelectorOptions,
} from './puppeteer'

type ServerPageEvent =
  | 'page.auth'
  | 'page.evaluate'
  | 'page.waitForSelector'
  | 'page.type'
  | 'page.click'
  | 'page.screenshot'
  | 'page.cookies'
  | 'page.goto'
  | 'page.close'
type ServerpageKeyboardEvent = 'page.keyboard.press' | 'page.keyboard.type'
type ServerpageMouseEvent = 'page.mouse.click'
type ServerpageNetworkEvent = 'page.network.enable' | 'page.network.disable'
type ServerBrowserEvent =
  | 'browser.auth'
  | 'browser.createChildBrowser'
  | 'browser.createPage'
  | 'browser.close'
type ServerEvent =
  | ServerPageEvent
  | ServerpageKeyboardEvent
  | ServerpageMouseEvent
  | ServerBrowserEvent
  | ServerpageNetworkEvent

interface SocketPack {
  event: ServerEvent
  id?: string
}

interface FromServerPageAuthSocketPack extends SocketPack {
  event: 'page.auth'
}
interface FromServerPageEvaluateSocketPack extends SocketPack {
  event: 'page.evaluate'
  id: string
  data: {
    code: string
  }
}
interface FromServerPageWaitForSelectorSocketPack extends SocketPack {
  event: 'page.waitForSelector'
  id: string
  data: {
    selector: string
    options?: WaitForSelectorOptions
  }
}
interface FromServerPageTypeSocketPack extends SocketPack {
  event: 'page.type'
  id: string
  data: {
    selector: string
    text: string
    options?: KeyboardTypeOptions
  }
}
interface FromServerPageClickSocketPack extends SocketPack {
  event: 'page.click'
  id: string
  data: {
    selector: string
    options?: ClickOptions
  }
}
interface FromServerPageScreenshotSocketPack extends SocketPack {
  event: 'page.screenshot'
  id: string
  data: ScreenshotOptions
}
interface FromServerPageCookiesSocketPack extends SocketPack {
  event: 'page.cookies'
  id: string
  data: {
    urls?: string[]
  }
}

interface FromServerPageGotoSocketPack extends SocketPack {
  event: 'page.goto'
  id: string
  data: {
    url: string
    options?: GotoOptions
  }
}
interface FromServerPageCloseSocketPack extends SocketPack {
  event: 'page.close'
  id: string
}

interface FromServerPageKeyboardPressSocketPack extends SocketPack {
  event: 'page.keyboard.press'
  id: string
  data: {
    key: KeyInput
    options?: KeyPressOptions
  }
}

interface FromServerPageKeyboardTypeSocketPack extends SocketPack {
  event: 'page.keyboard.type'
  id: string
  data: {
    text: string
    options?: KeyboardTypeOptions
  }
}

interface FromServerPageMouseClickSocketPack extends SocketPack {
  event: 'page.mouse.click'
  id: string
  data: {
    x: number
    y: number
    options?: MouseClickOptions
  }
}

interface FromServerPageNetworkEnableSocketPack extends SocketPack {
  event: 'page.network.enable'
  id: string
}

interface FromServerPageNetworkDisableSocketPack extends SocketPack {
  event: 'page.network.disable'
  id: string
}

interface FromServerBrowserAuthSocketPack extends SocketPack {
  event: 'browser.auth'
}
interface FromServerBrowserCreateChildBrowserSocketPack extends SocketPack {
  event: 'browser.createChildBrowser'
  id: string
  data: {
    serverURL: string
  }
}
interface FromServerBrowserCreatePageSocketPack extends SocketPack {
  event: 'browser.createPage'
  id: string
  data?: {
    url?: string
    pageId?: string
  }
}
interface FromServerBrowserCloseSocketPack extends SocketPack {
  event: 'browser.close'
  id: string
}

type FromServerSocketPack =
  | FromServerPageAuthSocketPack
  | FromServerPageEvaluateSocketPack
  | FromServerPageWaitForSelectorSocketPack
  | FromServerPageTypeSocketPack
  | FromServerPageClickSocketPack
  | FromServerPageScreenshotSocketPack
  | FromServerPageCookiesSocketPack
  | FromServerPageGotoSocketPack
  | FromServerPageCloseSocketPack
  | FromServerPageKeyboardPressSocketPack
  | FromServerPageKeyboardTypeSocketPack
  | FromServerPageMouseClickSocketPack
  | FromServerPageNetworkEnableSocketPack
  | FromServerPageNetworkDisableSocketPack
  | FromServerBrowserAuthSocketPack
  | FromServerBrowserCreateChildBrowserSocketPack
  | FromServerBrowserCreatePageSocketPack
  | FromServerBrowserCloseSocketPack
