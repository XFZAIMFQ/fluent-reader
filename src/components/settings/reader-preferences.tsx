import * as React from "react"
import intl from "react-intl-universal"
import { Toggle, Dropdown, SpinButton } from "@fluentui/react"
import { useAppDispatch, useAppSelector } from "../../scripts/reducer"
import { setReaderPreferences } from "../../scripts/models/page"
import { ReaderPreferences } from "../../schema-types"
import { SubscriptionPolicyFields } from "../utils/subscription-policy-fields"

export default function ReaderPreferenceSettings() {
    const dispatch = useAppDispatch()
    const value = useAppSelector(state => state.page.readerPreferences)
    const [error, setError] = React.useState("")
    const change = async (patch: Partial<ReaderPreferences>) => {
        setError("")
        try {
            await dispatch(setReaderPreferences(patch))
        } catch (error) {
            setError(String(error))
        }
    }
    return (
        <>
            <div className="modern-setting-row">
                <div className="modern-setting-copy">
                    <strong>{intl.get("policy.startup")}</strong>
                    <p>{intl.get("policy.startupHint")}</p>
                </div>
                <Toggle
                    checked={value.startupFetch}
                    onChange={(_, checked) =>
                        void change({ startupFetch: Boolean(checked) })
                    }
                />
            </div>
            <div className="modern-setting-row">
                <div className="modern-setting-copy">
                    <strong>{intl.get("policy.siteInterval")}</strong>
                    <p>{intl.get("policy.queueHint")}</p>
                </div>
                <SpinButton
                    ariaLabel={intl.get("policy.siteInterval")}
                    value={String(value.siteInterval)}
                    min={1}
                    max={3600}
                    onValidate={text => {
                        const n = Number(text)
                        if (Number.isFinite(n) && n >= 1 && n <= 3600) {
                            void change({ siteInterval: n })
                            return String(n)
                        }
                        return String(value.siteInterval)
                    }}
                    onIncrement={() => {
                        void change({
                            siteInterval: Math.min(
                                3600,
                                value.siteInterval + 1
                            ),
                        })
                        return String(Math.min(3600, value.siteInterval + 1))
                    }}
                    onDecrement={() => {
                        void change({
                            siteInterval: Math.max(1, value.siteInterval - 1),
                        })
                        return String(Math.max(1, value.siteInterval - 1))
                    }}
                />
            </div>
            <div className="modern-setting-row">
                <div className="modern-setting-copy">
                    <strong>{intl.get("policy.backgroundLimit")}</strong>
                    <p>{intl.get("policy.backgroundLimitHint")}</p>
                </div>
                <SpinButton
                    ariaLabel={intl.get("policy.backgroundLimit")}
                    value={String(value.backgroundSiteLimit)}
                    min={1}
                    max={1000}
                    onValidate={text => {
                        const n = Number(text)
                        if (Number.isInteger(n) && n >= 1 && n <= 1000) {
                            void change({ backgroundSiteLimit: n })
                            return String(n)
                        }
                        return String(value.backgroundSiteLimit)
                    }}
                    onIncrement={() => {
                        const n = Math.min(1000, value.backgroundSiteLimit + 1)
                        void change({ backgroundSiteLimit: n })
                        return String(n)
                    }}
                    onDecrement={() => {
                        const n = Math.max(1, value.backgroundSiteLimit - 1)
                        void change({ backgroundSiteLimit: n })
                        return String(n)
                    }}
                />
            </div>
            <div className="modern-setting-row">
                <div className="modern-setting-copy">
                    <strong>{intl.get("policy.defaults")}</strong>
                    <p>{intl.get("policy.priorityHint")}</p>
                </div>
                <SubscriptionPolicyFields
                    id="reader-default"
                    inherited={false}
                    value={{
                        readBehavior: value.readBehavior,
                        frequency: value.frequency,
                        strategy: value.strategy,
                    }}
                    onChange={policy =>
                        void change({
                            readBehavior: policy.readBehavior,
                            frequency: policy.frequency,
                            strategy: policy.strategy,
                        })
                    }
                />
            </div>
            <div className="modern-setting-row">
                <div className="modern-setting-copy">
                    <strong>{intl.get("policy.readingMode")}</strong>
                    <p>{intl.get("policy.readingModeHint")}</p>
                </div>
                <Dropdown
                    selectedKey={value.readingMode}
                    options={[
                        { key: "overlay", text: intl.get("policy.overlay") },
                        { key: "inline", text: intl.get("policy.inline") },
                    ]}
                    onChange={(_, option) =>
                        void change({
                            readingMode: option.key as "inline" | "overlay",
                        })
                    }
                />
            </div>
            {!!error && <p role="alert">{error}</p>}
        </>
    )
}
