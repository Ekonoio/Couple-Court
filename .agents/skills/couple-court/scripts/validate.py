#!/usr/bin/env python3
"""Schema validation only; use project's validateOutput for provenance/business checks."""
import json,sys
from pathlib import Path
from jsonschema import Draft7Validator
root=Path(__file__).resolve().parents[1]
schema=json.loads((root/'assets/output.schema.json').read_text())
Draft7Validator.check_schema(schema)
data=json.loads(Path(sys.argv[1]).read_text())
errors=sorted(Draft7Validator(schema).iter_errors(data),key=lambda e:str(list(e.path)))
for error in errors: print('/'.join(map(str,error.path))+': '+error.message)
if errors: sys.exit(1)
print('Schema OK; provenance and scoring require project validateOutput.')
