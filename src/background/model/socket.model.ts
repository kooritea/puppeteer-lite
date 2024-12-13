import { getAuth } from '../utils.js'

export class Socket extends EventTarget {
  private socket: WebSocket | null = null
  private status: 'WAIT' | 'OPEN' | 'CLOSED' = 'WAIT'
  constructor(public serverURL: string) {
    super()
    this.connection()
  }

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

  protected async send(
    event: string,
    data?: unknown,
    id?: string,
    isError: boolean = false
  ): Promise<void> {
    await this.isOpen()
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

  protected open(): void {
    this.status = 'OPEN'
    this.dispatchEvent(new CustomEvent('connect_success'))
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
