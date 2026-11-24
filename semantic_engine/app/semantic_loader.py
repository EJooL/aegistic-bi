"""Loads and validates semantic_models/commerce.yaml into typed Pydantic models."""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Literal, Optional

import yaml
from pydantic import BaseModel, Field, model_validator

from semantic_engine.app.schemas import (
    DimensionCatalogItem,
    MetricCatalogItem,
    MetricCatalogResponse,
)


class TableDef(BaseModel):
    alias: str
    role: Literal["fact", "dimension"]
    grain: str
    primary_key: str
    description: str = ""


class JoinDef(BaseModel):
    name: str
    from_table: str
    from_alias: str
    to_table: str
    to_alias: str
    join_type: Literal["LEFT", "INNER"] = "LEFT"
    relationship: str = "many_to_one"
    on: str

    @model_validator(mode="before")
    @classmethod
    def normalize_yaml_on_key(cls, data: object) -> object:
        """PyYAML (YAML 1.1) parses unquoted key `on:` as boolean True."""
        if isinstance(data, dict) and True in data and "on" not in data:
            normalized = dict(data)
            normalized["on"] = normalized.pop(True)
            return normalized
        return data


class MetricDef(BaseModel):
    key: str
    label: str
    description: str
    formula_display: str
    sql_expression: str
    item_grain_sql_expression: Optional[str] = None
    format: Literal["currency_idr", "percentage", "integer", "float"]
    grain: Literal["order", "order_item"]
    base_table: str
    mandatory_filters: list[str] = Field(default_factory=list)
    allowed_dimensions: list[str] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)
    synonyms: list[str] = Field(default_factory=list)
    owner: str = "BI Governance"


class DimensionDef(BaseModel):
    key: str
    label: str
    table: str
    alias: str
    column: str
    type: Literal["time", "categorical"]
    supported_grains: list[str] = Field(default_factory=list)
    grain_columns: dict[str, str] = Field(default_factory=dict)
    description: str = ""
    synonyms: list[str] = Field(default_factory=list)
    known_values: list[str] = Field(default_factory=list)


class SemanticModel(BaseModel):
    model_name: str
    display_name: str
    version: str
    currency: str = "IDR"
    description: str
    reference_date: str = "2026-11-24"
    tables: dict[str, TableDef]
    joins: list[JoinDef] = Field(default_factory=list)
    metrics: list[MetricDef]
    dimensions: list[DimensionDef]

    @model_validator(mode="after")
    def validate_model_integrity(self) -> "SemanticModel":
        for table_name in self.tables:
            if not table_name.startswith("gold."):
                raise ValueError(f"Semantic model table '{table_name}' must be in gold.* schema.")

        metric_keys: set[str] = set()
        for metric in self.metrics:
            if metric.key in metric_keys:
                raise ValueError(f"Duplicate metric key: '{metric.key}'")
            metric_keys.add(metric.key)
            if metric.base_table not in self.tables:
                raise ValueError(
                    f"Metric '{metric.key}' references unknown table '{metric.base_table}'."
                )

        dim_keys: set[str] = set()
        for dim in self.dimensions:
            if dim.key in dim_keys:
                raise ValueError(f"Duplicate dimension key: '{dim.key}'")
            dim_keys.add(dim.key)
            if dim.table not in self.tables:
                raise ValueError(
                    f"Dimension '{dim.key}' references unknown table '{dim.table}'."
                )

        for metric in self.metrics:
            for dim_key in metric.allowed_dimensions:
                if dim_key not in dim_keys:
                    raise ValueError(
                        f"Metric '{metric.key}' allows unknown dimension '{dim_key}'."
                    )

        # Validate reference_date parses cleanly
        date.fromisoformat(self.reference_date)
        return self

    @property
    def reference_date_obj(self) -> date:
        return date.fromisoformat(self.reference_date)

    @property
    def metric_map(self) -> dict[str, MetricDef]:
        return {m.key: m for m in self.metrics}

    @property
    def dimension_map(self) -> dict[str, DimensionDef]:
        return {d.key: d for d in self.dimensions}

    def get_metric(self, key: str) -> MetricDef:
        metric = self.metric_map.get(key)
        if metric is None:
            raise KeyError(f"Unknown metric key: '{key}'")
        return metric

    def get_dimension(self, key: str) -> DimensionDef:
        dim = self.dimension_map.get(key)
        if dim is None:
            raise KeyError(f"Unknown dimension key: '{key}'")
        return dim

    def to_catalog_response(self) -> MetricCatalogResponse:
        return MetricCatalogResponse(
            model_name=self.model_name,
            display_name=self.display_name,
            version=self.version,
            currency=self.currency,
            description=self.description,
            metrics=[
                MetricCatalogItem(
                    key=m.key,
                    label=m.label,
                    description=m.description,
                    formula_display=m.formula_display,
                    sql_expression=m.sql_expression,
                    format=m.format,
                    grain=m.grain,
                    base_table=m.base_table,
                    mandatory_filters=list(m.mandatory_filters),
                    allowed_dimensions=list(m.allowed_dimensions),
                    caveats=list(m.caveats),
                    owner=m.owner,
                )
                for m in self.metrics
            ],
            dimensions=[
                DimensionCatalogItem(
                    key=d.key,
                    label=d.label,
                    table=d.table,
                    column=d.column,
                    type=d.type,
                    supported_grains=list(d.supported_grains),
                    description=d.description,
                )
                for d in self.dimensions
            ],
        )


def load_semantic_model(path: Path | str) -> SemanticModel:
    """Load and validate a semantic model YAML file."""
    model_path = Path(path)
    if not model_path.exists():
        raise FileNotFoundError(f"Semantic model YAML not found at: {model_path}")
    with model_path.open("r", encoding="utf-8") as fh:
        raw = yaml.safe_load(fh)
    if not isinstance(raw, dict):
        raise ValueError(f"Semantic model YAML at {model_path} must be a mapping.")
    return SemanticModel.model_validate(raw)
