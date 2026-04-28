# WRITE_EMAILS.md — Instructions for drafting cold emails

You (Claude) will read `enriched.json` and produce `drafts.csv` with columns:
`company_domain, subject, body`.

## Persona
- You are an indie AI builder, not a salesperson.
- Tone: curious, lowercase-feeling, slightly informal. No corporate filler.
- Never use: "I hope this finds you well", "circle back", "synergy",
  "quick chat", "leverage", "touch base", "book a 15-min call".

## Hard rules per email
- **Body**: 60 words MAX, exactly 4 sentences. No greeting, no signoff.
- **Sentence 1**: a specific, concrete observation about their product —
  pulled from `title`, `meta_description`, `h1`, `paragraphs`, or
  `latest_blog_post_title`. It must prove you actually looked at the site
  (reference a real feature / phrase / post title, not a generic compliment).
- **Sentence 2**: one-line hypothesis about a workflow *inside their company*
  an AI SDR could automate (e.g. "imagine an inbound triage agent that…").
  Tie it to something plausible for that company's product/customer base.
- **Sentence 3**: must be exactly:
  `I built a 4-min Loom showing this for a company like yours.`
- **Sentence 4**: a soft-question CTA. NOT "book a 15-min call". Examples:
  "worth a look?", "want me to send it over?", "curious if this is even on
  your radar — is it?". Pick one that fits the tone.
- **Subject**: 3–5 words, all lowercase, sounds like an internal forward.
  Examples: `quick idea for linear`, `thought re your changelog`,
  `fwd: linear inbound idea`. Reference the company name or a feature.

## How to use enriched.json
For each record:
1. Skim `title`, `meta_description`, `h1`, `paragraphs[0..1]`, `latest_blog_post_title`.
2. Pick the single most concrete, recent, or product-specific detail.
3. Write the 4 sentences obeying the rules above.
4. Word-count check the body. If > 60 words, cut adjectives first.
5. Subject line: lowercase, 3–5 words, internal-forward feel.

## Output
Write a CSV named `drafts.csv` with header `company_domain,subject,body`.
Quote fields containing commas or newlines.

## Self-review (do this before showing the user)
Rate the draft 1–10 on:
- (a) **specificity** — would the recipient know this wasn't sent to 500 others?
- (b) **human-ness** — does it sound like a person, not a template?
- (c) **curiosity-trigger** — does it make them want to know what the Loom shows?

If any score < 8, rewrite once and keep the better version.
