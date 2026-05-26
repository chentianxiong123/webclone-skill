"""
CDP DOMSnapshot — sub-pixel exact layout extraction via DevTools Protocol.

DOMSnapshot.captureSnapshot is the same data Chrome's renderer uses internally:
  - layout.bounds: float[4] per layout node — NOT rounded
  - layout.text: per-line text boxes (each line of wrapped text gets its own rect)
  - layout.paintOrders: actual paint order (truer than z-index)
  - layout.styles: any computed styles, one shot
  - documents.nodes.backendNodeId: stable handles you can resolve back to elements

Output is heavily string-table-encoded to save bandwidth; we decode it into a flat
list of nodes with materialized values and bounds, plus a textBoxes table.
"""
from __future__ import annotations

from typing import Any
from playwright.sync_api import Page

# Computed styles to capture for every layout node. Keep the list focused — each
# entry adds 4 bytes per node times millions, and DOMSnapshot supports any name.
DEFAULT_STYLES = [
    "display", "position", "top", "right", "bottom", "left", "z-index",
    "transform", "transform-origin", "opacity", "filter",
    "color", "background-color", "background-image", "background-position", "background-size", "background-repeat",
    "border", "border-radius", "border-color", "border-width", "border-style",
    "box-shadow", "outline",
    "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-decoration",
    "padding", "margin", "gap", "row-gap", "column-gap",
    "flex-direction", "justify-content", "align-items", "align-self",
    "grid-template-columns", "grid-template-rows", "grid-area",
    "overflow", "overflow-x", "overflow-y", "visibility",
    "cursor", "pointer-events",
    "width", "height", "min-width", "min-height", "max-width", "max-height",
    "object-fit", "clip-path", "mask",
    "writing-mode", "direction"
]


def capture(page: Page, computed_styles: list[str] | None = None, include_paint_order: bool = True, include_dom_rects: bool = True) -> dict[str, Any]:
    """Capture a DOMSnapshot via raw CDP. Returns a decoded, flat-per-node form."""
    cdp = page.context.new_cdp_session(page)
    try:
        cdp.send("DOMSnapshot.enable")
    except Exception:
        pass
    raw = cdp.send("DOMSnapshot.captureSnapshot", {
        "computedStyles": computed_styles or DEFAULT_STYLES,
        "includePaintOrder": include_paint_order,
        "includeDOMRects": include_dom_rects,
        "includeBlendedBackgroundColors": True,
        "includeTextColorOpacities": True
    })
    cdp.detach()
    return _decode(raw)


