import * as db from "../db"
import lf from "lovefield"
import intl from "react-intl-universal"
import type { MyParserItem } from "../utils"
import { resolveSubscriptionPolicy, feedWebsite } from "../subscription-policy"
import { feedIsDue, runFeedQueue, planFeed } from "../feed-scheduler"
import { createRefreshFeedback } from "./refresh-feedback"
import {
    domParser,
    htmlDecode,
    ActionStatus,
    AppThunk,
    platformCtrl,
} from "../utils"
import { RSSSource, updateSource, updateUnreadCounts } from "./source"
import {
    FeedActionTypes,
    INIT_FEED,
    LOAD_MORE,
    dismissItems,
    FeedFilter,
    RSSFeed,
} from "./feed"
import {
    pushNotification,
    setupAutoFetch,
    SettingsActionTypes,
    FREE_MEMORY,
} from "./app"
import {
    getServiceHooks,
    syncWithService,
    ServiceActionTypes,
    SYNC_LOCAL_ITEMS,
} from "./service"

export interface RSSMedia {
    images?: string[]
    videoUrl?: string
    duration?: number
}

export function getItemMedia(item: RSSItem): RSSMedia {
    try {
        return JSON.parse(item.media || "{}") as RSSMedia
    } catch {
        return {}
    }
}

export class RSSItem {
    _id: number
    source: number
    title: string
    link: string
    date: Date
    fetchedDate: Date
    thumb?: string
    content: string
    snippet: string
    creator?: string
    hasRead: boolean
    starred: boolean
    hidden: boolean
    notify: boolean
    serviceRef?: string
    media: string

    constructor(item: MyParserItem, source: RSSSource) {
        for (let field of ["title", "link", "creator"]) {
            const content = item[field]
            if (content && typeof content !== "string") delete item[field]
        }
        this.source = source.sid
        this.title = item.title || intl.get("article.untitled")
        this.link = item.link || ""
        this.fetchedDate = new Date()
        const parsedDate = new Date(
            item.isoDate ?? item.pubDate ?? this.fetchedDate
        )
        this.date = Number.isNaN(parsedDate.getTime())
            ? this.fetchedDate
            : parsedDate
        this.creator = item.creator
        this.hasRead = false
        this.starred = false
        this.hidden = false
        this.notify = false
        this.media = "{}"
    }

