import { FeedScheduleState } from "../schema-types"

export interface FeedJob {
    url: string
    site: string
    frequency: number
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
    timing: Clock = clock
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
                const job = jobs[i]
                const record = (schedule.sources[job.url] ||= {})
                if (
                    (website.retryAt || 0) > timing.now() ||
                    (record.retryAt || 0) > timing.now()
                ) {
                    results[i] = { status: "fulfilled", value: undefined }
                    settled()
                    continue
                }
                const wait = (website.nextAllowed || 0) - timing.now()
                if (wait > 0) await timing.sleep(wait)
                await acquire()
                try {
                    record.lastAttempt = timing.now()
                    record.retryAt = timing.now() + 60000
                    await persist()
                    const value = await fetch(job)
                    record.failures = 0
                    record.retryAt = 0
                    record.frequency = job.frequency
                    record.nextDue =
                        timing.now() +
                        job.frequency * 60000 * (1 + timing.random() * 0.1)
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
                        interval * 1000 * (1 + timing.random() * 0.2)
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
    return results
}