def _decode(raw: dict[str, Any]) -> dict[str, Any]:
    """DOMSnapshot is a string-deduped, columnar format. Materialize it."""
    strings: list[str] = raw.get("strings", [])

    def s(idx):
        if idx is None or idx == -1:
            return None
        if isinstance(idx, int) and 0 <= idx < len(strings):
            return strings[idx]
        return None

    documents = raw.get("documents", [])
    out_docs = []
    for di, doc in enumerate(documents):
        nodes = doc.get("nodes", {}) or {}
        layout = doc.get("layout", {}) or {}
        text_boxes = doc.get("textBoxes", {}) or {}

        # ---- node table ----
        parent_idx = nodes.get("parentIndex", []) or []
        node_type = nodes.get("nodeType", []) or []
        node_name = nodes.get("nodeName", []) or []
        node_value = nodes.get("nodeValue", []) or []
        backend_node_id = nodes.get("backendNodeId", []) or []
        attributes = nodes.get("attributes", []) or []
        text_value = nodes.get("textValue", {}) or {}
        input_value = nodes.get("inputValue", {}) or {}
        is_clickable_idx = set(nodes.get("isClickable", {}).get("index", []) or [])

        text_value_map = dict(zip(text_value.get("index", []) or [], text_value.get("value", []) or []))
        input_value_map = dict(zip(input_value.get("index", []) or [], input_value.get("value", []) or []))

        flat_nodes = []
        for i in range(len(node_name)):
            attrs = {}
            row = attributes[i] if i < len(attributes) else []
            for j in range(0, len(row), 2):
                key = s(row[j])
                val = s(row[j + 1]) if j + 1 < len(row) else None
                if key is not None:
                    attrs[key] = val
            flat_nodes.append({
                "i": i,
                "parentIdx": parent_idx[i] if i < len(parent_idx) else -1,
                "nodeType": node_type[i] if i < len(node_type) else None,
                "nodeName": s(node_name[i]) if i < len(node_name) else None,
                "nodeValue": s(node_value[i]) if i < len(node_value) else None,
                "backendNodeId": backend_node_id[i] if i < len(backend_node_id) else None,
                "attributes": attrs or None,
                "textValue": s(text_value_map[i]) if i in text_value_map else None,
                "inputValue": s(input_value_map[i]) if i in input_value_map else None,
                "isClickable": i in is_clickable_idx
            })

        # ---- layout table ----
        layout_node_index = layout.get("nodeIndex", []) or []
        bounds = layout.get("bounds", []) or []
        styles = layout.get("styles", []) or []
        text = layout.get("text", []) or []
        stacking_contexts = layout.get("stackingContexts", {}) or {}
        paint_orders = layout.get("paintOrders", []) or []
        offset_rects = layout.get("offsetRects", []) or []
        scroll_rects = layout.get("scrollRects", []) or []
        client_rects = layout.get("clientRects", []) or []
        blended_bg = layout.get("blendedBackgroundColors", []) or []
        text_color_opacities = layout.get("textColorOpacities", []) or []

        sc_idx_set = set(stacking_contexts.get("index", []) or [])

        # Each layout entry corresponds to a node by index (1:1 with layout.nodeIndex)
        layout_nodes = []
        for li, ni in enumerate(layout_node_index):
            b = bounds[li] if li < len(bounds) else None
            stl = styles[li] if li < len(styles) else []
            t_idx = text[li] if li < len(text) else -1
            layout_nodes.append({
                "li": li,
                "nodeIdx": ni,
                "bounds": b,  # [x, y, w, h] floats
                "offsetRect": offset_rects[li] if li < len(offset_rects) else None,
                "scrollRect": scroll_rects[li] if li < len(scroll_rects) else None,
                "clientRect": client_rects[li] if li < len(client_rects) else None,
                "paintOrder": paint_orders[li] if li < len(paint_orders) else None,
                "stackingContext": ni in sc_idx_set,
                "blendedBackgroundColor": s(blended_bg[li]) if li < len(blended_bg) else None,
                "textColorOpacity": text_color_opacities[li] if li < len(text_color_opacities) else None,
                "textIdx": t_idx,
                "computedStyles": [s(idx) for idx in stl]
            })

        # ---- textBoxes (per-line precise rects) ----
        tb_layout_index = text_boxes.get("layoutIndex", []) or []
        tb_bounds = text_boxes.get("bounds", []) or []
        tb_start = text_boxes.get("start", []) or []
        tb_length = text_boxes.get("length", []) or []
        text_box_rows = []
        for ti in range(len(tb_layout_index)):
            text_box_rows.append({
                "layoutIdx": tb_layout_index[ti],
                "bounds": tb_bounds[ti] if ti < len(tb_bounds) else None,
                "start": tb_start[ti] if ti < len(tb_start) else None,
                "length": tb_length[ti] if ti < len(tb_length) else None
            })

        out_docs.append({
            "docIdx": di,
            "nodeCount": len(flat_nodes),
            "layoutCount": len(layout_nodes),
            "textBoxCount": len(text_box_rows),
            "nodes": flat_nodes,
            "layout": layout_nodes,
            "textBoxes": text_box_rows
        })

    return {
        "documents": out_docs,
        "stringCount": len(strings),
        "computedStyleNames": DEFAULT_STYLES
    }
