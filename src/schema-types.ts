export class SourceGroup {
    isMultiple: boolean
    sids: number[]
    name?: string
    expanded?: boolean
    index?: number // available only from menu or groups tab container
    policy?: SubscriptionPolicy

    constructor(sids: number[], name: string = null) {
        name = (name && name.trim()) || "Source group"
        if (sids.length == 1) {
            this.isMultiple = false
        } else {
            this.isMultiple = true
            this.name = name
            this.expanded = true
        }
        this.sids = sids
    }
}

export const enum ViewType {
    Cards,
    List,
    Magazine,
    Compact,
    Customized,
}

export const enum SourceCategory {
    Articles = "articles",
    Social = "social",
    Pictures = "pictures",
    Videos = "videos",
}

export type ContentView = "all" | SourceCategory

export interface MediaLayout {
    columns: number
    imageOnly: boolean
}

export type ReadBehavior = "auto" | "manual"
export interface SubscriptionPolicy {
    readBehavior?: ReadBehavior
    frequency?: number // minutes; absent means inherit, zero means manual only
}
export interface ReaderPreferences {
    startupFetch: boolean
    readBehavior: ReadBehavior
    readingMode: "overlay" | "inline"
    frequency: number
    siteInterval: number // seconds between requests to the same website
    domainPolicies: Record<string, SubscriptionPolicy>
}
export const defaultReaderPreferences: ReaderPreferences = {
    startupFetch: true,
    readBehavior: "auto",
    readingMode: "overlay",
    frequency: 60,
    siteInterval: 10,
    domainPolicies: {},
}
export interface FeedScheduleState {
    sources: Record<
        string,
        {
            nextDue?: number
            frequency?: number
            retryAt?: number
            failures?: number
            lastAttempt?: number
        }
    >
    sites: Record<
        string,
        { nextAllowed?: number; retryAt?: number; failures?: number }
    >
}

export interface SubscribeLinkRequest {
    url: string
    view: SourceCategory
}

export const LOCAL_API_PORT = 39124

export interface LocalApiStatus {
    enabled: boolean
    running: boolean
    port: number
    error: string | null
}

export interface SubscriptionCheckResult {
    subscribed: boolean
    view?: SourceCategory
}

export interface SubscriptionCheckReply {
    ready: boolean
    results?: SubscriptionCheckResult[]
}

export const enum ViewConfigs {
    ShowCover = 1 << 0,
    ShowSnippet = 1 << 1,
    FadeRead = 1 << 2,
}

export const enum ThemeSettings {
    Default = "system",
    Light = "light",
    Dark = "dark",
}

export const enum SearchEngines {
    Google,
    Bing,
    Baidu,
    DuckDuckGo,
}

export const enum ImageCallbackTypes {
    OpenExternal,
    OpenExternalBg,
    SaveAs,
    Copy,
    CopyLink,
}

export const enum SyncService {
    None,
    Fever,
    Feedbin,
    GReader,
    Inoreader,
    Miniflux,
    Nextcloud,
}
export interface ServiceConfigs {
    type: SyncService
    importGroups?: boolean
}

export const enum WindowStateListenerType {
    Maximized,
    Focused,
    Fullscreen,
}

export interface TouchBarTexts {
    menu: string
    search: string
    refresh: string
    markAll: string
    notifications: string
}

export type SchemaTypes = {
    version: string
    theme: ThemeSettings
    pac: string
    pacOn: boolean
    view: ViewType
    locale: string
    sourceGroups: SourceGroup[]
    fontSize: number
    fontFamily: string
    menuOn: boolean
    fetchInterval: number
    searchEngine: SearchEngines
    serviceConfigs: ServiceConfigs
    filterType: number
    listViewConfigs: ViewConfigs
    useNeDB: boolean
    privacyMode: boolean
    mediaLayouts: Partial<Record<SourceCategory, MediaLayout>>
    readerPreferences: ReaderPreferences
    feedSchedule: FeedScheduleState
}
