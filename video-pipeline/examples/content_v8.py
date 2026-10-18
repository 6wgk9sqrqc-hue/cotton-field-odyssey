"""Video 8: smart settings. Checked against the Claude Help Center (share chats, artifacts 'Edit with Claude',
monthly recap/Reflect, usage limits, export data), Oct 17 2026."""
HOOK_VO = "Five Claude settings most people never touch."
HOOK_TITLE = ("SMART", "SETTINGS")
TIPS = [
    dict(cat="SHARING", type_frac=0.9, tag="ALL PLANS", head="Share a chat link",
         term="> Share: a view-only snapshot", icon="share", color="#2EE6FF",
         vo=dict(intro="Tip one: sharing.",
                 head="Share a chat with one click.",
                 detail="Hit Share in the top right, and people see a view-only snapshot. Your attached files stay private.")),
    dict(cat="EDIT IN PLACE", type_frac=0.9, tag="ALL PLANS", head="Edit just one part",
         term="> Highlight > Edit with Claude", icon="highlight", color="#FF3DF2",
         vo=dict(intro="Tip two: edit in place.",
                 head="Change just one part of a draft.",
                 detail="Highlight part of a document Claude made, click Edit with Claude, and type the change. It rewrites just that spot.")),
    dict(cat="REFLECT", type_frac=0.6, term_frac=0.3, tag="BETA | FREE, PRO, MAX", head="Get a monthly recap",
         term="> Settings > Reflect", icon="calendar", color="#A07BFF",
         vo=dict(intro="Tip three: reflect.",
                 head="Get a monthly recap of how you use Claude.",
                 detail="Open Settings, then Reflect, to see your top topics and busiest days. It's in beta on web and desktop, and memory needs to be on.")),
    dict(cat="USAGE", type_frac=0.6, tag="PAID PLANS", head="Check your usage",
         term="> Settings > Usage", icon="gauge", color="#3CF0A0",
         vo=dict(intro="Tip four: usage.",
                 head="Check how much usage you have left.",
                 detail="On paid plans, open Settings, then Usage, to see your session and weekly limits.")),
    dict(cat="EXPORT", type_frac=0.9, tag="FREE | PRO | MAX", head="Download your data",
         term="> Settings > Privacy > Export data", icon="folder", color="#FFB02E",
         vo=dict(intro="And tip five: export.",
                 head="Download a copy of your data.",
                 detail="On web or desktop, go to Settings, Privacy, Export data, and Claude emails you a download link.")),
]
OUTRO_VO = "Save this, and follow for daily AI finds."

CAPTION = "…3 settings tricks: share a chat, edit in place, monthly recap ⚙️⚡️"
