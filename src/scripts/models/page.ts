import {
    ALL,
    SOURCE,
    loadMore,
    FeedFilter,
    FilterType,
    initFeeds,
    FeedActionTypes,
    INIT_FEED,
} from "./feed"
import intl from "react-intl-universal"
import { getWindowBreakpoint, AppThunk, ActionStatus } from "../utils"
import { RSSItem, markRead } from "./item"
import { SourceActionTypes, DELETE_SOURCE } from "./source"
import { toggleMenu } from "./app"
import { sidebarGroups } from "../sidebar-groups"
import {
    ViewType,
    ViewConfigs,
    ContentView,
    SourceCategory,
    MediaLayout,
} from "../../schema-types"

export const SELECT_PAGE = "SELECT_PAGE"
export const SWITCH_VIEW = "SWITCH_VIEW"
export const SET_VIEW_CONFIGS = "SET_VIEW_CONFIGS"
export const SHOW_ITEM = "SHOW_ITEM"
export const SHOW_OFFSET_ITEM = "SHOW_OFFSET_ITEM"
export const DISMISS_ITEM = "DISMISS_ITEM"
export const APPLY_FILTER = "APPLY_FILTER"
export const TOGGLE_SEARCH = "TOGGLE_SEARCH"
export const SWITCH_CONTENT_VIEW = "SWITCH_CONTENT_VIEW"
const SET_COLLECTION = "SET_COLLECTION"
const SET_MEDIA_LAYOUT = "SET_MEDIA_LAYOUT"

export enum PageType {
    AllArticles,
    Sources,
    Page,
}

interface SelectPageAction {
    type: typeof SELECT_PAGE
    pageType: PageType
    init: boolean
    keepMenu: boolean
    filter: FeedFilter
    sids?: number[]
    menuKey?: string
    title?: string
}

interface SwitchViewAction {
    type: typeof SWITCH_VIEW
    viewType: ViewType
}

interface SwitchContentViewAction {
    type: typeof SWITCH_CONTENT_VIEW
    contentView: ContentView
}

interface SetViewConfigsAction {
    type: typeof SET_VIEW_CONFIGS
    configs: ViewConfigs
}

interface ShowItemAction {
    type: typeof SHOW_ITEM
    feedId: string
    item: RSSItem
}

interface ApplyFilterAction {
    type: typeof APPLY_FILTER
    filter: FeedFilter
}

interface DismissItemAction {
    type: typeof DISMISS_ITEM
}
interface ToggleSearchAction {
    type: typeof TOGGLE_SEARCH
}

export type PageActionTypes =
    | {
          type: typeof SET_MEDIA_LAYOUT
          view: SourceCategory
          layout: MediaLayout
      }
    | {
          type: typeof SET_COLLECTION
          active: boolean
          previousFilter?: FeedFilter
      }
    | SelectPageAction
    | SwitchViewAction
    | SwitchContentViewAction
    | ShowItemAction
    | DismissItemAction
    | ApplyFilterAction
    | ToggleSearchAction
    | SetViewConfigsAction

export function selectAllArticles(init = false): AppThunk {
    return (dispatch, getState) => {
        dispatch(leaveCollection())
        dispatch({
            type: SELECT_PAGE,
            keepMenu: getWindowBreakpoint(),
            filter: getState().page.filter,
            pageType: PageType.AllArticles,
            init: init,
        } as PageActionTypes)
    }
}

export function selectSources(
    sids: number[],
    menuKey: string,
    title: string,
    force = false
): AppThunk {
    return (dispatch, getState) => {
        if (!menuKey.startsWith("starred-")) dispatch(leaveCollection())
        if (force || getState().app.menuKey !== menuKey) {
            dispatch({
                type: SELECT_PAGE,
                pageType: PageType.Sources,
                keepMenu: getWindowBreakpoint(),
                filter: getState().page.filter,
                sids: sids,
                menuKey: menuKey,
                title: title,
                init: true,
            } as PageActionTypes)
        }
    }
}

