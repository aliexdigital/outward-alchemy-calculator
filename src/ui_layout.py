from __future__ import annotations

from contextlib import contextmanager
from html import escape
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Tuple

import streamlit as st


STYLE_PATH = Path(__file__).with_name("ui_styles.css")


def load_ui_styles() -> None:
    st.markdown(f"<style>{STYLE_PATH.read_text(encoding='utf-8')}</style>", unsafe_allow_html=True)


def _hook_name(name: str) -> str:
    return name.strip().replace("_", "-")


def render_hook(name: str) -> None:
    hook = _hook_name(name)
    st.markdown(
        f'<div class="ui-hook {hook}-hook" data-ui-hook="{hook}" aria-hidden="true"></div>',
        unsafe_allow_html=True,
    )


@contextmanager
def named_block(name: str) -> Iterator[None]:
    with st.container():
        render_hook(name)
        yield


@contextmanager
def named_panel(name: str, *, border: bool = True) -> Iterator[None]:
    with st.container(border=border):
        render_hook(name)
        yield


@contextmanager
def named_expander(name: str, label: str, *, expanded: bool = False) -> Iterator[None]:
    with st.expander(label, expanded=expanded):
        render_hook(name)
        yield


def render_hero(title: str, subtitle: str) -> None:
    st.markdown(
        f"""
        <section class="hero-card" id="hero-card">
            <h1 class="hero-title">{escape(title)}</h1>
            <p class="hero-subtitle">{escape(subtitle)}</p>
        </section>
        """,
        unsafe_allow_html=True,
    )


def render_section_header(name: str, title: str, description: str = "", eyebrow: str = "") -> None:
    hook = _hook_name(name)
    eyebrow_html = f'<div class="section-eyebrow">{escape(eyebrow)}</div>' if eyebrow else ""
    description_html = f'<p class="section-description">{escape(description)}</p>' if description else ""
    st.markdown(
        f"""
        <div class="section-header {hook}__header">
            {eyebrow_html}
            <h2 class="section-title">{escape(title)}</h2>
            {description_html}
        </div>
        """,
        unsafe_allow_html=True,
    )


def section_descriptions() -> Dict[str, str]:
    return {
        "Craft now": "Shows everything you can craft immediately from your current inventory.",
        "Plan a target": "Builds one target through intermediate crafts when it is not directly craftable yet.",
        "Shopping list": "Finds the smallest missing ingredient list for a build or prep plan.",
        "Missing ingredients": "Highlights recipes that are close to craftable so one pickup can unlock them.",
        "Recipe database": "Browse the full recipe set, ingredient groups, and item stat metadata.",
    }


def render_section_nav() -> str:
    return st.radio(
        "Navigate",
        options=["Craft now", "Plan a target", "Shopping list", "Missing ingredients", "Recipe database"],
        horizontal=True,
        label_visibility="collapsed",
        help="Pick the part of the calculator you want to work in.",
    )


def render_active_section_note(active_section: str) -> None:
    note = section_descriptions()[active_section]
    st.markdown(f'<div class="mode-note">{escape(note)}</div>', unsafe_allow_html=True)


def render_tab_help(title: str, description: str) -> None:
    st.markdown(
        f"""
        <div class="helper-card">
            <strong>{escape(title)}</strong><br>
            {escape(description)}
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_table_header(title: str, help_text: str) -> None:
    st.markdown(
        f"""
        <div class="table-header">
            <span class="table-header-title">{escape(title)}</span>
            <span class="table-header-help" title="{escape(help_text)}">?</span>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_compact_stats(stats: List[Tuple[str, object]], columns: int = 4, variant: str = "") -> None:
    stat_columns = st.columns(columns, gap="small")
    for idx, (label, value) in enumerate(stats):
        stat_columns[idx % columns].metric(str(label), str(value))


def render_empty_state(message: str, tone: str = "soft") -> None:
    tone_class = tone if tone in {"soft", "inline"} else "soft"
    st.markdown(
        f'<div class="empty-state {tone_class}">{escape(message)}</div>',
        unsafe_allow_html=True,
    )
