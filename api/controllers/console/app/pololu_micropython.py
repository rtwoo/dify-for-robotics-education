"""Console API endpoints for Pololu MicroPython workflow projects.

The endpoints expose deterministic graph/code transforms and optional LLM
assistance. Code-to-graph intentionally returns a candidate graph only; callers
must apply it through normal draft workflow sync.
"""

from __future__ import annotations

import io
from typing import Any

from flask import request, send_file
from flask_restx import Resource
from pydantic import BaseModel, ConfigDict, Field
from werkzeug.exceptions import BadRequest

from controllers.common.schema import register_schema_models
from controllers.console import console_ns
from controllers.console.app.app import AppDetail
from controllers.console.app.wraps import get_app_model
from controllers.console.wraps import (
    account_initialization_required,
    cloud_edition_billing_resource_check,
    edit_permission_required,
    setup_required,
)
from core.errors.error import ProviderTokenNotInitError, QuotaExceededError
from core.pololu_micropython.entities import (
    PololuCodeResult,
    PololuCompileFile,
    PololuCompileResult,
    PololuDiagnostic,
    PololuGraphResult,
    PololuSourceMapEntry,
)
from graphon.model_runtime.errors.invoke import InvokeError
from libs.login import current_account_with_tenant, login_required
from models.model import AppMode, IconType
from services.pololu_micropython_service import PololuMicropythonService, PololuModelConfig


class CreatePololuProjectPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1)
    description: str | None = Field(default=None, max_length=400)
    icon_type: IconType | None = None
    icon: str | None = None
    icon_background: str | None = None


class GraphPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    graph: dict[str, Any] | None = None


class CodeToGraphPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str


class PololuAssistantPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    instruction: str
    code: str = ""
    diagnostics: list[PololuDiagnostic] = Field(default_factory=list)
    model_config_data: PololuModelConfig | None = Field(default=None, alias="model_config")


class PololuAssistantResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    result: str
    provider: str | None = None
    model: str | None = None


register_schema_models(
    console_ns,
    CreatePololuProjectPayload,
    GraphPayload,
    CodeToGraphPayload,
    PololuAssistantPayload,
    PololuAssistantResponse,
    PololuDiagnostic,
    PololuSourceMapEntry,
    PololuCompileFile,
    PololuCodeResult,
    PololuGraphResult,
    PololuCompileResult,
)


@console_ns.route("/apps/pololu-micropython")
class PololuProjectCreateApi(Resource):
    @setup_required
    @login_required
    @account_initialization_required
    @cloud_edition_billing_resource_check("apps")
    @edit_permission_required
    def post(self):
        current_user, current_tenant_id = current_account_with_tenant()
        args = CreatePololuProjectPayload.model_validate(console_ns.payload)
        app = PololuMicropythonService().create_project(
            tenant_id=current_tenant_id,
            account=current_user,
            name=args.name,
            description=args.description,
            icon_type=args.icon_type.value if args.icon_type else None,
            icon=args.icon,
            icon_background=args.icon_background,
        )
        return AppDetail.model_validate(app, from_attributes=True).model_dump(mode="json"), 201


@console_ns.route("/apps/<uuid:app_id>/pololu-micropython/graph-to-code")
class PololuGraphToCodeApi(Resource):
    @setup_required
    @login_required
    @account_initialization_required
    @get_app_model(mode=[AppMode.WORKFLOW])
    @edit_permission_required
    def post(self, app_model):
        args = GraphPayload.model_validate(console_ns.payload or {})
        service = PololuMicropythonService()
        try:
            service.ensure_pololu_project(app_model)
            result = service.graph_to_code(app_model=app_model, graph=args.graph)
        except ValueError as exc:
            raise BadRequest(str(exc)) from exc
        return result.model_dump(mode="json")


@console_ns.route("/apps/<uuid:app_id>/pololu-micropython/code-to-graph")
class PololuCodeToGraphApi(Resource):
    @setup_required
    @login_required
    @account_initialization_required
    @get_app_model(mode=[AppMode.WORKFLOW])
    @edit_permission_required
    def post(self, app_model):
        args = CodeToGraphPayload.model_validate(console_ns.payload)
        service = PololuMicropythonService()
        try:
            service.ensure_pololu_project(app_model)
            result = service.code_to_graph(app_model=app_model, code=args.code)
        except ValueError as exc:
            raise BadRequest(str(exc)) from exc
        return result.model_dump(mode="json")


@console_ns.route("/apps/<uuid:app_id>/pololu-micropython/compile")
class PololuCompileApi(Resource):
    @setup_required
    @login_required
    @account_initialization_required
    @get_app_model(mode=[AppMode.WORKFLOW])
    @edit_permission_required
    def post(self, app_model):
        args = GraphPayload.model_validate(console_ns.payload or {})
        service = PololuMicropythonService()
        try:
            service.ensure_pololu_project(app_model)
            result = service.compile(app_model=app_model, graph=args.graph)
        except ValueError as exc:
            raise BadRequest(str(exc)) from exc
        return result.model_dump(mode="json")


@console_ns.route("/apps/<uuid:app_id>/pololu-micropython/export")
class PololuExportApi(Resource):
    @setup_required
    @login_required
    @account_initialization_required
    @get_app_model(mode=[AppMode.WORKFLOW])
    @edit_permission_required
    def post(self, app_model):
        args = GraphPayload.model_validate(request.get_json(silent=True) or {})
        service = PololuMicropythonService()
        try:
            service.ensure_pololu_project(app_model)
            archive = service.export_zip(app_model=app_model, graph=args.graph)
        except ValueError as exc:
            raise BadRequest(str(exc)) from exc
        return send_file(
            io.BytesIO(archive),
            mimetype="application/zip",
            as_attachment=True,
            download_name=f"{app_model.name or 'pololu-micropython'}.zip",
        )


@console_ns.route("/apps/<uuid:app_id>/pololu-micropython/assistant")
class PololuAssistantApi(Resource):
    @setup_required
    @login_required
    @account_initialization_required
    @get_app_model(mode=[AppMode.WORKFLOW])
    @edit_permission_required
    def post(self, app_model):
        _, current_tenant_id = current_account_with_tenant()
        args = PololuAssistantPayload.model_validate(console_ns.payload)
        service = PololuMicropythonService()
        try:
            service.ensure_pololu_project(app_model)
            result = service.assistant(
                tenant_id=current_tenant_id,
                instruction=args.instruction,
                code=args.code,
                diagnostics=args.diagnostics,
                model_config=args.model_config_data,
            )
        except (ProviderTokenNotInitError, QuotaExceededError, InvokeError) as exc:
            raise BadRequest(str(exc)) from exc
        except ValueError as exc:
            raise BadRequest(str(exc)) from exc
        return PololuAssistantResponse(**result).model_dump(mode="json")
