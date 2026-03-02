"""
NOVYRA Event Bus - Central Event Dispatcher

All system events flow through this bus to ensure decoupled architecture.
"""
import asyncio
import logging
from typing import Callable, Dict, List, Any, Awaitable
from collections import defaultdict
from datetime import datetime

from app.services.events.event_definitions import Event, EventType
from app.core.database import get_db

logger = logging.getLogger(__name__)


class EventBus:
    """
    Central event bus for publish-subscribe pattern.
    
    Features:
    - Async event handling
    - Multiple subscribers per event type
    - Event logging to database
    - Error handling with retries
    """
    
    def __init__(self):
        # Map event types to list of handler functions
        self._handlers: Dict[EventType, List[Callable[[Event], Awaitable[None]]]] = defaultdict(list)
        
        # Event processing queue
        self._event_queue: asyncio.Queue = asyncio.Queue()
        
        # Stats
        self._events_emitted = 0
        self._events_processed = 0
        self._events_failed = 0
    
    def subscribe(self, event_type: EventType, handler: Callable[[Event], Awaitable[None]]):
        """
        Subscribe a handler function to an event type.
        
        Handler must be an async function that takes an Event and returns None.
        """
        self._handlers[event_type].append(handler)
        logger.info(f"Subscribed handler {handler.__name__} to {event_type.value}")
    
    def subscribe_multiple(self, event_types: List[EventType], handler: Callable[[Event], Awaitable[None]]):
        """Subscribe a single handler to multiple event types."""
        for event_type in event_types:
            self.subscribe(event_type, handler)
    
    async def emit(self, event: Event):
        """
        Emit an event to all subscribed handlers.
        
        Events are processed asynchronously and logged to the database.
        """
        self._events_emitted += 1
        
        # Log event toдatabase
        await self._log_event(event)
        
        # Get handlers for this event type
        handlers = self._handlers.get(event.event_type, [])
        
        if not handlers:
            logger.debug(f"No handlers for event type {event.event_type.value}")
            return
        
        # Execute all handlers concurrently
        tasks = []
        for handler in handlers:
            task = asyncio.create_task(self._execute_handler(handler, event))
            tasks.append(task)
        
        # Wait for all handlers to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Log any exceptions
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(
                    f"Handler {handlers[i].__name__} failed for event {event.event_type.value}: {result}",
                    exc_info=result
                )
                self._events_failed += 1
        
        self._events_processed += 1
    
    async def _execute_handler(self, handler: Callable, event: Event):
        """Execute a single event handler with error handling."""
        try:
            await handler(event)
        except Exception as e:
            logger.error(f"Handler {handler.__name__} raised exception: {e}", exc_info=True)
            raise
    
    async def _log_event(self, event: Event):
        """Log event to database for audit trail."""
        try:
            db = get_db()
            await db.event_log.create({
                "data": {
                    "eventType": event.event_type.value,
                    "userId": event.user_id,
                    "metadata": event.metadata,
                    "emittedAt": event.timestamp
                }
            })
        except Exception as e:
            logger.error(f"Failed to log event to database: {e}")
            # Don't raise - event processing should continue even if logging fails
    
    def get_stats(self) -> Dict[str, int]:
        """Get event bus statistics."""
        return {
            "events_emitted": self._events_emitted,
            "events_processed": self._events_processed,
            "events_failed": self._events_failed,
            "handlers_registered": sum(len(handlers) for handlers in self._handlers.values())
        }


# Global event bus instance
_event_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    """Get the global event bus instance."""
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
    return _event_bus


# Convenience functions
async def emit_event(event: Event):
    """Emit an event through the global event bus."""
    bus = get_event_bus()
    await bus.emit(event)


def subscribe(event_type: EventType, handler: Callable[[Event], Awaitable[None]]):
    """Subscribe a handler to an event type on the global bus."""
    bus = get_event_bus()
    bus.subscribe(event_type, handler)


def subscribe_multiple(event_types: List[EventType], handler: Callable[[Event], Awaitable[None]]):
    """Subscribe a handler to multiple event types on the global bus."""
    bus = get_event_bus()
    bus.subscribe_multiple(event_types, handler)


# Decorator for easy handler registration
def event_handler(*event_types: EventType):
    """
    Decorator to register a function as an event handler.
    
    Usage:
        @event_handler(EventType.ANSWER_ACCEPTED, EventType.ANSWER_UPVOTED)
        async def handle_answer_events(event: Event):
            # Handle event
            pass
    """
    def decorator(func: Callable[[Event], Awaitable[None]]):
        for event_type in event_types:
            subscribe(event_type, func)
        return func
    return decorator
