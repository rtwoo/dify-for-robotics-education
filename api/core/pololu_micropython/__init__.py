"""Pololu 3pi+ 2040 MicroPython workflow compilation support.

The public boundary of this package is the Program IR and deterministic
transforms between Dify workflow graphs, editable MicroPython, and exportable
robot files. The transforms intentionally accept only a constrained subset of
MicroPython so graph/code round trips remain predictable and diagnostics can
point back to workflow nodes.
"""

from core.pololu_micropython.transform import (
    code_to_ir,
    graph_to_ir,
    ir_to_code,
    ir_to_graph,
)

__all__ = [
    "code_to_ir",
    "graph_to_ir",
    "ir_to_code",
    "ir_to_graph",
]