function leaveCollection(): AppThunk {
    return (dispatch, getState) => {
        if (!getState().page.collection) return
        const filter = getState().page.previousFilter
        dispatch({ type: SET_COLLECTION, active: false })
        dispatch(applyFilterDone(filter))
        // ALL may have retained a filter from before entering a collection.
        dispatch(selectAllArticles(true))
    }
}

export function selectCollection(view: ContentView): AppThunk {
    return (dispatch, getState) => {
        const state = getState()
        const previousFilter = state.page.collection
            ? state.page.previousFilter
            : state.page.filter
        dispatch({ type: SET_COLLECTION, active: true, previousFilter })
        dispatch(
            applyFilterDone({
                ...state.page.filter,
                type:
                    FilterType.StarredOnly |
                    (state.page.filter.type & FilterType.Toggles),
                search: "",
            })
        )
        dispatch(switchContentView(view))
        const sids = Object.values(state.sources)
            .filter(
                source =>
                    !source.hidden &&
                    (!state.app.privacyMode || !source.private) &&
                    (view === "all" ||
                        (source.category || SourceCategory.Articles) === view)
            )
            .map(source => source.sid)
        dispatch(
            selectSources(
                sids,
                `starred-${view}`,
                intl.get("subscriptions.starred"),
                true
            )
        )
    }
}

export function refreshSourceSelection(): AppThunk {
    return (dispatch, getState) => {
        const state = getState()
        const key = state.app.menuKey
        const visible = (sid: number) => {
            const source = state.sources[sid]
            return (
                source &&
                !source.hidden &&
                (!state.app.privacyMode || !source.private) &&
                (state.page.contentView === "all" ||
                    (source.category || SourceCategory.Articles) ===
                        state.page.contentView)
            )
        }
        if (key.startsWith("starred-")) {
            dispatch(selectCollection(state.page.contentView))
        } else if (key.startsWith("auto-")) {
            const visibleSources = Object.values(state.sources).filter(source =>
                visible(source.sid)
            )
            const folder = sidebarGroups(
                state.groups,
                visibleSources
            ).folders.find(group => group.key === key)
            if (folder)
                dispatch(selectSources(folder.sids, key, folder.name, true))
            else if (state.page.contentView === "all")
                dispatch(selectAllArticles(true))
            else
                dispatch(
                    selectSources(
                        visibleSources.map(source => source.sid),
                        `category-${state.page.contentView}`,
                        intl.get(`contentView.${state.page.contentView}`),
                        true
                    )
                )
        } else if (key.startsWith("s-")) {
            const sid = Number(key.slice(2))
            const source = state.sources[sid]
            if (
                !source ||
                source.hidden ||
                (state.app.privacyMode && source.private)
            ) {
                dispatch(selectAllArticles(true))
            } else {
                dispatch(
                    switchContentView(
                        source.category || SourceCategory.Articles
                    )
                )
                dispatch(selectSources([sid], key, source.name, true))
            }
        } else if (key.startsWith("category-")) {
            const category = key.slice(9) as SourceCategory
            dispatch(
                selectSources(
                    Object.values(state.sources)
                        .filter(
                            source =>
                                !source.hidden &&
                                (!state.app.privacyMode || !source.private) &&
                                (source.category || SourceCategory.Articles) ===
                                    category
                        )
                        .map(source => source.sid),
                    key,
                    intl.get(`contentView.${category}`),
                    true
                )
            )
        } else if (key.startsWith("folder-") || key.startsWith("g-")) {
            const group = key.startsWith("folder-")
                ? sidebarGroups(
                      state.groups,
                      Object.values(state.sources).filter(source =>
                          visible(source.sid)
                      )
                  ).folders.find(folder => folder.key === key)
                : state.groups[Number(key.slice(2))]
            if (group) {
                dispatch(
                    selectSources(
                        group.sids.filter(visible),
                        key,
                        group.name,
                        true
                    )
                )
            } else {
                dispatch(selectAllArticles(true))
            }
        } else {
            dispatch(selectAllArticles(true))
        }
    }
}

