import { FeedScheduleState, UpdateStrategy } from "../schema-types"

export interface FeedJob {
    url: string
    site: string
    frequency: number
    strategy?: UpdateStrategy
}
export interface FeedFailure {
    status?: number
    retryAt?: number
    challenge?: boolean
}
type Clock = {
    now: () => number
    random: () => number
    sleep: (ms: number) => Promise<void>
}
const clock: Clock = {
    now: Date.now,
    random: Math.random,
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
}

const HOUR = 3600000
type SourceSchedule = FeedScheduleState["sources"][string]

export function latestPublicationDate(
    items: { isoDate?: string; pubDate?: string }[],
    now = Date.now()
): number {
    let latest = 0
    for (const item of items) {
        const date = new Date(item.isoDate || item.pubDate || "").getTime()
        if (Number.isFinite(date) && date > latest && date <= now) latest = date
    }
    return latest
}

function stableSpread(url: string) {
    let hash = 2166136261
    for (const character of url)
        hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
    hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d)
    hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b)
    hash ^= hash >>> 16
    return (hash >>> 0) / 4294967296
}

function nextFeedTime(job: FeedJob, record: SourceSchedule, after: number) {
    const period = job.frequency * 60000
    if (!period) return 0
    const offset = period * record.spread
    if (job.strategy === "publication" && record.publishedAt > 0) {
        let next = record.publishedAt + period + offset
        if (next <= after)
            next += (Math.floor((after - next) / period) + 1) * period
        return next
    }
    return after + period + offset
}

// Keep expired plans expired; recomputing them on every launch would starve feeds.
export function planFeed(
    job: FeedJob,
    lastFetched: number,
    schedule: FeedScheduleState,
    now = Date.now()
) {
    const record = (schedule.sources[job.url] ||= {})
    record.spread ??= stableSpread(job.url)
    const strategy = job.strategy || "interval"
    if (
        record.planVersion !== 1 ||
        record.frequency !== job.frequency ||
        record.strategy !== strategy
    ) {
        record.frequency = job.frequency
        record.strategy = strategy
        record.planVersion = 1
        const fetched = Math.min(lastFetched, now)
        record.nextDue = !fetched
            ? 0
            : nextFeedTime(
                  job,
                  record,
                  strategy === "publication" && record.publishedAt > 0
                      ? Math.max(now, fetched + job.frequency * 60000 - 1)
                      : fetched
              )
    }
    return record
}

export function backgroundEligibleAt(
    schedule: FeedScheduleState,
    site: string,
    limit: number,
    now = Date.now()
) {
    const website = schedule.sites[site]
    if (!website) return 0
    const attempts = (website.attempts || []).filter(time => time > now - HOUR)
    return Math.max(
        website.backgroundNextAllowed || 0,
        attempts.length >= limit ? attempts[attempts.length - limit] + HOUR : 0
    )
}

export interface QueueOptions {
    background?: boolean
    siteLimit?: number
    stopped?: () => boolean
    resolve?: (job: FeedJob) => FeedJob | undefined
    deferred?: (at: number) => void
    interval?: () => number
}

export function feedIsDue(
    job: FeedJob,
    lastFetched: number,
    schedule: FeedScheduleState,
    manual = false,
    now = Date.now()
) {
    if (
        (schedule.sources[job.url]?.retryAt || 0) > now ||
        (schedule.sites[job.site]?.retryAt || 0) > now
    )
        return false
    if (manual) return true
    if (!job.frequency) return false
    const record = schedule.sources[job.url]
    const due =
        record?.frequency === job.frequency && record.nextDue !== undefined
            ? record.nextDue
            : lastFetched + job.frequency * 60000
    return lastFetched > now || due <= now
}

