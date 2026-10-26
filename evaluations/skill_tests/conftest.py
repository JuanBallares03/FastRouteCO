"""Makes the repository root importable when running: python -m pytest evaluations/skill_tests"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
