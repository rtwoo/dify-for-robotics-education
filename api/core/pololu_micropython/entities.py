"""Pydantic DTOs for the Pololu MicroPython compiler boundary.

These models describe the transient IR, diagnostics, source maps, and export
payloads. They are not persisted directly; the workflow graph remains the
database source of truth.
"""

from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class DiagnosticSeverity(StrEnum):
    ERROR = "error"
    WARNING = "warning"


class PololuOperation(StrEnum):
    SET_MOTORS = "set_motors"
    STOP_MOTORS = "stop_motors"
    WAIT = "wait"
    DISPLAY_TEXT = "display_text"
    YELLOW_LED = "yellow_led"
    RGB_LED = "rgb_led"
    BUZZER_BEEP = "buzzer_beep"


class PololuDiagnostic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str
    severity: DiagnosticSeverity = DiagnosticSeverity.ERROR
    line: int | None = None
    column: int | None = None
    node_id: str | None = None
    statement_id: str | None = None


class PololuSourceMapEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    statement_id: str
    node_id: str | None = None
    line_start: int
    line_end: int


class PololuStatement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    statement_id: str
    operation: PololuOperation
    parameters: dict[str, Any] = Field(default_factory=dict)
    node_id: str | None = None


class PololuProgram(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1] = 1
    target: Literal["pololu_3pi_2040"] = "pololu_3pi_2040"
    round_trip_version: Literal[1] = 1
    loop_forever: bool = True
    exit_button: Literal["button_b"] = "button_b"
    statements: list[PololuStatement] = Field(default_factory=list)


class PololuTransformResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    program: PololuProgram
    diagnostics: list[PololuDiagnostic] = Field(default_factory=list)


class PololuCodeResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    source_map: list[PololuSourceMapEntry] = Field(default_factory=list)
    diagnostics: list[PololuDiagnostic] = Field(default_factory=list)
    graph_hash: str
    ir_hash: str


class PololuGraphResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    graph: dict[str, Any]
    diagnostics: list[PololuDiagnostic] = Field(default_factory=list)
    ir_hash: str


class PololuCompileFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str
    content: str


class PololuCompileResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    files: list[PololuCompileFile]
    code: str
    diagnostics: list[PololuDiagnostic] = Field(default_factory=list)
    source_map: list[PololuSourceMapEntry] = Field(default_factory=list)
    graph_hash: str
    ir_hash: str
