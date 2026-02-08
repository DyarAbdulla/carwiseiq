"""
Retraining Scheduler
Schedules automatic model retraining based on feedback accumulation
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
import os

logger = logging.getLogger(__name__)

from app.services.model_retrainer import (
    should_retrain_model,
    retrain_model_with_feedback
)


class RetrainScheduler:
    """Scheduler for automatic model retraining"""

    def __init__(
        self,
        check_interval_hours: int = 24,
        min_feedback_for_retrain: int = 50,
        days_to_check: int = 7,
        weekly_retrain: bool = True,
        monthly_retrain: bool = True
    ):
        self.check_interval_hours = check_interval_hours
        self.min_feedback_for_retrain = min_feedback_for_retrain
        self.days_to_check = days_to_check
        self.weekly_retrain = weekly_retrain
        self.monthly_retrain = monthly_retrain
        self.last_check: Optional[datetime] = None
        self.last_retrain: Optional[datetime] = None
        self._running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the scheduler"""
        if self._running:
            logger.warning("Scheduler already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(f"Retrain scheduler started (check interval: {self.check_interval_hours}h)")

    async def stop(self):
        """Stop the scheduler"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Retrain scheduler stopped")

    async def _run_loop(self):
        """Main scheduler loop"""
        while self._running:
            try:
                await self._check_and_retrain()
                await asyncio.sleep(self.check_interval_hours * 3600)  # Convert hours to seconds
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}", exc_info=True)
                await asyncio.sleep(3600)  # Wait 1 hour before retrying

    async def _check_and_retrain(self):
        """Check if retraining is needed and trigger it"""
        self.last_check = datetime.now()
        logger.info("Checking if model retraining is needed...")

        # Check if we should retrain based on feedback accumulation
        should_retrain, reason = should_retrain_model(
            min_feedback_since_last_training=self.min_feedback_for_retrain,
            days_since_last_training=self.days_to_check
        )

        # Check weekly/monthly schedule
        if not should_retrain:
            if self.last_retrain:
                days_since = (datetime.now() - self.last_retrain).days

                if self.weekly_retrain and days_since >= 7:
                    should_retrain = True
                    reason = f"Weekly retraining scheduled ({days_since} days since last)"
                elif self.monthly_retrain and days_since >= 30:
                    should_retrain = True
                    reason = f"Monthly retraining scheduled ({days_since} days since last)"

        if should_retrain:
            logger.info(f"Retraining triggered: {reason}")
            try:
                # Run in executor to avoid blocking the event loop (I/O: DB, CSV read/write)
                loop = asyncio.get_running_loop()
                result = await loop.run_in_executor(
                    None,
                    lambda: retrain_model_with_feedback(
                        min_feedback_samples=self.min_feedback_for_retrain,
                        combine_with_main_dataset=True,
                        feedback_weight=1.5,
                    ),
                )

                if result.get("success"):
                    self.last_retrain = datetime.now()
                    logger.info("Model retraining completed: %s", result.get("message"))
                else:
                    logger.warning("Model retraining failed: %s", result.get("message"))
            except asyncio.CancelledError:
                logger.info("Retraining cancelled")
                raise
            except Exception as e:
                logger.error("Error during scheduled retraining: %s", e, exc_info=True)
        else:
            logger.info(f"Retraining not needed: {reason}")


# Global scheduler instance
_scheduler: Optional[RetrainScheduler] = None


def get_scheduler() -> RetrainScheduler:
    """Get or create the global scheduler instance"""
    global _scheduler
    if _scheduler is None:
        _scheduler = RetrainScheduler(
            check_interval_hours=24,  # Check daily
            min_feedback_for_retrain=50,
            days_to_check=7,
            weekly_retrain=True,
            monthly_retrain=True
        )
    return _scheduler


async def start_scheduler():
    """Start the global scheduler"""
    scheduler = get_scheduler()
    await scheduler.start()


async def stop_scheduler():
    """Stop the global scheduler"""
    global _scheduler
    if _scheduler:
        await _scheduler.stop()
        _scheduler = None
