"""LLM-generated human-readable suggestions from score gaps."""
import anthropic
from app.config import settings

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

_SYSTEM = """You are a senior career coach specializing in FAANG, HPC, and Quant Hedge Fund hiring.
Given a candidate's score breakdown and identified gaps, write concise, actionable suggestions.
Format your response as plain text with clear sections:
- **Skills to Acquire** (if any)
- **Projects to Build** (if any, be specific — suggest actual project ideas)
- **Experience Strategy** (if any)
- **CV Presentation Fixes** (if any)
Each bullet must be concrete and actionable. Max 400 words total."""


def generate_suggestions(
    role: str,
    skills_gaps: list[str],
    project_gaps: list[str],
    experience_gaps: list[str],
    presentation_gaps: list[str],
    scores: dict,
) -> str:
    gap_summary = f"""Target role: {role}

Scores:
- Skills Match: {scores.get('skills_match', 0):.0%}
- Project Quality: {scores.get('project_quality', 0):.0%}
- Experience Depth: {scores.get('experience_depth', 0):.0%}
- Presentation: {scores.get('presentation', 0):.0%}

Gaps identified:
Skills: {'; '.join(skills_gaps) or 'None'}
Projects: {'; '.join(project_gaps) or 'None'}
Experience: {'; '.join(experience_gaps) or 'None'}
Presentation: {'; '.join(presentation_gaps) or 'None'}"""

    with client.messages.stream(
        model="claude-opus-4-8",
        max_tokens=1024,
        thinking={"type": "adaptive"},
        system=_SYSTEM,
        messages=[{"role": "user", "content": gap_summary}],
    ) as stream:
        return stream.get_final_message().content[-1].text
