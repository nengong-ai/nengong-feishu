#!/usr/bin/env python3
"""No-network regression tests for code blocks and ASCII wireframes."""

from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCENARIOS = ROOT / "examples" / "formatter" / "pre-semantics.json"
SKILL = ROOT / "skills" / "feishu-doc-formatter" / "SKILL.md"


def pre_policy(
    document_profile: str,
    semantic: str,
    mode: str,
    is_semantically_mappable: bool,
    source_artifact_is_explicit: bool,
    language_is_explicit: bool,
    caption: str,
) -> list[str]:
    policy = ["preserve-body"]
    policy.append("set-lang-if-explicit" if semantic == "code" and language_is_explicit else "do-not-guess-lang")
    if semantic in {"layout_wireframe", "canvas_wireframe", "markdown_artifact"}:
        if document_profile == "code_centric" and not source_artifact_is_explicit:
            policy.append("report-context-conflict")
        elif is_semantically_mappable:
            policy.remove("preserve-body")
            policy.extend(["transcode-to-native-structure", "verify-semantic-projection"])
            if semantic == "canvas_wireframe":
                policy.append("normalize-canvas-to-layout-spec-table")
        elif not caption:
            policy.append("clear-empty-caption-if-supported")
        if mode == "presentation" and is_semantically_mappable and document_profile != "code_centric":
            policy.append("add-second-expression-if-valuable")
        elif not is_semantically_mappable:
            policy.append("report-mobile-risk")
    elif semantic == "unknown":
        policy.extend(["report-unknown", "no-visualization"])
    else:
        policy.append("no-visualization")
    return policy


class PreRoutingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.scenarios = json.loads(SCENARIOS.read_text(encoding="utf-8"))

    def test_all_pre_semantics_are_covered(self) -> None:
        self.assertEqual(
            {item["id"] for item in self.scenarios},
            {
                "real-code",
                "terminal-output",
                "ascii-wireframe-basic",
                "ascii-wireframe-presentation",
                "ecommerce-canvas-wireframe-basic",
                "ascii-wireframe-unparseable",
                "unknown-pre",
                "nontechnical-real-code",
                "markdown-import-artifact",
                "code-centric-ambiguous-ascii",
                "code-centric-explicit-import-artifact",
            },
        )

    def test_each_pre_fixture_gets_the_expected_policy(self) -> None:
        for scenario in self.scenarios:
            with self.subTest(scenario=scenario["id"]):
                policy = pre_policy(
                    scenario["document_profile"],
                    scenario["semantic"],
                    scenario["mode"],
                    scenario.get("is_semantically_mappable", False),
                    scenario.get("source_artifact_is_explicit", False),
                    scenario["language_is_explicit"],
                    scenario["caption"],
                )
                for expected in scenario["expected"]:
                    self.assertIn(expected, policy)

    def test_parseable_ascii_wireframes_are_transcoded_without_being_relabeled_as_code(self) -> None:
        policy = pre_policy("non_code", "layout_wireframe", "presentation", True, False, False, "")
        self.assertIn("do-not-guess-lang", policy)
        self.assertNotIn("set-lang-if-explicit", policy)
        self.assertIn("transcode-to-native-structure", policy)
        self.assertIn("verify-semantic-projection", policy)
        self.assertNotIn("preserve-body", policy)

    def test_parseable_canvas_wireframes_become_layout_spec_tables(self) -> None:
        policy = pre_policy("non_code", "canvas_wireframe", "basic", True, False, False, "")
        self.assertIn("transcode-to-native-structure", policy)
        self.assertIn("normalize-canvas-to-layout-spec-table", policy)
        self.assertNotIn("preserve-body", policy)

    def test_document_profile_never_turns_real_code_into_layout(self) -> None:
        policy = pre_policy("non_code", "code", "basic", True, False, True, "SQL 示例")
        self.assertIn("preserve-body", policy)
        self.assertIn("set-lang-if-explicit", policy)
        self.assertNotIn("transcode-to-native-structure", policy)

    def test_code_centric_document_preserves_ambiguous_ascii(self) -> None:
        policy = pre_policy("code_centric", "layout_wireframe", "basic", True, False, False, "")
        self.assertIn("preserve-body", policy)
        self.assertIn("report-context-conflict", policy)
        self.assertNotIn("transcode-to-native-structure", policy)

    def test_code_centric_document_can_transcode_an_explicit_import_artifact(self) -> None:
        policy = pre_policy("code_centric", "markdown_artifact", "basic", True, True, False, "")
        self.assertNotIn("preserve-body", policy)
        self.assertIn("transcode-to-native-structure", policy)

    def test_skill_declares_semantic_classification_and_second_expression(self) -> None:
        content = SKILL.read_text(encoding="utf-8")
        for phrase in (
            "`pre` 全文语境路由",
            "代码主导、非代码，还是混合",
            "Markdown 导入残留",
            "真实代码、配置、命令和终端输出不可转换",
            "固定画布线框必须转成版面规格表",
            "像素级画面",
            "区块路径",
            "可完整映射的 ASCII 流程、版面线框",
            "必须**转成原生表格或结构块",
            "逐项回指原线框",
            "不要为 ASCII 示意图猜测或补 `lang`",
        ):
            self.assertIn(phrase, content)


if __name__ == "__main__":
    unittest.main(verbosity=2)
