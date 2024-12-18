import { BoundingBox, ClickOptions, Offset, Point } from 'src/typings/puppeteer'
import { Page } from '../model/page.model'

export class ElementHandle {
  constructor(
    private page: Page,
    public selector: string
  ) {}

  public async evaluate<Params extends unknown[], T>(
    func: (element: Element, ...args: Params) => T,
    ...args: Params
  ): Promise<Awaited<T>> {
    const data = await chrome.scripting.executeScript({
      target: { tabId: this.page.tabId },
      injectImmediately: true,
      world: 'MAIN',
      func: (selector: string, func: string, ...args: Params) => {
        const el = document.querySelector(selector)
        if (!el) {
          throw new Error(`selector('${selector}') not found`)
        }
        return (eval(func) as (element: Element, ...args: Params) => T)(el, ...args)
      },
      args: [this.selector, func.toString(), ...args],
    })
    return data[0].result as Awaited<T>
  }

  public async click(options: Readonly<ClickOptions> = {}) {
    await this.scrollIntoViewIfNeeded()
    const { x, y } = await this.clickablePoint(options.offset)
    await this.page.mouse.click(x, y, options)
  }

  private async scrollIntoViewIfNeeded(): Promise<void> {
    if (
      await this.isIntersectingViewport({
        threshold: 1,
      })
    ) {
      return
    }
    await this.scrollIntoView()
  }

  private isIntersectingViewport(
    options: {
      threshold?: number
    } = {}
  ): Promise<boolean> {
    return this.evaluate(async (element, threshold) => {
      const visibleRatio = await new Promise<number>((resolve) => {
        let target = element
        if (element instanceof SVGElement) {
          if (element instanceof SVGSVGElement) {
            target = element
          } else {
            target = element.ownerSVGElement!
          }
        }
        const observer = new IntersectionObserver((entries) => {
          resolve(entries[0].intersectionRatio)
          observer.disconnect()
        })
        observer.observe(target)
      })
      return threshold === 1 ? visibleRatio === 1 : visibleRatio > threshold
    }, options.threshold ?? 0)
  }

  private async scrollIntoView(): Promise<void> {
    await this.evaluate((element) => {
      element.scrollIntoView({
        block: 'center',
        inline: 'center',
        behavior: 'instant',
      })
    })
  }

  private async clickablePoint(offset?: Offset): Promise<Point> {
    const box = await this.clickableBox()
    if (!box) {
      throw new Error('Node is either not clickable or not an Element')
    }
    if (offset !== undefined) {
      return {
        x: box.x + offset.x,
        y: box.y + offset.y,
      }
    }
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    }
  }

  private async clickableBox(): Promise<BoundingBox | null> {
    const boxes = await this.evaluate((element) => {
      return Array.from(element.getClientRects()).map((rect) => {
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      })
    })
    if (!boxes?.length) {
      return null
    }
    await this.intersectBoundingBoxesWithFrame(boxes)
    const box = boxes.find((box) => {
      return box.width >= 1 && box.height >= 1
    })
    if (!box) {
      return null
    }
    return {
      x: box.x,
      y: box.y,
      height: box.height,
      width: box.width,
    }
  }

  private async intersectBoundingBoxesWithFrame(boxes: BoundingBox[]) {
    const { documentWidth, documentHeight } = await this.evaluate(() => {
      return {
        documentWidth: document.documentElement.clientWidth,
        documentHeight: document.documentElement.clientHeight,
      }
    })
    for (const box of boxes) {
      intersectBoundingBox(box, documentWidth, documentHeight)
    }
  }
}

function intersectBoundingBox(box: BoundingBox, width: number, height: number): void {
  box.width = Math.max(
    box.x >= 0 ? Math.min(width - box.x, box.width) : Math.min(width, box.width + box.x),
    0
  )
  box.height = Math.max(
    box.y >= 0 ? Math.min(height - box.y, box.height) : Math.min(height, box.height + box.y),
    0
  )
}