export function switchView(viewType: ViewType): AppThunk {
    return dispatch => {
        globalThis.settings.setDefaultView(viewType)
        dispatch({
            type: SWITCH_VIEW,
            viewType: viewType,
        })
    }
}

export const switchContentView = (
    contentView: ContentView
): PageActionTypes => ({
    type: SWITCH_CONTENT_VIEW,
    contentView,
})

export function setViewConfigs(configs: ViewConfigs): AppThunk {
    return (dispatch, getState) => {
        globalThis.settings.setViewConfigs(getState().page.viewType, configs)
        dispatch({
            type: "SET_VIEW_CONFIGS",
            configs: configs,
        })
    }
}

export function setMediaLayout(
    view: SourceCategory,
    layout: MediaLayout
): AppThunk<Promise<void>> {
    return async dispatch => {
        await globalThis.settings.setMediaLayout(view, layout)
        dispatch({ type: SET_MEDIA_LAYOUT, view, layout })
    }
}

export function showItem(feedId: string, item: RSSItem): AppThunk {
    return (dispatch, getState) => {
        const state = getState()
        if (
            state.items.hasOwnProperty(item._id) &&
            state.sources.hasOwnProperty(item.source) &&
            (!state.app.privacyMode || !state.sources[item.source].private)
        ) {
            dispatch({
                type: SHOW_ITEM,
                feedId: feedId,
                item: item,
            })
        }
    }
}
export function showItemFromId(iid: number): AppThunk {
    return (dispatch, getState) => {
        const state = getState()
        const item = state.items[iid]
        if (
            !item ||
            (state.app.privacyMode && state.sources[item.source]?.private)
        )
            return
        if (!item.hasRead) dispatch(markRead(item))
        if (item) dispatch(showItem(null, item))
    }
}

export const dismissItem = (): PageActionTypes => ({ type: DISMISS_ITEM })

export const toggleSearch = (): AppThunk => {
    return (dispatch, getState) => {
        let state = getState()
        dispatch({ type: TOGGLE_SEARCH })
        if (!getWindowBreakpoint() && state.app.menu) {
            dispatch(toggleMenu())
        }
        if (state.page.searchOn) {
            dispatch(
                applyFilter({
                    ...state.page.filter,
                    search: "",
                })
            )
        }
    }
}

export function showOffsetItem(offset: number): AppThunk {
    return (dispatch, getState) => {
        let state = getState()
        if (!state.page.itemFromFeed) return
        let [itemId, feedId] = [state.page.itemId, state.page.feedId]
        let feed = state.feeds[feedId]
        let iids = feed.iids.filter(
            iid =>
                !state.app.privacyMode ||
                !state.sources[state.items[iid]?.source]?.private
        )
        let itemIndex = iids.indexOf(itemId)
        let newIndex = itemIndex + offset
        if (itemIndex < 0) {
            let item = state.items[itemId]
            let prevs = iids
                .map(
                    (id, index) => [state.items[id], index] as [RSSItem, number]
                )
                .filter(([i, _]) => i.date > item.date)
            if (prevs.length > 0) {
                let prev = prevs[0]
                for (let j = 1; j < prevs.length; j += 1) {
                    if (prevs[j][0].date < prev[0].date) prev = prevs[j]
                }
                newIndex = prev[1] + offset + (offset < 0 ? 1 : 0)
            } else {
                newIndex = offset - 1
            }
        }
        if (newIndex >= 0) {
            if (newIndex < iids.length) {
                let item = state.items[iids[newIndex]]
                dispatch(markRead(item))
                dispatch(showItem(feedId, item))
                return
            } else if (!feed.allLoaded) {
                dispatch(loadMore(feed))
                    .then(() => {
                        dispatch(showOffsetItem(offset))
                    })
                    .catch(() => dispatch(dismissItem()))
                return
            }
        }
        dispatch(dismissItem())
    }
}

const applyFilterDone = (filter: FeedFilter): PageActionTypes => ({
    type: APPLY_FILTER,
    filter: filter,
})

