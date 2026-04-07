# DNS Records for aima.chat

Domain: `aima.chat`
DNS Provider: AWS Route 53
Date: 2026-04-02

---

## 1. Vercel (Web Hosting — dotco.aima.chat)

| Type  | Name   | Value          | TTL  | Notes                          |
|-------|--------|----------------|------|--------------------------------|
| A     | dotco  | 76.76.21.21    | 300  | dotco.aima.chat to Vercel      |

Vercel will auto-provision SSL certificates once this record propagates.

---

## 2. Resend (Transactional Email from noreply@aima.chat)

> **IMPORTANT:** The DKIM record values below are placeholders. The actual values
> must be obtained from the Resend dashboard after adding the `aima.chat` domain:
> https://resend.com/domains → Add Domain → `aima.chat`

### SPF

| Type | Name          | Value                                     | TTL  |
|------|---------------|-------------------------------------------|------|
| TXT  | send.dotco    | v=spf1 include:amazonses.com ~all         | Auto |
| MX   | send.dotco    | 10 feedback-smtp.eu-west-1.amazonses.com  | Auto |

If an SPF record already exists for `aima.chat`, append `include:send.resend.com`
to the existing record rather than creating a new one. Only one SPF record is
allowed per domain.

### DKIM (3 records — get exact values from Resend dashboard)

| Type  | Name                          | Value                     | TTL  |
|-------|-------------------------------|---------------------------|------|
| TXT   | resend._domainkey.dotco   | p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCaPQ0FLTdgc0iumL4tGJU54jZUAlqUTK8miVfwzOTYP2vsk02a8rffyJhq9lgRVW0eFOz68BKXUA3q8GZ9ZWE4N4QXxatwIRMF49hunvjDHeBYA8xdqf4OMNcTnGlTZpBgMcXAqY6vW+Vbx+RZnRAKpRB2talJY5gNLHZJJmqazwIDAQAB | Auto  |


> Start with `p=none` (monitor only). Move to `p=quarantine` or `p=reject`
> once email delivery is confirmed working.

---

## Verification Steps

1. Add all records in Route 53
2. Add `aima.chat` domain in Resend dashboard and replace DKIM placeholders above
3. Wait for DNS propagation (typically 5-30 minutes, up to 48 hours)
4. Verify in Vercel: `vercel domains inspect dotco.aima.chat`
5. Verify in Resend dashboard that domain status shows "Verified"
6. Update Vercel env vars:
   - `AUTH_URL` → `https://dotco.aima.chat`
   - `NEXT_PUBLIC_APP_URL` → `https://dotco.aima.chat`
   - Redeploy after updating
