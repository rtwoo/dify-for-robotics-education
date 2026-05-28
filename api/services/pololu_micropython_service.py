"""Service layer for Pololu MicroPython workflow projects.

Pololu projects are normal workflow apps with a robotics feature profile. The
draft workflow graph remains the persisted source of truth; code and IR are
derived on demand to avoid schema changes and stale secondary state.
"""

from __future__ import annotations

import io
import json
import zipfile
from typing import Any, NotRequired, TypedDict, cast

from core.model_manager import ModelManager
from core.pololu_micropython.entities import PololuCompileFile, PololuCompileResult, PololuDiagnostic
from core.pololu_micropython.transform import (
    code_to_ir,
    default_features,
    default_graph,
    graph_to_ir,
    ir_to_code,
    ir_to_graph,
    stable_hash,
    strip_round_trip_metadata,
)
from extensions.ext_database import db
from graphon.model_runtime.entities.llm_entities import LLMResult
from graphon.model_runtime.entities.message_entities import SystemPromptMessage, UserPromptMessage
from graphon.model_runtime.entities.model_entities import ModelType
from libs.datetime_utils import naive_utc_now
from models import Account, App, Workflow
from models.model import AppMode
from services.app_service import AppService, CreateAppParams
from services.workflow_service import WorkflowService


class PololuModelConfig(TypedDict, total=False):
    provider: str
    name: str
    model: str
    completion_params: dict[str, object]


class PololuAssistantResult(TypedDict):
    result: str
    provider: NotRequired[str]
    model: NotRequired[str]


