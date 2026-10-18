"""Video 10: code smarter. Checked against Claude Code docs (memory/CLAUDE.md, permission modes,
checkpointing, /compact) and plan pages, Oct 17 2026. Claude Code: Pro, Max, Team, Enterprise; not Free."""
HOOK_VO = "Coding with Claude? Five tricks to code smarter."
HOOK_TITLE = ("CODE", "SMARTER")
TIPS = [
    dict(cat="ERRORS", type_frac=0.9, tag="ANY PLAN", head="Paste the full error",
         term="> Paste it verbatim, not a summary", icon="bug", color="#2EE6FF",
         vo=dict(intro="Tip one: errors.",
                 head="Paste the full error message.",
                 detail="Not your summary of it. The exact file, line, and message help Claude find the bug fast.")),
    dict(cat="CLAUDE.MD", type_frac=0.9, term_delay=2.3, tag="CLAUDE CODE | PAID", head="Give it a CLAUDE.md",
         term="> /init writes a starter file", icon="mdfile", color="#FF3DF2",
         vo=dict(intro="Tip two: Claude dot M D.",
                 head="Give Claude Code a Claude dot M D file.",
                 detail="It reads it at the start of every session. Type slash init, and it writes a starter one for you.")),
    dict(cat="PLAN MODE", type_frac=0.9, tag="CLAUDE CODE | PAID", head="Plan before it edits",
         term="> Shift+Tab to plan mode, or /plan", icon="checklist", color="#A07BFF",
         vo=dict(intro="Tip three: plan mode.",
                 head="Make it plan before it edits.",
                 detail="Tap Shift Tab until it says plan mode, or type slash plan, and it pitches a plan before touching any files.")),
    dict(cat="REWIND", type_frac=0.9, tag="CLAUDE CODE | PAID", head="Rewind a bad change",
         term="> Esc Esc or /rewind", icon="rewind", color="#3CF0A0",
         vo=dict(intro="Tip four: rewind.",
                 head="Rewind when it goes off the rails.",
                 detail="Press Escape twice on an empty prompt, or type slash rewind, to roll back to an earlier checkpoint.")),
    dict(cat="COMPACT", type_frac=0.9, tag="CLAUDE CODE | PAID", head="Compact long sessions",
         term="> /compact frees up context", icon="compress", color="#FFB02E",
         vo=dict(intro="And tip five: compact.",
                 head="Compact long sessions.",
                 detail="Type slash compact, and Claude Code summarizes the conversation to free up room, keeping what matters.")),
]
OUTRO_VO = "Save this, and follow for daily AI finds."

CAPTION = "…3 coding tricks: paste the error, CLAUDE.md, plan mode 💻⚡️"
