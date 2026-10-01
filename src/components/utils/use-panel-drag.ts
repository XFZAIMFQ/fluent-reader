import * as React from "react"

type Offset = { x: number; y: number }

export function usePanelDrag(display: boolean) {
    const panelRef = React.useRef<HTMLDivElement>(null)
    const [offset, setOffset] = React.useState<Offset>({ x: 0, y: 0 })
    const offsetRef = React.useRef(offset)
    const [dragging, setDragging] = React.useState(false)
    const dragRef = React.useRef<{
        pointer: number
        x: number
        y: number
        offset: Offset
        handle: HTMLElement
    }>(null)

    const move = React.useCallback((next: Offset) => {
        const panel = panelRef.current
        if (!panel) return
        const rect = panel.getBoundingClientRect()
        const left = rect.left - offsetRef.current.x
        const top = rect.top - offsetRef.current.y
        const clamp = (value: number, min: number, max: number) =>
            min > max ? (min + max) / 2 : Math.max(min, Math.min(max, value))
        const bounded = {
            x: clamp(
                next.x,
                8 - left,
                window.innerWidth - 8 - left - rect.width
            ),
            y: clamp(
                next.y,
                8 - top,
                window.innerHeight - 8 - top - rect.height
            ),
        }
        offsetRef.current = bounded
        setOffset(bounded)
    }, [])

    const stop = React.useCallback(() => {
        const drag = dragRef.current
        dragRef.current = null
        if (drag?.handle.hasPointerCapture(drag.pointer))
            drag.handle.releasePointerCapture(drag.pointer)
        setDragging(false)
    }, [])

    React.useLayoutEffect(() => {
        stop()
        offsetRef.current = { x: 0, y: 0 }
        setOffset(offsetRef.current)
        if (!display) return
        const resize = () => {
            stop()
            move(offsetRef.current)
        }
        window.addEventListener("resize", resize)
        window.addEventListener("blur", stop)
        return () => {
            window.removeEventListener("resize", resize)
            window.removeEventListener("blur", stop)
        }
    }, [display, move, stop])

    const handlers = {
        onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
            if (
                event.button !== 0 ||
                !event.isPrimary ||
                (event.target as HTMLElement).closest(
                    "button, input, select, textarea, a, [role='combobox']"
                )
            )
                return
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            dragRef.current = {
                pointer: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                offset: offsetRef.current,
                handle: event.currentTarget,
            }
            setDragging(true)
        },
        onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
            const drag = dragRef.current
            if (!drag || drag.pointer !== event.pointerId) return
            move({
                x: drag.offset.x + event.clientX - drag.x,
                y: drag.offset.y + event.clientY - drag.y,
            })
        },
        onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
            if (event.pointerId === dragRef.current?.pointer) stop()
        },
        onPointerCancel: stop,
        onLostPointerCapture: stop,
    }
    return { panelRef, offset, dragging, handlers }
}
