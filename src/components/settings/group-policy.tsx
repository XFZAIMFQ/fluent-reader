import * as React from "react"
import intl from "react-intl-universal"
import { SubscriptionPolicy } from "../../schema-types"
import { SubscriptionPolicyFields } from "../utils/subscription-policy-fields"

export default function GroupPolicySettings({
    value,
    onChange,
    disabled,
}: {
    value: SubscriptionPolicy
    onChange: (policy: SubscriptionPolicy) => void
    disabled: boolean
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
        </div>
    )
}
