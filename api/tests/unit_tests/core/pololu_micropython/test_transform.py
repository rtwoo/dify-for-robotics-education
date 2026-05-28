from core.pololu_micropython.entities import PololuOperation, PololuProgram, PololuStatement
from core.pololu_micropython.transform import code_to_ir, default_graph, graph_to_ir, ir_to_code, ir_to_graph


def test_graph_to_code_generates_safe_motor_program():
    result = graph_to_ir(default_graph())
    assert result.diagnostics == []

    code_result = ir_to_code(result.program, graph_hash="graph")

    assert code_result.diagnostics == []
    assert "button_b = robot.ButtonB()" in code_result.code
    assert "motors.set_speeds(1000, 1000)" in code_result.code
    assert "finally:\n    motors.off()" in code_result.code


def test_default_graph_includes_empty_start_variables():
    graph = default_graph()
    start_node = next(node for node in graph["nodes"] if node["data"]["type"] == "start")

    assert start_node["data"]["variables"] == []


def test_generated_code_round_trips_to_graph_with_node_identity():
    program = PololuProgram(
        statements=[
            PololuStatement(
                statement_id="stmt-1",
                node_id="node-1",
                operation=PololuOperation.SET_MOTORS,
                parameters={"left": 1200, "right": 900},
            ),
            PololuStatement(
                statement_id="stmt-2",
                node_id="node-2",
                operation=PololuOperation.WAIT,
                parameters={"seconds": 0.5},
            ),
        ]
    )
    code = ir_to_code(program).code

    ir_result = code_to_ir(code)
    graph_result = ir_to_graph(ir_result.program)

    assert ir_result.diagnostics == []
    assert [statement.node_id for statement in ir_result.program.statements] == ["node-1", "node-2"]
    assert [statement.parameters for statement in ir_result.program.statements] == [
        {"left": 1200, "right": 900},
        {"seconds": 0.5},
    ]
    assert [node["id"] for node in graph_result.graph["nodes"] if node["data"]["type"] == "pololu-action"] == [
        "node-1",
        "node-2",
    ]


def test_metadata_removal_reconstructs_new_graph_node_ids():
    code = ir_to_code(
        PololuProgram(
            statements=[
                PololuStatement(
                    statement_id="stmt-1",
                    node_id="node-1",
                    operation=PololuOperation.SET_MOTORS,
                    parameters={"left": 1200, "right": 900},
                ),
                PololuStatement(
                    statement_id="stmt-2",
                    node_id="node-2",
                    operation=PololuOperation.WAIT,
                    parameters={"seconds": 0.5},
                ),
            ]
        )
    ).code
    code_without_metadata = "\n".join(
        line for line in code.splitlines() if not line.strip().startswith("# dify:statement")
    )

    ir_result = code_to_ir(code_without_metadata)
    graph_result = ir_to_graph(ir_result.program)

    assert ir_result.diagnostics == []
    assert [statement.node_id for statement in ir_result.program.statements] == [None, None]
    assert [node["id"] for node in graph_result.graph["nodes"] if node["data"]["type"] == "pololu-action"] != [
        "node-1",
        "node-2",
    ]


def test_code_edit_updates_motor_speed_in_ir():
    code = ir_to_code(
        PololuProgram(
            statements=[
                PololuStatement(
                    statement_id="stmt-1",
                    node_id="node-1",
                    operation=PololuOperation.SET_MOTORS,
                    parameters={"left": 1000, "right": 1000},
                )
            ]
        )
    ).code

    edited_code = code.replace("motors.set_speeds(1000, 1000)", "motors.set_speeds(800, -800)")
    result = code_to_ir(edited_code)

    assert result.diagnostics == []
    assert result.program.statements[0].parameters == {"left": 800, "right": -800}


def test_unsupported_python_returns_line_diagnostic():
    code = """from time import sleep
from pololu_3pi_2040_robot import robot

button_b = robot.ButtonB()
motors = robot.Motors()

try:
    while True:
        if button_b.check():
            break
        import machine
finally:
    motors.off()
"""

    result = code_to_ir(code)

    assert result.diagnostics
    assert result.diagnostics[0].line == 11


def test_unsupported_device_assignment_returns_diagnostic():
    code = """from time import sleep
from pololu_3pi_2040_robot import robot

button_b = robot.ButtonB()
motors = make_motors()

try:
    while True:
        if button_b.check():
            break
finally:
    motors.off()
"""

    result = code_to_ir(code)

    assert any("device assignment" in diagnostic.message for diagnostic in result.diagnostics)


def test_motor_speed_validation_rejects_out_of_range_values():
    graph = default_graph()
    motor_node = next(node for node in graph["nodes"] if node["id"] == "pololu-set-motors")
    motor_node["data"]["parameters"]["left"] = 7000

    result = graph_to_ir(graph)

    assert result.diagnostics
    assert "between -6000 and 6000" in result.diagnostics[0].message


def test_generated_cleanup_turns_off_leds_and_buzzer():
    program = PololuProgram(
        statements=[
            PololuStatement(
                statement_id="stmt-1",
                operation=PololuOperation.YELLOW_LED,
                parameters={"on": True},
            ),
            PololuStatement(
                statement_id="stmt-2",
                operation=PololuOperation.RGB_LED,
                parameters={"led": 0, "red": 0, "green": 32, "blue": 0},
            ),
            PololuStatement(statement_id="stmt-3", operation=PololuOperation.BUZZER_BEEP),
        ]
    )

    code_result = ir_to_code(program)

    assert "finally:\n    yellow_led.off()\n    rgb_leds.off()\n    buzzer.off()" in code_result.code
