from __future__ import annotations

import asyncio
from typing import AsyncIterator
from uuid import uuid4

from app.graph.builder import get_graph
from app.services import consultation_repo
from app.state.schemas import PipelineEvent  # noqa: F401  (re-exported for callers)


class ConsultationStore:
    def __init__(self) -> None:
        self._runs: dict[str, dict] = {}
        self._subscribers: dict[str, list[asyncio.Queue]] = {}

    def get(self, run_id: str) -> dict | None:
        return self._runs.get(run_id)

    def set(self, run_id: str, state: dict) -> None:
        self._runs[run_id] = state

    async def publish(self, run_id: str, event: dict) -> None:
        for queue in self._subscribers.get(run_id, []):
            await queue.put(event)

    def subscribe(self, run_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers.setdefault(run_id, []).append(queue)
        return queue


store = ConsultationStore()


def _user_id_from_state(state: dict) -> str | None:
    """The graph state's `patient_context.patient_id` now holds the
    authenticated user's UUID (auth.users.id)."""
    pc = state.get("patient_context") or {}
    return pc.get("patient_id") if isinstance(pc, dict) else None


async def run_consultation(initial_state: dict) -> dict:
    run_id = initial_state.get("run_id") or str(uuid4())
    initial_state["run_id"] = run_id
    initial_state.setdefault("retry_count", 0)
    initial_state.setdefault("warnings", [])
    initial_state.setdefault("events", [])

    store.set(run_id, {"status": "running", "state": initial_state})

    user_id = _user_id_from_state(initial_state)
    if user_id:
        consultation_repo.upsert_consultation(
            run_id=run_id,
            user_id=user_id,
            status="running",
            state=initial_state,
            completed=False,
        )

    graph = get_graph()
    final_state = dict(initial_state)

    async for chunk in graph.astream(initial_state, stream_mode="updates"):
        for node_name, update in chunk.items():
            if isinstance(update, dict):
                for key, value in update.items():
                    if key == "warnings" and isinstance(value, list):
                        final_state.setdefault("warnings", [])
                        final_state["warnings"].extend(value)
                    elif key == "events" and isinstance(value, list):
                        final_state.setdefault("events", [])
                        final_state["events"].extend(value)
                    else:
                        final_state[key] = value

                for ev in update.get("events", []):
                    await store.publish(run_id, {"type": "event", "data": ev})

                await store.publish(
                    run_id,
                    {
                        "type": "node_update",
                        "node": node_name,
                        "state": _public_state(final_state),
                    },
                )

    final_state["status"] = "completed"
    store.set(run_id, {"status": "completed", "state": final_state})
    if user_id:
        consultation_repo.upsert_consultation(
            run_id=run_id,
            user_id=user_id,
            status="completed",
            state=final_state,
            completed=True,
        )
    await store.publish(run_id, {"type": "complete", "state": _public_state(final_state)})
    return final_state


async def stream_events(run_id: str) -> AsyncIterator[dict]:
    run = store.get(run_id)
    if run and run.get("state"):
        for ev in run["state"].get("events", []):
            yield {"type": "event", "data": ev}
        if run.get("status") == "completed":
            yield {"type": "complete", "state": _public_state(run["state"])}
            return

    queue = store.subscribe(run_id)
    while True:
        try:
            item = await asyncio.wait_for(queue.get(), timeout=120.0)
            yield item
            if item.get("type") == "complete":
                break
        except asyncio.TimeoutError:
            yield {"type": "heartbeat"}
            break


def _public_state(state: dict) -> dict:
    return {k: v for k, v in state.items() if k != "audio_bytes"}
