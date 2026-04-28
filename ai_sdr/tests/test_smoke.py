"""End-to-end smoke test.

Runs `python -m ai_sdr.cli run` against a single-row prospects.csv
and asserts drafts.csv was written with a non-empty body.

Runnable two ways:
    python -m unittest ai_sdr.tests.test_smoke
    python -m pytest ai_sdr/tests/test_smoke.py    # if pytest is available
"""

import csv
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


class SmokeTest(unittest.TestCase):
    def test_pipeline_runs_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            prospects = tmp / "prospects.csv"
            prospects.write_text("company_domain\nlinear.app\n", encoding="utf-8")
            drafts = tmp / "drafts.csv"
            enriched = tmp / "enriched.json"

            result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "ai_sdr.cli",
                    "run",
                    "--input",
                    str(prospects),
                    "--output",
                    str(drafts),
                    "--enriched-out",
                    str(enriched),
                    "--config",
                    str(REPO_ROOT / "config.yaml"),
                ],
                cwd=str(REPO_ROOT),
                capture_output=True,
                text=True,
            )

            self.assertEqual(
                result.returncode,
                0,
                f"CLI failed:\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}",
            )
            self.assertTrue(drafts.exists(), "drafts.csv was not written")
            self.assertTrue(enriched.exists(), "enriched.json was not written")

            with drafts.open(newline="", encoding="utf-8") as f:
                rows = list(csv.DictReader(f))
            self.assertEqual(len(rows), 1, f"expected 1 draft row, got {len(rows)}")
            row = rows[0]
            self.assertEqual(row["company_domain"], "linear.app")
            self.assertTrue(row["body"].strip(), "draft body is empty")
            self.assertTrue(row["subject"].strip(), "draft subject is empty")
            self.assertGreaterEqual(int(row["specificity_score"]), 1)
            self.assertGreaterEqual(int(row["humanness_score"]), 1)
            self.assertGreaterEqual(int(row["curiosity_score"]), 1)


if __name__ == "__main__":
    unittest.main()
