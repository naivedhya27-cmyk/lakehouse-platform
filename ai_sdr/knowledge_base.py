"""Knowledge base of target companies.

The PRIMARY data source for v1, since outbound HTTP is blocked in this
sandbox. enrich.py merges this with whatever it can scrape live.

Each entry must be substantial enough to write a personalized email
without ever fetching the live site. If you add a new company, fill
every field — the generator depends on every key.
"""

from .models import KnowledgeEntry


KNOWLEDGE: dict[str, KnowledgeEntry] = {
    "linear.app": KnowledgeEntry(
        domain="linear.app",
        founder_first_name="Karri",
        founder_email_guess="karri@linear.app",
        product_one_liner="Issue tracking and project management built for fast software teams.",
        signature_feature="Triage inbox — turns inbound issues into a clean, sortable queue before they hit a sprint.",
        positioning_wedge="Opinionated, keyboard-first UX in a category dominated by Jira's bureaucracy.",
        ideal_personalization_hook=(
            "Your Triage inbox basically templated how every modern issue tracker handles incoming "
            "reports — copied everywhere now"
        ),
        ai_sdr_workflow_hypothesis=(
            "Curious whether your own inbound contact-form leads still get hand-sorted into Slack "
            "and Notion every morning"
        ),
        subject_hint="triage",
    ),
    "resend.com": KnowledgeEntry(
        domain="resend.com",
        founder_first_name="Zeno",
        founder_email_guess="zeno@resend.com",
        product_one_liner="Developer-focused transactional email API.",
        signature_feature="React Email — composable email templates as React components, open-sourced.",
        positioning_wedge="Treats email as a developer surface, not a marketing tool — outflanking Postmark and SendGrid on DX.",
        ideal_personalization_hook=(
            "React Email re-framing email templates as actual components is the wedge — that "
            "abstraction is showing up in every dev-tools stack now"
        ),
        ai_sdr_workflow_hypothesis=(
            "Bet your free-tier signup stream still gets eyeballed manually for which look like "
            "real teams vs hobby projects"
        ),
        subject_hint="react email",
    ),
    "cal.com": KnowledgeEntry(
        domain="cal.com",
        founder_first_name="Peer",
        founder_email_guess="peer@cal.com",
        product_one_liner="Open-source scheduling infrastructure (Calendly alternative).",
        signature_feature="Routing Forms — conditional team-routing logic that turns scheduling into lightweight CRM.",
        positioning_wedge="Self-hostable, infinitely customizable scheduling — open-source play against Calendly's lock-in.",
        ideal_personalization_hook=(
            "Routing Forms quietly turned Cal into a lightweight CRM — the conditional team-routing "
            "is the part nobody else nailed"
        ),
        ai_sdr_workflow_hypothesis=(
            "Wonder if 'is self-hosting right for us' threads still get manually triaged before a "
            "human picks up the right reply"
        ),
        subject_hint="routing",
    ),
    "vercel.com": KnowledgeEntry(
        domain="vercel.com",
        founder_first_name="Lee",
        founder_email_guess="lee@vercel.com",
        product_one_liner="Frontend cloud — Next.js hosting with edge runtime.",
        signature_feature="Preview URLs on every PR — turned ephemeral environments into a default git workflow.",
        positioning_wedge="The Next.js company; making frontend deployment feel like git push.",
        ideal_personalization_hook=(
            "Preview URLs as a default per-PR primitive shifted how every dev team treats staging — "
            "that single design choice is the wedge"
        ),
        ai_sdr_workflow_hypothesis=(
            "Bet your sales team still hand-scans which Pro accounts are quietly running production "
            "traffic that should be Enterprise"
        ),
        subject_hint="preview urls",
    ),
    "supabase.com": KnowledgeEntry(
        domain="supabase.com",
        founder_first_name="Paul",
        founder_email_guess="paul@supabase.com",
        product_one_liner="Open-source Firebase alternative built on Postgres.",
        signature_feature="Postgres RLS as the auth primitive — no separate auth service to bolt on.",
        positioning_wedge="Open-source, Postgres-native — bet against Firebase's NoSQL lock-in.",
        ideal_personalization_hook=(
            "Postgres' RLS as the actual auth layer — most OSS clones bolt one on, you didn't, and "
            "that's the architectural call that holds up at scale"
        ),
        ai_sdr_workflow_hypothesis=(
            "Curious if Discord 'we're scaling, considering self-host vs Enterprise' threads still "
            "get hand-skimmed by your team"
        ),
        subject_hint="rls",
    ),
    "posthog.com": KnowledgeEntry(
        domain="posthog.com",
        founder_first_name="James",
        founder_email_guess="james@posthog.com",
        product_one_liner="Open-source product analytics + session replay + feature flags + experiments.",
        positioning_wedge="All-in-one product OS for teams who don't want to wire Mixpanel + LaunchDarkly + Hotjar separately.",
        signature_feature="Public-by-default handbook — salaries, roadmap, post-mortems all visible.",
        ideal_personalization_hook=(
            "The public-by-default handbook (salaries, roadmap, exit interviews) does more for "
            "engineering recruiting than any careers page — most companies couldn't stomach it"
        ),
        ai_sdr_workflow_hypothesis=(
            "Wonder if your inbound still gets manually sifted for 'self-host vs cloud' signals "
            "before someone replies with the right doc link"
        ),
        subject_hint="handbook",
    ),
    "clerk.com": KnowledgeEntry(
        domain="clerk.com",
        founder_first_name="Colin",
        founder_email_guess="colin@clerk.com",
        product_one_liner="Auth-as-a-service tuned for React and Next.js.",
        signature_feature="Drop-in <SignIn /> components — full polished UI ships out of the box.",
        positioning_wedge="Best-in-class DX for React auth in a category where Auth0's docs read like a tax form.",
        ideal_personalization_hook=(
            "Shipping <SignIn /> as a literal drop-in component was the move — Auth0's docs read "
            "like a tax form by comparison"
        ),
        ai_sdr_workflow_hypothesis=(
            "Bet your inbound still gets hand-sorted for which startups need basic auth vs the "
            "ones quietly asking for SAML and SCIM"
        ),
        subject_hint="saml",
    ),
    "dub.co": KnowledgeEntry(
        domain="dub.co",
        founder_first_name="Steven",
        founder_email_guess="steven@dub.co",
        product_one_liner="Open-source link management and analytics platform.",
        signature_feature="Branded short links + analytics with a UI that finally looks like a product.",
        positioning_wedge="Open-source, modern Bitly — link management for teams instead of a sketchy redirector.",
        ideal_personalization_hook=(
            "Making short-link analytics look like a product instead of a sketchy redirector was "
            "overdue — Bitly should've shipped that a decade ago"
        ),
        ai_sdr_workflow_hypothesis=(
            "Curious if your team manually pokes through heaviest free-tier workspaces to spot "
            "ones running real production marketing on you"
        ),
        subject_hint="links",
    ),
    "mintlify.com": KnowledgeEntry(
        domain="mintlify.com",
        founder_first_name="Han",
        founder_email_guess="han@mintlify.com",
        product_one_liner="AI-powered documentation platform for technical products.",
        signature_feature="Conversational docs search — users can ask the docs a question instead of grep-searching them.",
        positioning_wedge="AI-native docs platform; replacing Algolia DocSearch + GitBook + ReadTheDocs in one.",
        ideal_personalization_hook=(
            "Asking docs a question instead of grep-searching them is the real product unlock — "
            "Algolia DocSearch should've shipped this years ago"
        ),
        ai_sdr_workflow_hypothesis=(
            "Bet your inbound still gets manually scanned for which prospects have a sprawling "
            "docs site worth migrating vs a one-pager"
        ),
        subject_hint="docs ai",
    ),
    "trigger.dev": KnowledgeEntry(
        domain="trigger.dev",
        founder_first_name="Matt",
        founder_email_guess="matt@trigger.dev",
        product_one_liner="Open-source background jobs and cron infrastructure for developers.",
        signature_feature="Code-defined background jobs — workflows as TypeScript functions, not YAML config.",
        positioning_wedge="Background-job infrastructure with actual DX; replaces the BullMQ + Redis + dashboard stitch.",
        ideal_personalization_hook=(
            "Background jobs as code-defined functions instead of queue-config was the missing "
            "piece — most teams stitched three tools to fake it"
        ),
        ai_sdr_workflow_hypothesis=(
            "Curious if your inbound still gets hand-sorted for devs evaluating real production "
            "loads vs ones kicking tires on side projects"
        ),
        subject_hint="background jobs",
    ),
}


# Auto-merged extras produced by scout.py running outside the sandbox.
# Optional — present only after a user runs `python scout.py --input ...`.
try:
    from .knowledge_base_extra import EXTRA  # type: ignore[import-not-found]
    KNOWLEDGE.update(EXTRA)
except ImportError:
    pass
except Exception:
    # Never let a malformed extras file break the package import.
    pass


def lookup(domain: str) -> KnowledgeEntry | None:
    return KNOWLEDGE.get(domain.lower().strip())


def all_domains() -> list[str]:
    return list(KNOWLEDGE.keys())
