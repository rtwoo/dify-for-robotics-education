"""Safety validation for the Pololu MicroPython IR.

The compiler calls these checks before code generation and export. Validation is
kept separate from graph/code transforms so adding new robot operations does not
bury safety rules inside parser control flow.
"""

from core.pololu_micropython.entities import (
    DiagnosticSeverity,
    PololuDiagnostic,
    PololuOperation,
    PololuProgram,
    PololuStatement,
)

MAX_MOTOR_SPEED = 6000


def validate_program(program: PololuProgram) -> list[PololuDiagnostic]:
    """Return safety and shape diagnostics for supported Pololu IR statements."""
    diagnostics: list[PololuDiagnostic] = []
    for statement in program.statements:
        params = statement.parameters
        match statement.operation:
            case PololuOperation.SET_MOTORS:
                for key in ("left", "right"):
                    speed = params.get(key)
                    if not isinstance(speed, int | float):
                        diagnostics.append(_statement_error(statement, f"Motor speed '{key}' must be numeric."))
                    elif abs(speed) > MAX_MOTOR_SPEED:
                        diagnostics.append(
                            _statement_error(statement, f"Motor speed '{key}' must be between -6000 and 6000.")
                        )
            case PololuOperation.WAIT:
                seconds = params.get("seconds")
                if not isinstance(seconds, int | float) or seconds < 0:
                    diagnostics.append(_statement_error(statement, "Wait duration must be a non-negative number."))
            case PololuOperation.DISPLAY_TEXT:
                text = params.get("text")
                if not isinstance(text, str):
                    diagnostics.append(_statement_error(statement, "Display text must be a string."))
                elif len(text) > 64:
                    diagnostics.append(
                        _statement_error(
                            statement,
                            "Display text is longer than the 3pi+ OLED can comfortably show.",
                            DiagnosticSeverity.WARNING,
                        )
                    )
            case PololuOperation.RGB_LED:
                led = params.get("led")
                if not isinstance(led, int) or not 0 <= led <= 5:
                    diagnostics.append(_statement_error(statement, "RGB LED index must be between 0 and 5."))
                for key in ("red", "green", "blue"):
                    value = params.get(key)
                    if not isinstance(value, int) or not 0 <= value <= 255:
                        diagnostics.append(_statement_error(statement, f"RGB value '{key}' must be between 0 and 255."))
            case PololuOperation.YELLOW_LED | PololuOperation.STOP_MOTORS | PololuOperation.BUZZER_BEEP:
                continue
    return diagnostics


def _statement_error(
    statement: PololuStatement,
    message: str,
    severity: DiagnosticSeverity = DiagnosticSeverity.ERROR,
) -> PololuDiagnostic:
    return PololuDiagnostic(
        message=message,
        severity=severity,
        node_id=statement.node_id,
        statement_id=statement.statement_id,
    )