// Each website has a serial queue. Waiting websites do not occupy global slots.
export async function runFeedQueue<T>(
    jobs: FeedJob[],
    schedule: FeedScheduleState,
    interval: number,
    fetch: (job: FeedJob) => Promise<T>,
    save: (state: FeedScheduleState) => Promise<void>,
    settled: () => void,
    timing: Clock = clock,
    options: QueueOptions = {}
): Promise<PromiseSettledResult<T>[]> {
    const queues = new Map<string, number[]>()
    jobs.forEach((job, i) =>
        queues.set(job.site, [...(queues.get(job.site) || []), i])
    )
    let active = 0
    const waiting: (() => void)[] = []
    let saving = Promise.resolve()
    const persist = () => {
        const snapshot = JSON.parse(
            JSON.stringify(schedule)
        ) as FeedScheduleState
        saving = saving.then(() => save(snapshot))
        return saving
    }
    const acquire = async () => {
        if (active >= 3)
            await new Promise<void>(resolve => waiting.push(resolve))
        else active++
    }
    const release = () => {
        const next = waiting.shift()
        if (next) next()
        else active--
    }
    const results: PromiseSettledResult<T>[] = new Array(jobs.length)
    const queuesResult = await Promise.allSettled(
        [...queues].map(async ([site, indices]) => {
            const website = (schedule.sites[site] ||= {})
            for (const i of indices) {
                const skip = () => {
                    results[i] = { status: "fulfilled", value: undefined }
                    settled()
                }
                if (options.background && options.stopped?.()) {
                    options.deferred?.(timing.now() + 1000)
                    skip()
                    continue
                }
                let job = options.resolve ? options.resolve(jobs[i]) : jobs[i]
                if (!job) {
                    skip()
                    continue
                }
                const record = (schedule.sources[job.url] ||= {})
                if (
                    (website.retryAt || 0) > timing.now() ||
                    (record.retryAt || 0) > timing.now()
                ) {
                    skip()
                    continue
                }
                const eligible = options.background
                    ? backgroundEligibleAt(
                          schedule,
                          site,
                          options.siteLimit || 4,
                          timing.now()
                      )
                    : 0
                if (eligible > timing.now()) {
                    options.deferred?.(eligible)
                    skip()
                    continue
                }
                const wait = (website.nextAllowed || 0) - timing.now()
                // Check settings between short sleeps so a long configured gap can pause promptly.
                let remaining = wait
                while (
                    remaining > 0 &&
                    !(options.background && options.stopped?.())
                ) {
                    await timing.sleep(Math.min(remaining, 250))
                    remaining = (website.nextAllowed || 0) - timing.now()
                }
                await acquire()
                if (options.background && options.stopped?.()) {
                    release()
                    options.deferred?.(timing.now() + 1000)
                    skip()
                    continue
                }
                job = options.resolve ? options.resolve(job) : job
                if (!job) {
                    release()
                    skip()
                    continue
                }
                try {
                    record.lastAttempt = timing.now()
                    record.retryAt = timing.now() + 60000
                    record.spread ??= stableSpread(job.url)
                    website.attempts = [
                        ...(website.attempts || []).filter(
                            time => time > timing.now() - HOUR
                        ),
                        timing.now(),
                    ]
                    if (options.background)
                        website.backgroundNextAllowed =
                            timing.now() + HOUR / (options.siteLimit || 4)
                    await persist()
                    const value = await fetch(job)
                    record.failures = 0
                    record.retryAt = 0
                    record.frequency = job.frequency
                    record.strategy = job.strategy || "interval"
                    record.planVersion = 1
                    record.nextDue = nextFeedTime(
                        job,
                        record,
                        job.strategy === "publication" && record.publishedAt > 0
                            ? timing.now() + job.frequency * 60000 - 1
                            : timing.now()
                    )
                    website.failures = 0
                    website.retryAt = 0
                    results[i] = { status: "fulfilled", value }
                } catch (error) {
                    const failure = error as FeedFailure
                    record.failures = (record.failures || 0) + 1
                    website.failures = (website.failures || 0) + 1
                    const retry = Math.min(
                        86400000,
                        300000 * 2 ** Math.min(record.failures - 1, 8)
                    )
                    record.retryAt = Math.max(
                        timing.now() + retry,
                        failure.retryAt || 0
                    )
                    if (
                        failure.challenge ||
                        failure.status === 403 ||
                        failure.status === 429 ||
                        website.failures >= 3
                    )
                        website.retryAt = Math.max(
                            timing.now() + 1800000,
                            record.retryAt
                        )
                    results[i] = { status: "rejected", reason: error }
                } finally {
                    website.nextAllowed =
                        timing.now() +
                        (options.interval?.() ?? interval) *
                            1000 *
                            (1 + timing.random() * 0.2)
                    try {
                        await persist()
                    } finally {
                        release()
                        settled()
                    }
                }
            }
        })
    )
    const failed = queuesResult.find(result => result.status === "rejected")
    if (failed?.status === "rejected") throw failed.reason
    await persist()
    return results
}
