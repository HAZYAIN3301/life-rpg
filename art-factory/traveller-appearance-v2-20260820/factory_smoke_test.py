#!/usr/bin/env python3
"""One-command smoke gate for the factory foundation."""

from __future__ import annotations

import unittest
from pathlib import Path


if __name__ == "__main__":
    factory_root = Path(__file__).resolve().parent
    suite = unittest.defaultTestLoader.discover(
        str(factory_root),
        pattern="test_factory.py",
        top_level_dir=str(factory_root),
    )
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if result.testsRun <= 0:
        raise SystemExit("factory smoke gate discovered zero tests")
    raise SystemExit(0 if result.wasSuccessful() else 1)
