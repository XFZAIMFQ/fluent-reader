import { app, ipcMain } from "electron"
import Store from "electron-store"
import {
    createServer,
    IncomingMessage,
    ServerResponse,
    Server,
} from "node:http"
import { randomBytes, timingSafeEqual } from "node:crypto"
import {
    LOCAL_API_PORT,
    LocalApiStatus,
    SubscriptionCheckReply,
} from "../schema-types"
import { normalizeSubscriptionUrl } from "../subscription-url"
import type { WindowManager } from "./window"

const HOST = "127.0.0.1"
const MAX_BODY_SIZE = 32768
const MAX_URLS = 50
const config = new Store<{ enabled: boolean; token: string }>({
    name: "local-api",
})

let server: Server | null = null
let lastError: string | null = null
let lifecycle = Promise.resolve()
let nextRequestId = 0

type PendingRequest = {
    resolve: (reply: SubscriptionCheckReply) => void
    timeout: NodeJS.Timeout
    senderId: number
}
const pending = new Map<number, PendingRequest>()

function getToken(): string {
    let token = config.get("token")
    if (!token) {
        token = randomBytes(32).toString("hex")
        config.set("token", token)
    }
    return token
}

function getStatus(): LocalApiStatus {
    return {
        enabled: config.get("enabled", false),
        running: server !== null && server.listening,
        port: LOCAL_API_PORT,
        error: lastError,
    }
}

function sendJson(response: ServerResponse, status: number, body: object) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    })
    response.end(JSON.stringify(body))
}

function isAuthorized(header: string | undefined): boolean {
    if (!header?.startsWith("Bearer ")) return false
    const received = Buffer.from(header.slice(7))
    const expected = Buffer.from(getToken())
    return (
        received.length === expected.length &&
        timingSafeEqual(received, expected)
    )
}

async function readBody(request: IncomingMessage): Promise<string | null> {
    const chunks: Buffer[] = []
    let size = 0
    let tooLarge = false
    for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        size += buffer.length
        if (size > MAX_BODY_SIZE) tooLarge = true
        if (!tooLarge) chunks.push(buffer)
    }
    return tooLarge ? null : Buffer.concat(chunks).toString("utf8")
}

function querySubscriptions(
    manager: WindowManager,
    urls: string[]
): Promise<SubscriptionCheckReply> {
    if (!manager.hasWindow()) return Promise.resolve({ ready: false })

    const contents = manager.mainWindow.webContents
    if (contents.isDestroyed()) return Promise.resolve({ ready: false })

    return new Promise(resolve => {
        const id = ++nextRequestId
        const timeout = setTimeout(() => {
            pending.delete(id)
            resolve({ ready: false })
        }, 5000)
        pending.set(id, { resolve, timeout, senderId: contents.id })
        contents.send("local-api-check", id, urls)
    })
}

async function handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    manager: WindowManager
) {
    request.setTimeout(10000, () => request.destroy())

    if (!config.get("enabled", false)) {
        sendJson(response, 503, { error: "Local API disabled" })
        return
    }
    if (request.headers.host !== `${HOST}:${LOCAL_API_PORT}`) {
        sendJson(response, 403, { error: "Invalid host" })
        return
    }
    if (request.url !== "/v1/subscriptions/check") {
        sendJson(response, 404, { error: "Not found" })
        return
    }
    if (request.method !== "POST") {
        sendJson(response, 405, { error: "Method not allowed" })
        return
    }
    if (!isAuthorized(request.headers.authorization)) {
        sendJson(response, 401, { error: "Unauthorized" })
        return
    }

    try {
        const body = await readBody(request)
        if (body === null) {
            sendJson(response, 413, { error: "Request too large" })
            return
        }

        let input: { urls?: unknown }
        try {
            input = JSON.parse(body)
        } catch {
            sendJson(response, 400, { error: "Invalid JSON" })
            return
        }
        if (
            !Array.isArray(input?.urls) ||
            input.urls.length < 1 ||
            input.urls.length > MAX_URLS ||
            input.urls.some(url => normalizeSubscriptionUrl(url) === null)
        ) {
            sendJson(response, 400, { error: "Invalid subscription URLs" })
            return
        }

        const reply = await querySubscriptions(manager, input.urls as string[])
        if (!config.get("enabled", false)) {
            sendJson(response, 503, { error: "Local API disabled" })
            return
        }
        if (!reply.ready || reply.results?.length !== input.urls.length) {
            sendJson(response, 503, { error: "Subscriptions not ready" })
            return
        }
        sendJson(response, 200, { results: reply.results })
    } catch {
        if (!response.headersSent)
            sendJson(response, 503, { error: "Subscriptions unavailable" })
    }
}

async function startServer(manager: WindowManager) {
    if (server) return
    const candidate = createServer((request, response) => {
        void handleRequest(request, response, manager)
    })
    candidate.on("error", error => {
        lastError = error.message
        if (server === candidate) server = null
    })
    try {
        await new Promise<void>((resolve, reject) => {
            candidate.once("error", reject)
            candidate.listen(LOCAL_API_PORT, HOST, () => {
                candidate.removeListener("error", reject)
                resolve()
            })
        })
        server = candidate
        lastError = null
    } catch (error) {
        lastError = String(error)
    }
}

async function stopServer() {
    const current = server
    server = null
    lastError = null
    if (current?.listening)
        await new Promise<void>(resolve => current.close(() => resolve()))
}

function setEnabled(manager: WindowManager, enabled: boolean) {
    config.set("enabled", enabled)
    lifecycle = lifecycle.then(async () => {
        if (config.get("enabled", false)) await startServer(manager)
        else await stopServer()
    })
    return lifecycle.then(getStatus)
}

export function initializeLocalApi(manager: WindowManager) {
    ipcMain.handle("local-api-status", () => getStatus())
    ipcMain.handle("local-api-set-enabled", (_, enabled: boolean) => {
        if (typeof enabled !== "boolean")
            throw new Error("Invalid enabled state")
        return setEnabled(manager, enabled)
    })
    ipcMain.handle("local-api-get-token", () => getToken())
    ipcMain.handle("local-api-regenerate-token", () => {
        config.set("token", randomBytes(32).toString("hex"))
    })
    ipcMain.on("local-api-check-result", (event, id: number, reply) => {
        const request = pending.get(id)
        if (!request || request.senderId !== event.sender.id) return
        pending.delete(id)
        clearTimeout(request.timeout)
        request.resolve(reply)
    })

    app.on("before-quit", () => {
        if (server) server.close()
    })
    if (config.get("enabled", false)) void setEnabled(manager, true)
}
