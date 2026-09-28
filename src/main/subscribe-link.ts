import { app, BrowserWindow, ipcMain } from "electron"
import * as path from "node:path"
import { SourceCategory, SubscribeLinkRequest } from "../schema-types"

let pendingLink: SubscribeLinkRequest = null

export function parseSubscribeLink(raw: string): SubscribeLinkRequest | null {
    if (!raw || raw.length > 8192) return null

    try {
        const link = new URL(raw)
        if (
            link.protocol !== "fluentreader:" ||
            link.hostname !== "subscribe" ||
            !["", "/"].includes(link.pathname)
        )
            return null

        const url = new URL(link.searchParams.get("url") || "")
        if (
            !["http:", "https:"].includes(url.protocol) ||
            url.username ||
            url.password
        )
            return null

        const requestedView = link.searchParams.get("view")
        const view = [
            SourceCategory.Articles,
            SourceCategory.Social,
            SourceCategory.Pictures,
            SourceCategory.Videos,
        ].includes(requestedView as SourceCategory)
            ? (requestedView as SourceCategory)
            : SourceCategory.Articles

        return { url: url.toString(), view }
    } catch {
        return null
    }
}

export function captureSubscribeLink(args: string[]) {
    const request = args
        .map(parseSubscribeLink)
        .find((link): link is SubscribeLinkRequest => link !== null)
    if (!request) return

    pendingLink = request
    for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed())
            window.webContents.send("subscribe-link-available")
    }
}

export function initializeSubscribeProtocol() {
    if (app.isPackaged) {
        app.setAsDefaultProtocolClient("fluentreader")
    } else if (path.basename(process.argv[1] || "") === "electron.js") {
        app.setAsDefaultProtocolClient("fluentreader", process.execPath, [
            path.resolve(process.argv[1]),
        ])
    }

    app.on("open-url", (event, url) => {
        event.preventDefault()
        captureSubscribeLink([url])
    })

    ipcMain.handle("take-subscribe-link", () => {
        const request = pendingLink
        pendingLink = null
        return request
    })

    captureSubscribeLink(process.argv)
}
