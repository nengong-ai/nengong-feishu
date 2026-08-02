#!/usr/bin/env python3
"""Contract-only dry-run tests for feishu-doc-formatter.

These tests deliberately do not authenticate to Feishu or issue writes.  They model the
minimum safety decisions that an execution adapter must preserve.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCENARIOS = ROOT / "examples" / "formatter" / "dry-run-scenarios.json"
SKILL = ROOT / "skills" / "feishu-doc-formatter" / "SKILL.md"
CONTRACT = ROOT / "skills" / "feishu-doc-formatter" / "references" / "operation-contract.md"
INTEGRATION = ROOT / "docs" / "formatter-integration-notes.md"


def dry_run_plan(scenario: dict) -> list[str]:
    """Return observable safety checkpoints for one mock document operation."""
    plan = ["copy-first"]
    if scenario["media"]:
        plan.append("media-ledger")
    else:
        plan.append("full-ledger")
    if scenario["special_blocks"]:
        plan.append("preserve-special")
    if scenario["media"]:
        plan.append("anchored-media-or-degrade")
    elif scenario["special_blocks"]:
        plan.append("block-operations")
    else:
        plan.append("sectional-updates" if len(scenario["blocks"]) > 4 else "block-operations")
    if scenario["write_result"] == "partial_success":
        plan.extend(["stop", "re-read", "diff-ledger", "explicit-recovery"])
    elif scenario["write_result"] == "success":
        plan.append("re-read")
    else:
        raise ValueError(f"unsupported mock result: {scenario['write_result']}")
    return plan


class FormatterDryRunTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.scenarios = json.loads(SCENARIOS.read_text(encoding="utf-8"))

    def test_all_required_scenarios_are_present(self) -> None:
        self.assertEqual(
            {item["id"] for item in self.scenarios},
            {"pure-text-long", "complex-structure", "existing-media", "partial-update-recovery"},
        )

    def test_safety_decisions_match_each_fixture(self) -> None:
        for scenario in self.scenarios:
            with self.subTest(scenario=scenario["id"]):
                plan = dry_run_plan(scenario)
                for checkpoint in scenario["expected"]:
                    self.assertIn(checkpoint, plan)

    def test_partial_success_never_auto_reverts(self) -> None:
        scenario = next(item for item in self.scenarios if item["id"] == "partial-update-recovery")
        plan = dry_run_plan(scenario)
        self.assertIn("stop", plan)
        self.assertIn("explicit-recovery", plan)
        self.assertNotIn("automatic-history-revert", plan)

    def test_published_skill_declares_critical_guards(self) -> None:
        content = SKILL.read_text(encoding="utf-8")
        for phrase in ("默认在副本上工作", "不要使用一次长输出重写全文", "partial_success", "重新读取", "未知块"):
            self.assertIn(phrase, content)

    def test_contract_and_lark_mapping_are_documented(self) -> None:
        contract = CONTRACT.read_text(encoding="utf-8")
        notes = INTEGRATION.read_text(encoding="utf-8")
        for capability in ("`probe`", "`copy`", "`fetch_full`", "`mutate_blocks`", "`insert_media_at_anchor`"):
            self.assertIn(capability, contract)
        for command in ("drive files copy", "docs +fetch --detail full", "partial_success", "不执行任何写操作"):
            self.assertIn(command, notes)


if __name__ == "__main__":
    unittest.main(verbosity=2)
