import * as React from "react"
import intl from "react-intl-universal"
import { SubscriptionPolicy } from "../../schema-types"
import { SubscriptionPolicyFields } from "../utils/subscription-policy-fields"
import ContentFilterFields from "../utils/content-filter-fields"

export default function GroupPolicySettings({
    value,
    onChange,
    disabled,
    sids,
    name,
}: {
    value: SubscriptionPolicy
    onChange: (policy: SubscriptionPolicy) => void
    disabled: boolean
    sids: number[]
    name: string
}) {
    return (
        <div data-group-policy>
            <SubscriptionPolicyFields
                id="group-policy"
                value={value}
                onChange={onChange}
                disabled={disabled}
            />
            <p className="settings-hint">{intl.get("policy.groupHint")}</p>
            <ContentFilterFields
                id="group-content-filter"
                groupName={name}
                sids={sids}
                value={value.contentFilter}
                disabled={disabled}
                onChange={contentFilter =>
                    onChange({ ...value, contentFilter })
                }
            />
        </div>
    )
}
