import * as React from "react"

export function useListReorder(
    ids: string[],
    onMove: (from: string, to: string) => void,
    disabled: boolean
) {
    const listRef = React.useRef<HTMLDivElement>(null)
    const drag = React.useRef<{
        id: string
        target: string
        x: number
        y: number
        moved: boolean
    }>(null)
    const [over, setOver] = React.useState<string>(null)
    const clear = () => {
        drag.current = null
        setOver(null)
    }
    return {
        listRef,
        over,
        handleProps: (id: string) => ({
            disabled,
            onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
                if (disabled || event.button !== 0 || !event.isPrimary) return
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
                drag.current = {
                    id,
                    target: id,
                    x: event.clientX,
                    y: event.clientY,
                    moved: false,
                }
            },
            onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => {
                const current = drag.current,
                    list = listRef.current
                if (!current || !list) return
                current.moved ||=
                    Math.hypot(
                        event.clientX - current.x,
                        event.clientY - current.y
                    ) > 4
                if (!current.moved) return
                const bounds = list.getBoundingClientRect()
                if (event.clientY < bounds.top + 24) list.scrollTop -= 12
                else if (event.clientY > bounds.bottom - 24)
                    list.scrollTop += 12
                const row = document
                    .elementFromPoint(event.clientX, event.clientY)
                    ?.closest<HTMLElement>("[data-reorder-id]")
                const target =
                    row &&
                    list.contains(row) &&
                    ids.includes(row.dataset.reorderId)
                        ? row.dataset.reorderId
                        : null
                current.target = target
                setOver(target)
            },
            onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
                const current = drag.current
                clear()
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId)
                if (
                    current?.moved &&
                    current.target &&
                    current.id !== current.target &&
                    !disabled
                )
                    onMove(current.id, current.target)
            },
            onPointerCancel: clear,
            onLostPointerCapture: clear,
            onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
                if (
                    disabled ||
                    (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                )
                    return
                event.preventDefault()
                const target =
                    ids[ids.indexOf(id) + (event.key === "ArrowUp" ? -1 : 1)]
                if (target) onMove(id, target)
            },
        }),
    }
}