    static parseContent(item: RSSItem, parsed: MyParserItem) {
        for (let field of ["thumb", "content", "fullContent"]) {
            const content = parsed[field]
            if (content && typeof content !== "string") delete parsed[field]
        }
        if (parsed.fullContent) {
            item.content = parsed.fullContent
            item.snippet = htmlDecode(parsed.fullContent)
        } else {
            item.content = parsed.content || ""
            item.snippet = htmlDecode(parsed.contentSnippet || "")
        }
        if (parsed.thumb) {
            item.thumb = parsed.thumb
        } else if (parsed.image?.$?.url) {
            item.thumb = parsed.image.$.url
        } else if (parsed.image && typeof parsed.image === "string") {
            item.thumb = parsed.image
        } else if (parsed.mediaContent) {
            let images = parsed.mediaContent.filter(
                c => c.$ && c.$.medium === "image" && c.$.url
            )
            if (images.length > 0) item.thumb = images[0].$.url
        }
        if (!item.thumb) {
            let dom = domParser.parseFromString(item.content, "text/html")
            let baseEl = dom.createElement("base")
            baseEl.setAttribute(
                "href",
                item.link.split("/").slice(0, 3).join("/")
            )
            dom.head.append(baseEl)
            let img = dom.querySelector("img")
            if (img && img.src) item.thumb = img.src
        }
        if (
            item.thumb &&
            !item.thumb.startsWith("https://") &&
            !item.thumb.startsWith("http://")
        ) {
            delete item.thumb
        }

        const media: RSSMedia = { images: [] }
        const addImage = (url: string) => {
            const identity = url?.replace(/^https?:\/\//i, "//")
            if (
                typeof url === "string" &&
                /^https?:\/\//i.test(url) &&
                !media.images.some(
                    image => image.replace(/^https?:\/\//i, "//") === identity
                )
            ) {
                media.images.push(url)
            }
        }
        addImage(item.thumb)
        if (parsed.mediaContent) {
            for (const content of parsed.mediaContent) {
                if (content.$?.medium === "image") addImage(content.$.url)
                if (
                    content.$?.medium === "video" &&
                    /^https?:\/\//i.test(content.$.url)
                ) {
                    media.videoUrl = content.$.url
                }
                if (content.$?.duration && !media.duration) {
                    media.duration = parseDuration(content.$.duration)
                }
            }
        }
        if (parsed.enclosure?.url) {
            if (parsed.enclosure.type?.startsWith("image/")) {
                addImage(parsed.enclosure.url)
            } else if (
                parsed.enclosure.type?.startsWith("video/") &&
                /^https?:\/\//i.test(parsed.enclosure.url)
            ) {
                media.videoUrl = parsed.enclosure.url
            }
        }
        const contentDom = domParser.parseFromString(item.content, "text/html")
        const base = contentDom.createElement("base")
        base.setAttribute("href", item.link.split("/").slice(0, 3).join("/"))
        contentDom.head.append(base)
        for (const img of Array.from(contentDom.querySelectorAll("img"))) {
            addImage(img.src)
        }
        if (parsed.videoDuration && !media.duration) {
            media.duration = parseDuration(parsed.videoDuration)
        }
        if (!item.thumb) item.thumb = media.images[0]
        item.media = JSON.stringify(media)
    }
}

function parseDuration(raw: string): number | undefined {
    if (!/^\d+(?::\d+){0,2}$/.test(raw)) return undefined
    const parts = raw.split(":").map(Number)
    return parts.reduce((seconds, part) => seconds * 60 + part, 0)
}

export type ItemState = {
    [_id: number]: RSSItem
}

export const FETCH_ITEMS = "FETCH_ITEMS"
const CACHE_ITEMS = "CACHE_ITEMS"
export const MARK_READ = "MARK_READ"
export const MARK_ALL_READ = "MARK_ALL_READ"
export const MARK_UNREAD = "MARK_UNREAD"
export const TOGGLE_STARRED = "TOGGLE_STARRED"
export const TOGGLE_HIDDEN = "TOGGLE_HIDDEN"

interface FetchItemsAction {
    type: typeof FETCH_ITEMS
    status: ActionStatus
    fetchCount?: number
    items?: RSSItem[]
    itemState?: ItemState
    errSource?: RSSSource
    err?
    complete?: boolean
    background?: boolean
}

interface MarkReadAction {
    type: typeof MARK_READ
    item: RSSItem
}

interface MarkAllReadAction {
    type: typeof MARK_ALL_READ
    sids: number[]
    time?: number
    before?: boolean
}

interface MarkUnreadAction {
    type: typeof MARK_UNREAD
    item: RSSItem
}

interface ToggleStarredAction {
    type: typeof TOGGLE_STARRED
    item: RSSItem
}

interface ToggleHiddenAction {
    type: typeof TOGGLE_HIDDEN
    item: RSSItem
}

export type ItemActionTypes =
    | { type: typeof CACHE_ITEMS; items: RSSItem[] }
    | FetchItemsAction
    | MarkReadAction
    | MarkAllReadAction
    | MarkUnreadAction
    | ToggleStarredAction
    | ToggleHiddenAction

// Reading navigation loads cached rows without starting a subscription update.
export function loadCachedSourceEntries(
    sid: number,
    filter: FeedFilter,
    skip = 0,
    quantity = 50
): AppThunk<Promise<RSSItem[]>> {
    return async (dispatch, getState) => {
        const available = () => {
            const state = getState()
            const source = state.sources[sid]
            return (
                source &&
                !source.hidden &&
                (!state.app.privacyMode || !source.private)
            )
        }
        if (!available()) return []
        const items = await RSSFeed.loadFeed(
            new RSSFeed(null, [sid], filter),
            skip,
            quantity
        )
        if (!available()) return []
        dispatch({ type: CACHE_ITEMS, items })
        return items
    }
}

export function fetchItemsRequest(
    fetchCount = 0,
    background = false
): ItemActionTypes {
    return {
        type: FETCH_ITEMS,
        status: ActionStatus.Request,
        fetchCount: fetchCount,
        background,
    }
}

export function fetchItemsSuccess(
    items: RSSItem[],
    itemState: ItemState,
    complete = true
): ItemActionTypes {
    return {
        type: FETCH_ITEMS,
        status: ActionStatus.Success,
        items: items,
        itemState: itemState,
        complete,
    }
}

export function fetchItemsFailure(source: RSSSource, err): ItemActionTypes {
    return {
        type: FETCH_ITEMS,
        status: ActionStatus.Failure,
        errSource: source,
        err: err,
    }
}

export function fetchItemsIntermediate(): ItemActionTypes {
    return {
        type: FETCH_ITEMS,
        status: ActionStatus.Intermediate,
    }
}

export async function insertItems(items: RSSItem[]): Promise<RSSItem[]> {
    items.sort((a, b) => a.date.getTime() - b.date.getTime())
    const rows = items.map(item =>
        db.items.createRow({ ...item, media: item.media || "{}" })
    )
    return (await db.itemsDB
        .insert()
        .into(db.items)
        .values(rows)
        .exec()) as RSSItem[]
}

export function fetchCurrentItems(): AppThunk<Promise<void>> {
    return (dispatch, getState) => {
        const state = getState()
        const feed = state.feeds[state.page.feedId]
        const sids = [...new Set(feed?.sids || [])].filter(sid => {
            const source = state.sources[sid]
            return (
                source &&
                !source.hidden &&
                (!state.app.privacyMode || !source.private)
            )
        })
        return sids.length
            ? dispatch(fetchItems(false, sids))
            : Promise.resolve()
    }
}

let fetchingCycle = false
export function fetchItems(
    background = false,
    sids: number[] = null
): AppThunk<Promise<void>> {
    return async (dispatch, getState) => {
        const initState = getState()
        if (
            !fetchingCycle &&
            !initState.app.fetchingItems &&
            !initState.app.syncing
        ) {
            fetchingCycle = true
            let nextCheckAt = 0
            const feedback = background
                ? undefined
                : createRefreshFeedback(
                      dispatch,
                      job =>
                          Object.values(getState().sources).find(
                              source => source.url === job.url
                          )?.name || job.site
                  )
            try {
                if (
                    sids === null ||
                    sids.filter(sid =>
                        Boolean(initState.sources[sid]?.serviceRef)
                    ).length > 0
                )
                    await dispatch(syncWithService(background))
                const state = getState()
                const schedule = window.settings.getFeedSchedule()
                const candidates =
                    sids === null
                        ? Object.values(state.sources)
                        : [...new Set(sids)].map(sid => state.sources[sid])
                const eligibleSources = candidates
                    .filter(source => {
                        return source && !source.serviceRef
                    })
                    .sort(
                        (a, b) =>
                            (a.lastFetched?.getTime() || 0) -
                            (b.lastFetched?.getTime() || 0)
                    )
                const jobFor = (source: RSSSource) => ({
                    url: source.url,
                    site: feedWebsite(source),
                    ...resolveSubscriptionPolicy(
                        source,
                        getState().groups,
                        getState().page.readerPreferences
                    ),
                })
                for (const source of eligibleSources) {
                    const job = jobFor(source)
                    const record = (schedule.sources[job.url] ||= {})
                    if (
                        job.strategy === "publication" &&
                        record.publishedAt === undefined
                    ) {
                        const dates = (await db.itemsDB
                            .select(db.items.date, db.items.fetchedDate)
                            .from(db.items)
                            .where(
                                lf.op.and(
                                    db.items.source.eq(source.sid),
                                    db.items.date.lte(new Date())
                                )
                            )
                            .orderBy(db.items.date, lf.Order.DESC)
                            .limit(100)
                            .exec()) as Pick<RSSItem, "date" | "fetchedDate">[]
                        // Old entries without a feed date used the fetch time as a fallback.
                        record.publishedAt =
                            dates
                                .find(
                                    item =>
                                        Math.abs(
                                            item.date.getTime() -
                                                item.fetchedDate.getTime()
                                        ) > 1000
                                )
                                ?.date.getTime() || 0
                    }
                    planFeed(job, source.lastFetched?.getTime() || 0, schedule)
                }
                await window.settings.setFeedSchedule(schedule)
                const sources = eligibleSources.filter(
                    source =>
                        !background ||
                        feedIsDue(
                            jobFor(source),
                            source.lastFetched?.getTime() || 0,
                            schedule,
                            !background
                        )
                )
                const jobs = sources.map(jobFor)
                dispatch(fetchItemsRequest(jobs.length, background))
                const results = await runFeedQueue(
                    jobs,
                    schedule,
                    state.page.readerPreferences.siteInterval,
                    async job => {
                        const source = Object.values(getState().sources).find(
                            source => source.url === job.url
                        )
                        if (!source) return []
                        const { items, metadata, publishedAt } =
                            await RSSSource.fetchItems(source)
                        const latest = getState().sources[source.sid]
                        if (latest?.url !== source.url) return []
                        const inserted = await insertItems(items)
                        const currentSource = getState().sources[source.sid]
                        if (currentSource?.url !== source.url) {
                            if (inserted.length)
                                await db.itemsDB
                                    .delete()
                                    .from(db.items)
                                    .where(
                                        db.items._id.in(
                                            inserted.map(item => item._id)
                                        )
                                    )
                                    .exec()
                            return []
                        }
                        schedule.sources[job.url].publishedAt = Math.max(
                            schedule.sources[job.url].publishedAt || 0,
                            publishedAt
                        )
                        if (latest)
                            await dispatch(
                                updateSource({
                                    ...currentSource,
                                    ...metadata,
                                    metadataVersion: 1,
                                    ...(currentSource.iconOrigin !== "manual" &&
                                    metadata.feedIcon
                                        ? {
                                              iconurl: metadata.feedIcon,
                                              iconOrigin: "auto",
                                          }
                                        : {}),
                                    lastFetched: new Date(),
                                })
                            )
                        dispatch(
                            fetchItemsSuccess(
                                inserted.reverse(),
                                getState().items,
                                false
                            )
                        )
                        if (background) {
                            for (const item of inserted)
                                if (item.notify)
                                    dispatch(pushNotification(item))
                            if (inserted.length) window.utils.requestAttention()
                        }
                        return inserted
                    },
                    value => window.settings.setFeedSchedule(value),
                    () => dispatch(fetchItemsIntermediate()),
                    undefined,
                    {
                        background,
                        blocked: feedback?.blocked,
                        cancelled: feedback?.cancelled,
                        failed: feedback?.failed,
                        siteLimit:
                            state.page.readerPreferences.backgroundSiteLimit,
                        stopped: () =>
                            getState().app.settings.display ||
                            getState().app.settings.saving ||
                            getState().app.syncing,
                        interval: () =>
                            getState().page.readerPreferences.siteInterval,
                        resolve: job => {
                            const source = Object.values(
                                getState().sources
                            ).find(source => source.url === job.url)
                            if (!source) return undefined
                            const current = jobFor(source)
                            planFeed(
                                current,
                                source.lastFetched?.getTime() || 0,
                                schedule
                            )
                            return !background ||
                                feedIsDue(
                                    current,
                                    source.lastFetched?.getTime() || 0,
                                    schedule,
                                    !background
                                )
                                ? current
                                : undefined
                        },
                        deferred: at => {
                            nextCheckAt = nextCheckAt
                                ? Math.min(nextCheckAt, at)
                                : at
                        },
                    }
                )
                results.forEach((result, i) => {
                    if (result.status === "rejected")
                        dispatch(fetchItemsFailure(sources[i], result.reason))
                })
                dispatch(fetchItemsSuccess([], getState().items))
                if (!background) dispatch(dismissItems())
            } catch (error) {
                dispatch(fetchItemsSuccess([], getState().items))
                throw error
            } finally {
                feedback?.finish()
                fetchingCycle = false
                dispatch(setupAutoFetch(background ? nextCheckAt : undefined))
            }
        }
    }
}

const markReadDone = (item: RSSItem): ItemActionTypes => ({
    type: MARK_READ,
    item: item,
})

const markUnreadDone = (item: RSSItem): ItemActionTypes => ({
    type: MARK_UNREAD,
    item: item,
})

export function markReadOnOpen(item: RSSItem): AppThunk {
    return (dispatch, getState) => {
        const state = getState()
        const source = state.sources[item.source]
        if (
            source &&
            !state.items[item._id]?.hasRead &&
            resolveSubscriptionPolicy(
                source,
                state.groups,
                state.page.readerPreferences
            ).readBehavior === "auto"
        )
            dispatch(markRead(item))
    }
}

export function markRead(item: RSSItem): AppThunk {
    return (dispatch, getState) => {
        item = getState().items[item._id]
        if (!item.hasRead) {
            db.itemsDB
                .update(db.items)
                .where(db.items._id.eq(item._id))
                .set(db.items.hasRead, true)
                .exec()
            dispatch(markReadDone(item))
            if (item.serviceRef) {
                dispatch(dispatch(getServiceHooks()).markRead?.(item))
            }
        }
    }
}

export function markAllRead(
    sids: number[] = null,
    date: Date = null,
    before = true
): AppThunk<Promise<void>> {
    return async (dispatch, getState) => {
        let state = getState()
        if (sids === null) {
            let feed = state.feeds[state.page.feedId]
            sids = feed.sids
        }
        if (state.app.privacyMode) {
            sids = sids.filter(sid => !state.sources[sid]?.private)
            if (sids.length === 0) return
        }
        const action = dispatch(getServiceHooks()).markAllRead?.(
            sids,
            date,
            before
        )
        if (action) await dispatch(action)
        const predicates: lf.Predicate[] = [
            db.items.source.in(sids),
            db.items.hasRead.eq(false),
        ]
        if (date) {
            predicates.push(
                before ? db.items.date.lte(date) : db.items.date.gte(date)
            )
        }
        const query = lf.op.and.apply(null, predicates)
        await db.itemsDB
            .update(db.items)
            .set(db.items.hasRead, true)
            .where(query)
            .exec()
        if (date) {
            dispatch({
                type: MARK_ALL_READ,
                sids: sids,
                time: date.getTime(),
                before: before,
            })
            dispatch(updateUnreadCounts())
        } else {
            dispatch({
                type: MARK_ALL_READ,
                sids: sids,
            })
        }
    }
}

export function markUnread(item: RSSItem): AppThunk {
    return (dispatch, getState) => {
        item = getState().items[item._id]
        if (item.hasRead) {
            db.itemsDB
                .update(db.items)
                .where(db.items._id.eq(item._id))
                .set(db.items.hasRead, false)
                .exec()
            dispatch(markUnreadDone(item))
            if (item.serviceRef) {
                dispatch(dispatch(getServiceHooks()).markUnread?.(item))
            }
        }
    }
}

const toggleStarredDone = (item: RSSItem): ItemActionTypes => ({
    type: TOGGLE_STARRED,
    item: item,
})

export function toggleStarred(item: RSSItem): AppThunk {
    return dispatch => {
        db.itemsDB
            .update(db.items)
            .where(db.items._id.eq(item._id))
            .set(db.items.starred, !item.starred)
            .exec()
        dispatch(toggleStarredDone(item))
        if (item.serviceRef) {
            const hooks = dispatch(getServiceHooks())
            if (item.starred) dispatch(hooks.unstar?.(item))
            else dispatch(hooks.star?.(item))
        }
    }
}

const toggleHiddenDone = (item: RSSItem): ItemActionTypes => ({
    type: TOGGLE_HIDDEN,
    item: item,
})

export function toggleHidden(item: RSSItem): AppThunk {
    return dispatch => {
        db.itemsDB
            .update(db.items)
            .where(db.items._id.eq(item._id))
            .set(db.items.hidden, !item.hidden)
            .exec()
        dispatch(toggleHiddenDone(item))
    }
}

export function itemShortcuts(item: RSSItem, e: KeyboardEvent): AppThunk {
    return dispatch => {
        if (e.metaKey) return
        switch (e.key) {
            case "m":
            case "M":
                if (item.hasRead) dispatch(markUnread(item))
                else dispatch(markRead(item))
                break
            case "b":
            case "B":
                dispatch(markReadOnOpen(item))
                window.utils.openExternal(item.link, platformCtrl(e))
                break
            case "s":
            case "S":
                dispatch(toggleStarred(item))
                break
            case "h":
            case "H":
                if (!item.hidden) dispatch(markReadOnOpen(item))
                dispatch(toggleHidden(item))
                break
        }
    }
}

export function applyItemReduction(item: RSSItem, type: string) {
    let nextItem = { ...item }
    switch (type) {
        case MARK_READ:
        case MARK_UNREAD: {
            nextItem.hasRead = type === MARK_READ
            break
        }
        case TOGGLE_STARRED: {
            nextItem.starred = !item.starred
            break
        }
        case TOGGLE_HIDDEN: {
            nextItem.hidden = !item.hidden
            break
        }
    }
    return nextItem
}

export function itemReducer(
    state: ItemState = {},
    action:
        | ItemActionTypes
        | FeedActionTypes
        | ServiceActionTypes
        | SettingsActionTypes
): ItemState {
    switch (action.type) {
        case CACHE_ITEMS:
            return {
                ...Object.fromEntries(
                    action.items.map(item => [item._id, item])
                ),
                ...state,
            }
        case FETCH_ITEMS:
            switch (action.status) {
                case ActionStatus.Success: {
                    let newMap = {}
                    for (let i of action.items) {
                        newMap[i._id] = i
                    }
                    return { ...newMap, ...state }
                }
                default:
                    return state
            }
        case MARK_UNREAD:
        case MARK_READ:
        case TOGGLE_STARRED:
        case TOGGLE_HIDDEN: {
            return {
                ...state,
                [action.item._id]: applyItemReduction(
                    state[action.item._id],
                    action.type
                ),
            }
        }
        case MARK_ALL_READ: {
            let nextState = { ...state }
            let sids = new Set(action.sids)
            for (let item of Object.values(state)) {
                if (sids.has(item.source) && !item.hasRead) {
                    if (
                        !action.time ||
                        (action.before
                            ? item.date.getTime() <= action.time
                            : item.date.getTime() >= action.time)
                    ) {
                        nextState[item._id] = {
                            ...item,
                            hasRead: true,
                        }
                    }
                }
            }
            return nextState
        }
        case LOAD_MORE:
        case INIT_FEED: {
            switch (action.status) {
                case ActionStatus.Success: {
                    let nextState = { ...state }
                    for (let i of action.items) {
                        nextState[i._id] = i
                    }
                    return nextState
                }
                default:
                    return state
            }
        }
        case SYNC_LOCAL_ITEMS: {
            let nextState = { ...state }
            for (let item of Object.values(state)) {
                if (item.hasOwnProperty("serviceRef")) {
                    const nextItem = { ...item }
                    nextItem.hasRead = !action.unreadIds.has(item.serviceRef)
                    nextItem.starred = action.starredIds.has(item.serviceRef)
                    nextState[item._id] = nextItem
                }
            }
            return nextState
        }
        case FREE_MEMORY: {
            const nextState: ItemState = {}
            for (let item of Object.values(state)) {
                if (action.iids.has(item._id)) nextState[item._id] = item
            }
            return nextState
        }
        default:
            return state
    }
}
