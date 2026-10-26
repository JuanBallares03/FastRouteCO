# FastRouteCO skills

Skills follow the course framework contract: a `manifest.yaml` (name, version, description, input_schema, output_schema, permissions) and a `skill.py` class that extends `BaseSkill`, registers itself with `register_skill` and runs deterministically without state. Tests live in `evaluations/skill_tests/` (`python -m pytest evaluations/skill_tests`). Active skills are listed in `config/skills.yaml`.

## Domain skills (what FastRouteCO does)

| Skill | Purpose | Traceability |
| --- | --- | --- |
| `geofence_check` | Detects whether the driver is inside the geofence of a stop | RF14, HU-15 CA04 |
| `credit_consumption` | Consumes plan credits first, then purchased credits; failed optimizations are free; low balance alert and block | RF20, HU-16 |
| `usage_charge_calculator` | Pay-per-use amount, additional drivers, early charge and spending limit alerts | RF29–RF31, HU-37, HU-38, HU-39 |
| `plan_limit_check` | Whether a company can add another branch or driver under its plan | HU-26 CA03, HU-27 CA04 |
| `driver_suggestion` | Suggests the nearest available driver for an order | RF05, HU-29 |
| `trial_status` | Free Trial days remaining, expiration and two-day notice | RF19, HU-16 CA06–CA07 |

Prices and the geofence radius are inputs because they are still TO BE DEFINED. The stop-order optimization algorithm is TO BE DEFINED and has no skill yet.

## Development skills (how FastRouteCO is built)

| Skill | Purpose |
| --- | --- |
| `traceability_check` | Finds HU, RF, RNF and CU references in a text and flags IDs outside the valid ranges |
| `commit_message_check` | Validates Conventional Commits with the project types and scopes |
| `api_contract_extract` | Lists the endpoints of a backend routes file (method, path, roles, authentication, validation) |
| `env_keys_check` | Reports missing or empty variables of a `.env` compared with `.env.example`, never returning values |
