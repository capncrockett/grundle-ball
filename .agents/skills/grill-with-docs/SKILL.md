---
name: grill-with-docs
description: Relentlessly interview the user to sharpen a plan or design while maintaining the project's domain glossary and recording durable architectural decisions. Use only when the user explicitly asks for grill-with-docs or asks to be grilled with documentation.
---

# Grill With Docs

Apply the installed `grilling` and `domain-modeling` skills together.

- Follow `grilling` for the interview loop: investigate discoverable facts, ask one decision question at a time, recommend an answer, wait for feedback, and do not implement the plan during the session.
- Follow `domain-modeling` for documentation: challenge ambiguous terminology, update `CONTEXT.md` only when a domain term is actually resolved, and offer an ADR only when all of its stated criteria are met.
- Treat `CONTEXT.md` strictly as a domain glossary, never as a plan, specification, or implementation log.
- Match the user's language throughout the session.