function applyFilter(filter: FeedFilter): AppThunk {
    return (dispatch, getState) => {
        const oldFilterType = getState().page.filter.type
        if (filter.type !== oldFilterType && !getState().page.collection)
            globalThis.settings.setFilterType(filter.type)
        dispatch(applyFilterDone(filter))
        dispatch(initFeeds(true))
    }
}

export function switchFilter(filter: FilterType): AppThunk {
    return (dispatch, getState) => {
        let oldFilter = getState().page.filter
        let oldType = oldFilter.type
        let newType = filter | (oldType & FilterType.Toggles)
        if (getState().page.collection) newType &= ~FilterType.ShowNotStarred
        if (oldType != newType) {
            dispatch(
                applyFilter({
                    ...oldFilter,
                    type: newType,
                })
            )
        }
    }
}

export function toggleFilter(filter: FilterType): AppThunk {
    return (dispatch, getState) => {
        let nextFilter = { ...getState().page.filter }
        nextFilter.type ^= filter
        dispatch(applyFilter(nextFilter))
    }
}

export function performSearch(query: string): AppThunk {
    return (dispatch, getState) => {
        let state = getState()
        if (state.page.searchOn) {
            dispatch(
                applyFilter({
                    ...state.page.filter,
                    search: query,
                })
            )
        }
    }
}

export class PageState {
    mediaLayouts = {
        [SourceCategory.Pictures]: globalThis.settings.getMediaLayout(
            SourceCategory.Pictures
        ),
        [SourceCategory.Videos]: globalThis.settings.getMediaLayout(
            SourceCategory.Videos
        ),
    }
    collection = false
    previousFilter: FeedFilter = null
    contentView: ContentView = "all"
    viewType = globalThis.settings.getDefaultView()
    viewConfigs = globalThis.settings.getViewConfigs(
        globalThis.settings.getDefaultView()
    )
    filter = new FeedFilter()
    feedId = ALL
    itemId = null as number
    itemFromFeed = true
    searchOn = false
}

export function pageReducer(
    state = new PageState(),
    action: PageActionTypes | SourceActionTypes | FeedActionTypes
): PageState {
    switch (action.type) {
        case SET_MEDIA_LAYOUT:
            return {
                ...state,
                mediaLayouts: {
                    ...state.mediaLayouts,
                    [action.view]: action.layout,
                },
            }
        case SET_COLLECTION:
            return {
                ...state,
                collection: action.active,
                previousFilter: action.active ? action.previousFilter : null,
            }
        case SWITCH_CONTENT_VIEW:
            return { ...state, contentView: action.contentView, itemId: null }
        case SELECT_PAGE:
            switch (action.pageType) {
                case PageType.AllArticles:
                    return {
                        ...state,
                        feedId: ALL,
                        itemId: null,
                    }
                case PageType.Sources:
                    return {
                        ...state,
                        feedId: SOURCE,
                        itemId: null,
                    }
                default:
                    return state
            }
        case SWITCH_VIEW:
            return {
                ...state,
                viewType: action.viewType,
                viewConfigs: globalThis.settings.getViewConfigs(
                    action.viewType
                ),
                itemId: null,
            }
        case SET_VIEW_CONFIGS:
            return {
                ...state,
                viewConfigs: action.configs,
            }
        case APPLY_FILTER:
            return {
                ...state,
                filter: action.filter,
            }
        case SHOW_ITEM:
            return {
                ...state,
                itemId: action.item._id,
                itemFromFeed: Boolean(action.feedId),
            }
        case INIT_FEED:
            switch (action.status) {
                case ActionStatus.Success:
                    return {
                        ...state,
                        itemId:
                            action.feed._id === state.feedId &&
                            action.items.filter(i => i._id === state.itemId)
                                .length === 0
                                ? null
                                : state.itemId,
                    }
                default:
                    return state
            }
        case DELETE_SOURCE:
        case DISMISS_ITEM:
            return {
                ...state,
                itemId: null,
            }
        case TOGGLE_SEARCH:
            return {
                ...state,
                searchOn: !state.searchOn,
            }
        default:
            return state
    }
}
