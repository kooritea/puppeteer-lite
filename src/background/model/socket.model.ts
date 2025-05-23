import { FromServerSocketPack, ServerEvent } from 'src/typings/server.js'
import { getAuth } from '../utils.js'

export abstract class Socket extends EventTarget {
  private socket: WebSocket | null = null
  private status: 'WAIT' | 'OPEN' | 'CLOSED' = 'WAIT'
  private isFirstOpen = true
  constructor(
    public serverURL: string,
    immediate: boolean
  ) {
    super()
    if (immediate) {
      this.connect()
    }
  }

  public connect(): void {
    this.beforeConnect()
      .then(() => {
        this.connection()
      })
      .catch((e) => {
        console.error(e)
        this.close()
      })
  }

  protected async beforeConnect(): Promise<void> {}

  private connection(): void {
    this.socket = new WebSocket(this.serverURL)
    this.socket.addEventListener('message', (ev) => {
      const pack = JSON.parse(ev.data as string) as FromServerSocketPack
      this.onMessage(pack)
    })
    this.socket.addEventListener('open', () => {
      getAuth()
        .then((token) => {
          this.socket?.send(this.createSocketOpenPack(token))
        })
        .catch((e) => {
          console.error(e)
        })
    })
    this.socket.addEventListener('error', () => {
      this.dispatchEvent(new CustomEvent('connect_error'))
    })
    this.socket.addEventListener('close', () => {
      if (this.status !== 'CLOSED') {
        this.status = 'WAIT'
        setTimeout(() => {
          this.connection()
        }, 1000)
      }
    })
  }

  private isOpen(): Promise<void> {
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

  public async reply(
    event: ServerEvent,
    id: string,
    data?: unknown,
    isError: boolean = false
  ): Promise<void> {
    return this._send(event, id, data, isError)
  }

  public async send(event: ClientEvent, data?: unknown, isError: boolean = false): Promise<void> {
    return this._send(event, undefined, data, isError)
  }

  private async _send(
    event: ServerEvent | ClientEvent,
    id?: string,
    data?: unknown,
    isError: boolean = false
  ): Promise<void> {
    if (isError) {
      console.error(event, data)
    }
    await this.isOpen()
    this.socket?.send(
      JSON.stringify({
        event,
        id,
        data,
        isError,
      })
    )
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve()
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  protected open(): void {
    this.status = 'OPEN'
    if (this.isFirstOpen) {
      this.dispatchEvent(new CustomEvent('connect_success'))
      this.isFirstOpen = false
    }
  }

  protected close(): void {
    this.status = 'CLOSED'
    this.socket?.close()
  }

  protected createSocketOpenPack(token: string): string {
    throw new Error(`createSocketOpenPack: ${token}`)
  }

  protected onMessage(pack: FromServerSocketPack): void {
    console.log(pack)
  }
}
