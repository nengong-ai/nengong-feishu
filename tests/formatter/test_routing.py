#!/usr/bin/env python3
"""No-network checks for the first-use routing rules."""

from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SKILL = ROOT / "skills" / "feishu-doc-formatter" / "SKILL.md"
DIALOGUE = ROOT / "examples" / "formatter" / "first-use-dialogue.md"


def capability_route(adapter: str, target_access: str | None = None) -> str:
    if adapter == "unavailable":
        return "plan_only"
    if adapter in {"needs_auth", "needs_scope"}:
        return "authorize_first"
    if adapter != "connected":
        raise ValueError(f"unknown adapter state: {adapter}")
    if target_access == "read_only":
        return "analyze_without_write"
    if target_access == "ready":
        return "copy_then_format"
    raise ValueError("connected adapter requires target access state")


def automatic_choice(purpose: str, relation_density: str, scenario: str) -> tuple[str, str]:
    if purpose == "linear" or relation_density == "low":
        return ("basic", "演读节奏" if purpose == "linear" else "清爽易读")
    if scenario == "decision" and relation_density == "high":
        return ("presentation", "商业数据")
    if scenario == "editorial":
        return ("presentation", "杂志专题")
    if scenario == "plan":
        return ("presentation", "亲和计划")
    if scenario == "strong-opinion":
        return ("presentation", "强观点")
    return ("basic", "清爽易读")


class FirstUseRoutingTests(unittest.TestCase):
    def test_capability_route_never_uses_test_write(self) -> None:
        self.assertEqual(capability_route("unavailable"), "plan_only")
        self.assertEqual(capability_route("needs_auth"), "authorize_first")
        self.assertEqual(capability_route("connected", "read_only"), "analyze_without_write")
        self.assertEqual(capability_route("connected", "ready"), "copy_then_format")

    def test_automatic_choice_prefers_restraint_for_linear_content(self) -> None:
        self.assertEqual(automatic_choice("linear", "high", "decision"), ("basic", "演读节奏"))
        self.assertEqual(automatic_choice("report", "low", "strong-opinion"), ("basic", "清爽易读"))

    def test_automatic_choice_maps_presentation_scenarios(self) -> None:
        self.assertEqual(automatic_choice("report", "high", "decision"), ("presentation", "商业数据"))
        self.assertEqual(automatic_choice("report", "medium", "editorial"), ("presentation", "杂志专题"))
        self.assertEqual(automatic_choice("plan", "medium", "plan"), ("presentation", "亲和计划"))
        self.assertEqual(automatic_choice("method", "medium", "strong-opinion"), ("presentation", "强观点"))

    def test_skill_has_the_required_first_use_choices_and_follow_up(self) -> None:
        content = SKILL.read_text(encoding="utf-8")
        for phrase in (
            "路由 1：先检查能否安全操作飞书",
            "基础整理",
            "展示型排版",
            "自动推荐",
            "手动选择",
            "下次改用自动推荐",
        ):
            self.assertIn(phrase, content)

    def test_dialogue_works_without_buttons(self) -> None:
        content = DIALOGUE.read_text(encoding="utf-8")
        self.assertIn("没有按钮时保留编号", content)
        self.assertIn("1. 基础整理", content)
        self.assertIn("2. 展示型排版", content)
        self.assertIn("3. 自动推荐", content)


if __name__ == "__main__":
    unittest.main(verbosity=2)
