from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.graph.router import integrity_router
from app.nodes.ingest import ingest_node
from app.nodes.integrity import integrity_node
from app.nodes.merge import merge_node
from app.nodes.refine import refine_node
from app.nodes.dispatch import dispatch_node
from app.nodes.specialists import specialists_parallel_node
from app.state.schemas import GraphState


async def inject_context_node(state: dict) -> dict:
    return {}


def build_graph():
    graph = StateGraph(GraphState)

    graph.add_node("inject_context", inject_context_node)
    graph.add_node("ingest", ingest_node)
    graph.add_node("refine", refine_node)
    graph.add_node("dispatch", dispatch_node)
    graph.add_node("specialists", specialists_parallel_node)
    graph.add_node("merge", merge_node)
    graph.add_node("integrity", integrity_node)

    graph.set_entry_point("inject_context")
    graph.add_edge("inject_context", "ingest")
    graph.add_edge("ingest", "refine")
    graph.add_edge("refine", "dispatch")
    graph.add_edge("dispatch", "specialists")
    graph.add_edge("specialists", "merge")
    graph.add_edge("merge", "integrity")
    graph.add_conditional_edges("integrity", integrity_router, {"retry": "dispatch", "end": END})

    return graph.compile()


_compiled_graph = None


def get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph()
    return _compiled_graph