class PololuMicropythonService:
    """Coordinate Pololu workflow creation, compilation, export, and LLM assistance."""

    def create_project(
        self,
        *,
        tenant_id: str,
        account: Account,
        name: str,
        description: str | None,
        icon_type: str | None,
        icon: str | None,
        icon_background: str | None,
    ) -> App:
        """Create a workflow app and initialize its draft with the Pololu starter graph."""
        app = AppService().create_app(
            tenant_id,
            CreateAppParams(
                name=name,
                description=description,
                mode="workflow",
                icon_type=icon_type,
                icon=icon,
                icon_background=icon_background,
            ),
            account,
        )
        WorkflowService().sync_draft_workflow(
            app_model=app,
            graph=default_graph(),
            features=default_features(),
            unique_hash=None,
            account=account,
            environment_variables=[],
            conversation_variables=[],
        )
        return app

    def graph_to_code(self, *, app_model: App, graph: dict[str, Any] | None = None):
        """Compile the supplied or current draft graph to editor MicroPython and persist round-trip hashes."""
        workflow = self._draft_workflow(app_model)
        graph_data = graph or cast(dict[str, Any], workflow.graph_dict)
        graph_hash = stable_hash(graph_data)
        ir_result = graph_to_ir(graph_data)
        code_result = ir_to_code(ir_result.program, graph_hash=graph_hash)
        code_result.diagnostics.extend(ir_result.diagnostics)
        self._update_round_trip_hashes(workflow, graph_hash=graph_hash, ir_hash=code_result.ir_hash)
        return code_result

    def code_to_graph(self, *, app_model: App, code: str):
        """Parse editor MicroPython into a candidate graph without mutating draft state."""
        self._draft_workflow(app_model)
        ir_result = code_to_ir(code)
        graph_result = ir_to_graph(ir_result.program)
        graph_result.diagnostics.extend(ir_result.diagnostics)
        return graph_result

    def compile(self, *, app_model: App, graph: dict[str, Any] | None = None) -> PololuCompileResult:
        """Compile graph data into export files while returning editor-friendly code diagnostics."""
        code_result = self.graph_to_code(app_model=app_model, graph=graph)
        if _has_error_diagnostics(code_result.diagnostics):
            return PololuCompileResult(
                files=[],
                code=code_result.code,
                diagnostics=code_result.diagnostics,
                source_map=code_result.source_map,
                graph_hash=code_result.graph_hash,
                ir_hash=code_result.ir_hash,
            )

        export_code = strip_round_trip_metadata(code_result.code)
        manifest = {
            "target": "pololu_3pi_2040",
            "schema_version": 1,
            "graph_hash": code_result.graph_hash,
            "ir_hash": code_result.ir_hash,
            "files": ["main.py", "manifest.json", "README.txt"],
        }
        files = [
            PololuCompileFile(path="main.py", content=export_code),
            PololuCompileFile(path="manifest.json", content=json.dumps(manifest, indent=2, sort_keys=True) + "\n"),
            PololuCompileFile(
                path="README.txt",
                content=(
                    "Copy main.py to a Pololu 3pi+ 2040 running the Pololu MicroPython firmware and library.\n"
                    "Button B exits the generated control loop.\n"
                ),
            ),
        ]
        return PololuCompileResult(
            files=files,
            code=code_result.code,
            diagnostics=code_result.diagnostics,
            source_map=code_result.source_map,
            graph_hash=code_result.graph_hash,
            ir_hash=code_result.ir_hash,
        )

    def export_zip(self, *, app_model: App, graph: dict[str, Any] | None = None) -> bytes:
        """Package the compiled MicroPython files into a ZIP archive."""
        compile_result = self.compile(app_model=app_model, graph=graph)
        if _has_error_diagnostics(compile_result.diagnostics):
            raise ValueError("resolve Pololu compiler diagnostics before export")
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
            for file in compile_result.files:
                archive.writestr(file.path, file.content)
        return buffer.getvalue()

    def assistant(
        self,
        *,
        tenant_id: str,
        instruction: str,
        code: str,
        diagnostics: list[PololuDiagnostic],
        model_config: PololuModelConfig | None,
    ) -> PololuAssistantResult:
        """Ask the configured LLM for review/repair guidance without changing graph state."""
        configured_model = model_config or {
            "provider": "langgenius/openai_api_compatible/openai_api_compatible",
            "name": "qwen3-coder-30b-a3b-instruct",
        }
        provider = configured_model.get("provider")
        model_name = configured_model.get("name") or configured_model.get("model")
        if not provider or not model_name:
            raise ValueError("provider and model are required for Pololu LLM assistance")

        model_manager = ModelManager.for_tenant(tenant_id=tenant_id)
        model_instance = model_manager.get_model_instance(
            tenant_id=tenant_id,
            model_type=ModelType.LLM,
            provider=provider,
            model=model_name,
        )
        diagnostic_text = "\n".join(f"- {item.severity}: {item.message}" for item in diagnostics) or "- none"
        prompt = (
            "You are helping repair a constrained Pololu 3pi+ 2040 MicroPython program generated by Dify.\n"
            "Only suggest code that preserves the supported subset: time.sleep, robot.ButtonB, Motors, Display, "
            "YellowLED, RGBLEDs, and Buzzer. Do not introduce raw hardware access or arbitrary imports.\n\n"
            f"Instruction:\n{instruction}\n\nDiagnostics:\n{diagnostic_text}\n\nCode:\n```python\n{code}\n```"
        )
        completion_params = dict(configured_model.get("completion_params") or {})
        completion_params.setdefault("temperature", 0.2)
        completion_params.setdefault("max_tokens", 2048)
        response: LLMResult = model_instance.invoke_llm(
            prompt_messages=[
                SystemPromptMessage(content="Return concise repair guidance or a supported code patch."),
                UserPromptMessage(content=prompt),
            ],
            model_parameters=completion_params,
            stream=False,
        )
        return {
            "result": response.message.get_text_content(),
            "provider": provider,
            "model": model_name,
        }

    def ensure_pololu_project(self, app_model: App) -> Workflow:
        """Return the draft workflow or raise if the app lacks the Pololu profile."""
        workflow = self._draft_workflow(app_model)
        features = workflow.normalized_features_dict
        profile = features.get("pololu_micropython")
        if not isinstance(profile, dict) or not profile.get("enabled"):
            raise ValueError("app is not a Pololu MicroPython workflow project")
        return workflow

    def _draft_workflow(self, app_model: App) -> Workflow:
        """Fetch the draft workflow for a workflow-mode app."""
        if app_model.mode != AppMode.WORKFLOW:
            raise ValueError("Pololu MicroPython projects must be workflow apps")
        workflow = WorkflowService().get_draft_workflow(app_model=app_model)
        if not workflow:
            raise ValueError("draft workflow not found")
        return workflow

    def _update_round_trip_hashes(self, workflow: Workflow, *, graph_hash: str, ir_hash: str) -> None:
        """Persist compiler hash metadata inside workflow features."""
        features = workflow.normalized_features_dict
        profile = features.get("pololu_micropython")
        if not isinstance(profile, dict):
            return
        profile["last_graph_hash"] = graph_hash
        profile["last_ir_hash"] = ir_hash
        workflow.features = json.dumps(features)
        workflow.updated_at = naive_utc_now()
        db.session.commit()


def _has_error_diagnostics(diagnostics: list[PololuDiagnostic]) -> bool:
    return any(diagnostic.severity == "error" for diagnostic in diagnostics)
